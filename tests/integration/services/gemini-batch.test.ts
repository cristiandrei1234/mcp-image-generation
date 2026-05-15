import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@google/genai", async () => {
  const actual = await vi.importActual<typeof import("@google/genai")>("@google/genai");
  let lastInstance: {
    batches: {
      create: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
    };
  } | null = null;
  class GoogleGenAI {
    batches = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      cancel: vi.fn(),
    };
    models = { generateContentStream: vi.fn() };
    constructor(_opts: unknown) {
      lastInstance = this;
    }
  }
  return {
    ...actual,
    GoogleGenAI,
    __getLastInstance: () => lastInstance,
  };
});

import { GeminiBatchService, isLikelyBatchName } from "../../../src/services/gemini-batch.js";
import type { Logger } from "../../../src/infra/logger.js";

const noopLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

async function lastInstance() {
  const mod = (await import("@google/genai")) as unknown as {
    __getLastInstance: () => {
      batches: {
        create: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        list: ReturnType<typeof vi.fn>;
        cancel: ReturnType<typeof vi.fn>;
      };
    } | null;
  };
  const inst = mod.__getLastInstance();
  if (!inst) throw new Error("no instance");
  return inst;
}

const baseReq = {
  prompt: "x",
  aspectRatio: "1:1" as const,
  resolution: "1K" as const,
  numImages: 1,
};

describe("isLikelyBatchName", () => {
  it("accepts canonical names", () => {
    expect(isLikelyBatchName("batches/abc123")).toBe(true);
    expect(isLikelyBatchName("batches/AB-cd_12")).toBe(true);
  });
  it("rejects bogus values", () => {
    expect(isLikelyBatchName("abc123")).toBe(false);
    expect(isLikelyBatchName("batches/")).toBe(false);
    expect(isLikelyBatchName("batches/with spaces")).toBe(false);
    expect(isLikelyBatchName("../../etc/passwd")).toBe(false);
  });
});

describe("GeminiBatchService", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gimgbatch-"));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  describe("submit", () => {
    it("rejects empty requests array", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      await lastInstance(); // construct
      const r = await service.submit({ requests: [] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("bad_request");
    });

    it("sends inlined requests with the correct shape", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.create.mockResolvedValue({
        name: "batches/abc123",
        displayName: "test",
        state: "JOB_STATE_QUEUED",
      });

      await service.submit({
        requests: [baseReq, { ...baseReq, prompt: "y" }],
        displayName: "test",
      });

      const args = inst.batches.create.mock.calls[0]![0] as {
        model: string;
        src: Array<{ model: string; contents: unknown; config: { imageConfig: { aspectRatio: string } } }>;
        config?: { displayName?: string };
      };
      expect(args.model).toBe("gemini-3.1-flash-image-preview");
      expect(args.src).toHaveLength(2);
      expect(args.src[0]!.config.imageConfig.aspectRatio).toBe("1:1");
      expect(args.config?.displayName).toBe("test");
    });

    it("classifies SDK errors", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      const { ApiError } = await import("@google/genai");
      inst.batches.create.mockRejectedValue(new ApiError({ status: 401, message: "bad key" }));

      const r = await service.submit({ requests: [baseReq] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("auth");
    });
  });

  describe("get", () => {
    it("rejects malformed names without calling the SDK", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      const r = await service.get("not-a-batch-name");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("bad_request");
      expect(inst.batches.get).not.toHaveBeenCalled();
    });

    it("returns summarized job for valid name", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.get.mockResolvedValue({
        name: "batches/xyz",
        displayName: "test",
        state: "JOB_STATE_RUNNING",
        createTime: "2026-05-16T00:00:00Z",
      });

      const r = await service.get("batches/xyz");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.name).toBe("batches/xyz");
        expect(r.value.state).toBe("JOB_STATE_RUNNING");
      }
    });
  });

  describe("getResults", () => {
    it("returns running state when not terminal", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.get.mockResolvedValue({
        name: "batches/r1",
        state: "JOB_STATE_RUNNING",
      });

      const r = await service.getResults("batches/r1");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.state).toBe("JOB_STATE_RUNNING");
        expect(r.value.files).toEqual([]);
        expect(r.value.errors).toEqual([]);
      }
    });

    it("writes images to disk when succeeded", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      const fake = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
      inst.batches.get.mockResolvedValue({
        name: "batches/done",
        state: "JOB_STATE_SUCCEEDED",
        dest: {
          inlinedResponses: [
            { response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: fake } }] } }] } },
            { response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: fake } }] } }] } },
          ],
        },
      });

      const r = await service.getResults("batches/done");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.state).toBe("JOB_STATE_SUCCEEDED");
        expect(r.value.files).toHaveLength(2);
        expect(r.value.errors).toEqual([]);
        const onDisk = await readdir(outputDir);
        expect(onDisk).toHaveLength(2);
      }
    });

    it("collects per-request errors", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.get.mockResolvedValue({
        name: "batches/mixed",
        state: "JOB_STATE_SUCCEEDED",
        dest: {
          inlinedResponses: [
            { error: { message: "Safety filter triggered" } },
            { response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from("X").toString("base64") } }] } }] } },
          ],
        },
      });

      const r = await service.getResults("batches/mixed");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.files).toHaveLength(1);
        expect(r.value.errors).toHaveLength(1);
        expect(r.value.errors[0]).toContain("Safety filter triggered");
      }
    });
  });

  describe("list", () => {
    it("returns summaries of recent jobs", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.list.mockResolvedValue({
        page: [
          { name: "batches/a", state: "JOB_STATE_SUCCEEDED" },
          { name: "batches/b", state: "JOB_STATE_RUNNING" },
        ],
      });

      const r = await service.list();
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toHaveLength(2);
        expect(r.value[0]!.name).toBe("batches/a");
      }
    });

    it("returns empty array when no jobs", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.list.mockResolvedValue({ page: [] });

      const r = await service.list();
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual([]);
    });
  });

  describe("cancel", () => {
    it("rejects malformed names", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      const r = await service.cancel("nope");
      expect(r.ok).toBe(false);
      expect(inst.batches.cancel).not.toHaveBeenCalled();
    });

    it("calls SDK cancel for valid name", async () => {
      const service = new GeminiBatchService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.batches.cancel.mockResolvedValue({});

      const r = await service.cancel("batches/abc");
      expect(r.ok).toBe(true);
      expect(inst.batches.cancel).toHaveBeenCalledWith({ name: "batches/abc" });
    });
  });
});
