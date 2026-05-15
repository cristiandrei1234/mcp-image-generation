import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Google SDK before importing the service.
vi.mock("@google/genai", async () => {
  const actual = await vi.importActual<typeof import("@google/genai")>("@google/genai");
  let lastInstance: { models: { generateContentStream: ReturnType<typeof vi.fn> } } | null = null;
  class GoogleGenAI {
    models = {
      generateContentStream: vi.fn(),
    };
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

import { GeminiImageService } from "../../../src/services/gemini-image.js";
import type { Logger } from "../../../src/infra/logger.js";

const noopLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeStream(chunks: unknown[]): AsyncGenerator<unknown> {
  async function* gen(): AsyncGenerator<unknown> {
    for (const c of chunks) yield c;
  }
  return gen();
}

function imagePart(base64: string, mimeType = "image/png"): unknown {
  return { inlineData: { mimeType, data: base64 } };
}
function textPart(text: string): unknown {
  return { text };
}
function chunk(...parts: unknown[]): unknown {
  return { candidates: [{ content: { parts } }] };
}

async function lastInstance() {
  const mod = (await import("@google/genai")) as unknown as {
    __getLastInstance: () => { models: { generateContentStream: ReturnType<typeof vi.fn> } } | null;
  };
  const inst = mod.__getLastInstance();
  if (!inst) throw new Error("no GoogleGenAI instance constructed yet");
  return inst;
}

describe("GeminiImageService integration (SDK mocked)", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gimgsvc-"));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("sends the correct request shape to the SDK", async () => {
    const service = new GeminiImageService("AIzaXXXXXXXXXX", noopLogger, outputDir);
    const inst = await lastInstance();

    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart(fakePng))]));

    await service.generate({
      prompt: "a cat",
      aspectRatio: "16:9",
      resolution: "2K",
      numImages: 1,
      seed: 7,
      thinkingLevel: "HIGH",
      personGeneration: "ALLOW_ADULT",
    });

    expect(inst.models.generateContentStream).toHaveBeenCalledOnce();
    const req = inst.models.generateContentStream.mock.calls[0]![0] as {
      model: string;
      config: {
        responseModalities: string[];
        imageConfig: { aspectRatio: string; imageSize: string; personGeneration: string };
        thinkingConfig: { thinkingLevel: string };
        seed: number;
        candidateCount: number;
      };
      contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: unknown }> }>;
    };

    expect(req.model).toBe("gemini-3.1-flash-image-preview");
    expect(req.config.responseModalities).toEqual(["IMAGE"]);
    expect(req.config.imageConfig.aspectRatio).toBe("16:9");
    expect(req.config.imageConfig.imageSize).toBe("2K");
    expect(req.config.imageConfig.personGeneration).toBe("ALLOW_ADULT");
    expect(req.config.thinkingConfig.thinkingLevel).toBe("HIGH");
    expect(req.config.seed).toBe(7);
    expect(req.config.candidateCount).toBe(1);
    expect(req.contents[0]!.parts[0]).toMatchObject({ text: "a cat" });
  });

  it("omits optional config fields when not provided", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

    await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    const req = inst.models.generateContentStream.mock.calls[0]![0] as {
      config: Record<string, unknown>;
    };
    expect(req.config).not.toHaveProperty("seed");
    expect(req.config).not.toHaveProperty("thinkingConfig");
    expect((req.config.imageConfig as Record<string, unknown>)).not.toHaveProperty(
      "personGeneration",
    );
  });

  it("places reference images BEFORE the text in the parts array", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("YWFh"))]));

    await service.generate({
      prompt: "edit this",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
      referenceImages: [
        { data: Buffer.from([1, 2, 3]), mimeType: "image/png" },
        { data: Buffer.from([4, 5]), mimeType: "image/jpeg" },
      ],
    });

    const req = inst.models.generateContentStream.mock.calls[0]![0] as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    const parts = req.contents[0]!.parts;
    expect(parts.length).toBe(3);
    expect(parts[0]).toHaveProperty("inlineData");
    expect(parts[1]).toHaveProperty("inlineData");
    expect(parts[2]).toMatchObject({ text: "edit this" });
  });

  it("writes one file per inlineData part across multiple chunks", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();

    const png1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64");
    const png2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff]).toString("base64");
    inst.models.generateContentStream.mockResolvedValue(
      makeStream([chunk(imagePart(png1)), chunk(imagePart(png2, "image/jpeg"))]),
    );

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files).toHaveLength(2);

    const written = await readdir(outputDir);
    expect(written).toHaveLength(2);
    expect(written.some((f) => f.endsWith(".png"))).toBe(true);
    expect(written.some((f) => f.endsWith(".jpg") || f.endsWith(".jpeg"))).toBe(true);

    const buf = await readFile(result.value.files[0]!);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("captures text parts when the model also emits commentary", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(
      makeStream([chunk(textPart("Here is your image:"), imagePart("AAAA"))]),
    );

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.textParts).toEqual(["Here is your image:"]);
    }
  });

  it("returns no_image when stream emits only text", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(
      makeStream([chunk(textPart("I can't generate that."))]),
    );

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("no_image");
      if (result.error.kind === "no_image") {
        expect(result.error.reason).toContain("I can't generate that.");
      }
    }
  });

  it("returns no_image when stream is empty", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(makeStream([]));

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("no_image");
  });

  it("returns an error and logs when SDK rejects during init (auth)", async () => {
    const errorLogger: Logger = { ...noopLogger, error: vi.fn() };
    const service = new GeminiImageService("AIza", errorLogger, outputDir);
    const inst = await lastInstance();
    const { ApiError } = await import("@google/genai");
    inst.models.generateContentStream.mockRejectedValue(
      new ApiError({ status: 401, message: "Invalid API key" }),
    );

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth");
    expect(errorLogger.error).toHaveBeenCalled();
  });

  describe("auto-routing between Flash and Pro", () => {
    it("default → Flash model id", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

      await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
        resolution: "1K",
        numImages: 1,
      });

      const req = inst.models.generateContentStream.mock.calls[0]![0] as { model: string };
      expect(req.model).toBe("gemini-3.1-flash-image-preview");
    });

    it("hasText=true → Pro model id", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

      await service.generate({
        prompt: "Poster with 'Summer Sale' headline",
        aspectRatio: "1:1",
        resolution: "1K",
        numImages: 1,
        hasText: true,
      });

      const req = inst.models.generateContentStream.mock.calls[0]![0] as { model: string };
      expect(req.model).toBe("gemini-3-pro-image-preview");
    });

    it("resolution=4K → Pro model id", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

      await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
        resolution: "4K",
        numImages: 1,
      });

      const req = inst.models.generateContentStream.mock.calls[0]![0] as { model: string };
      expect(req.model).toBe("gemini-3-pro-image-preview");
    });

    it("model='flash' forces Flash even with Pro triggers", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

      await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
        resolution: "4K",
        numImages: 1,
        model: "flash",
      });

      const req = inst.models.generateContentStream.mock.calls[0]![0] as { model: string };
      expect(req.model).toBe("gemini-3.1-flash-image-preview");
    });

    it("rejects Pro + 512 with bad_request (no SDK call)", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();

      const result = await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
        resolution: "512",
        numImages: 1,
        model: "pro",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("bad_request");
        if (result.error.kind === "bad_request") {
          expect(result.error.message).toMatch(/512/);
          expect(result.error.message).toMatch(/Flash/i);
        }
      }
      expect(inst.models.generateContentStream).not.toHaveBeenCalled();
    });

    it("Pro never receives thinkingConfig", async () => {
      const service = new GeminiImageService("AIza", noopLogger, outputDir);
      const inst = await lastInstance();
      inst.models.generateContentStream.mockResolvedValue(makeStream([chunk(imagePart("AAAA"))]));

      await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
        resolution: "2K",
        numImages: 1,
        model: "pro",
        thinkingLevel: "HIGH",
      });

      const req = inst.models.generateContentStream.mock.calls[0]![0] as {
        config: Record<string, unknown>;
      };
      expect(req.config).not.toHaveProperty("thinkingConfig");
    });
  });

  it("returns io error when writing to disk fails", async () => {
    const service = new GeminiImageService("AIza", noopLogger, outputDir);
    const inst = await lastInstance();
    inst.models.generateContentStream.mockResolvedValue(
      makeStream([chunk(imagePart("AAAA"))]),
    );

    // Make outputDir read-only by removing it
    await rm(outputDir, { recursive: true, force: true });
    // Now write a regular file at outputDir's path so join + writeFile will fail
    await writeFile(outputDir, "blocker", "utf-8");

    const result = await service.generate({
      prompt: "x",
      aspectRatio: "1:1",
      resolution: "1K",
      numImages: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("io");

    // Cleanup
    await rm(outputDir, { force: true });
  });
});
