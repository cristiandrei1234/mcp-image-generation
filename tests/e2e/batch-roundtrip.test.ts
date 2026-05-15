import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerBatchTools } from "../../src/tools/batch-tools.js";
import type { GeminiBatchService } from "../../src/services/gemini-batch.js";
import { ok, err } from "../../src/infra/result.js";

const defaults = { aspectRatio: "1:1" as const, resolution: "1K" as const };

function fakeService(overrides: Partial<GeminiBatchService> = {}): GeminiBatchService {
  return {
    submit: vi.fn(async () =>
      ok({ name: "batches/abc", displayName: "test", state: "JOB_STATE_QUEUED" }),
    ),
    get: vi.fn(async () => ok({ name: "batches/abc", state: "JOB_STATE_RUNNING" })),
    getResults: vi.fn(async () => ok({ state: "JOB_STATE_RUNNING", files: [], errors: [], totalResponses: 0 })),
    list: vi.fn(async () => ok([])),
    cancel: vi.fn(async () => ok(undefined)),
    ...overrides,
  } as unknown as GeminiBatchService;
}

async function makeClient(service: GeminiBatchService) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerBatchTools(server, { service, defaults });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tc", version: "0.0.1" }, { capabilities: {} });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return {
    client,
    cleanup: async () => {
      await client.close().catch(() => {});
      await server.close().catch(() => {});
    },
  };
}

describe("E2E — batch tools", () => {
  it("listTools advertises three batch tools", async () => {
    const { client, cleanup } = await makeClient(fakeService());
    try {
      const r = await client.listTools();
      const names = r.tools.map((t) => t.name).sort();
      expect(names).toEqual(["batch_generate_image", "batch_get_job", "batch_list_jobs"]);
    } finally {
      await cleanup();
    }
  });

  it("batch_generate_image submits and returns the job name", async () => {
    const service = fakeService();
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_generate_image",
        arguments: {
          requests: [{ prompt: "a", numImages: 1 }, { prompt: "b", numImages: 1 }],
          displayName: "set-1",
        },
      })) as { content: Array<{ text: string }> };

      expect(service.submit).toHaveBeenCalledOnce();
      const submitArgs = (service.submit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
        requests: Array<{ aspectRatio: string; resolution: string }>;
      };
      expect(submitArgs.requests).toHaveLength(2);
      // defaults applied
      expect(submitArgs.requests[0]!.aspectRatio).toBe("1:1");
      expect(submitArgs.requests[0]!.resolution).toBe("1K");
      expect(result.content[0]!.text).toContain("batches/abc");
    } finally {
      await cleanup();
    }
  });

  it("batch_get_job reports running state with no files", async () => {
    const service = fakeService();
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_get_job",
        arguments: { name: "batches/abc" },
      })) as { content: Array<{ text: string }> };

      expect(result.content[0]!.text).toContain("JOB_STATE_RUNNING");
      expect(result.content[0]!.text).toMatch(/poll|later|no results yet/i);
    } finally {
      await cleanup();
    }
  });

  it("batch_get_job returns file paths when completed", async () => {
    const service = fakeService({
      getResults: vi.fn(async () =>
        ok({
          state: "JOB_STATE_SUCCEEDED",
          files: ["/out/a.png", "/out/b.png"],
          errors: ["#2: safety"],
          totalResponses: 3,
        }),
      ),
    } as Partial<GeminiBatchService>);
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_get_job",
        arguments: { name: "batches/done" },
      })) as { content: Array<{ text: string }> };

      const text = result.content[0]!.text;
      expect(text).toContain("/out/a.png");
      expect(text).toContain("/out/b.png");
      expect(text).toContain("safety");
      expect(text).toContain("JOB_STATE_SUCCEEDED");
    } finally {
      await cleanup();
    }
  });

  it("batch_get_job rejects malformed name via inputSchema", async () => {
    const service = fakeService();
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_get_job",
        arguments: { name: "not-a-batch" },
      })) as { isError?: boolean };

      expect(result.isError).toBe(true);
      expect(service.getResults).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  it("batch_list_jobs renders empty list nicely", async () => {
    const { client, cleanup } = await makeClient(fakeService());
    try {
      const result = (await client.callTool({
        name: "batch_list_jobs",
        arguments: {},
      })) as { content: Array<{ text: string }> };
      expect(result.content[0]!.text).toContain("No batch jobs");
    } finally {
      await cleanup();
    }
  });

  it("batch_list_jobs renders multiple jobs", async () => {
    const service = fakeService({
      list: vi.fn(async () =>
        ok([
          { name: "batches/a", state: "JOB_STATE_SUCCEEDED", displayName: "alpha" },
          { name: "batches/b", state: "JOB_STATE_RUNNING" },
        ]),
      ),
    } as Partial<GeminiBatchService>);
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_list_jobs",
        arguments: {},
      })) as { content: Array<{ text: string }> };
      const text = result.content[0]!.text;
      expect(text).toContain("batches/a");
      expect(text).toContain("alpha");
      expect(text).toContain("batches/b");
      expect(text).toContain("JOB_STATE_RUNNING");
    } finally {
      await cleanup();
    }
  });

  it("surfaces submit errors as isError", async () => {
    const service = fakeService({
      submit: vi.fn(async () => err({ kind: "quota" as const })),
    } as Partial<GeminiBatchService>);
    const { client, cleanup } = await makeClient(service);
    try {
      const result = (await client.callTool({
        name: "batch_generate_image",
        arguments: { requests: [{ prompt: "x", numImages: 1 }] },
      })) as { isError?: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Quota");
    } finally {
      await cleanup();
    }
  });
});
