import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerGenerateImage } from "../../src/tools/generate-image.js";
import { registerEditImage } from "../../src/tools/edit-image.js";
import { registerListCapabilities } from "../../src/tools/list-capabilities.js";
import type { GeminiImageService, GenerateOpts } from "../../src/services/gemini-image.js";
import { ok, err } from "../../src/infra/result.js";

const defaults = { aspectRatio: "1:1" as const, resolution: "1K" as const };

function buildService(impl: (opts: GenerateOpts) => Awaited<ReturnType<GeminiImageService["generate"]>>) {
  const generate = vi.fn((opts: GenerateOpts) => impl(opts));
  return { service: { generate } as unknown as GeminiImageService, generate };
}

async function makeServerAndClient(service: GeminiImageService) {
  const server = new McpServer({ name: "image-generation-test", version: "0.0.1" });
  registerGenerateImage(server, { service, defaults });
  registerEditImage(server, { service, defaults });
  registerListCapabilities(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: {} });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const cleanup = async () => {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  };

  return { server, client, cleanup };
}

describe("E2E — MCP roundtrip via InMemoryTransport", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "imge2e-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("listTools returns generate_image, edit_image, list_capabilities", async () => {
    const { service } = buildService(() =>
      ok({ files: [], textParts: [], correlationId: "c", durationMs: 0 }),
    );
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = await client.listTools();
      const names = result.tools.map((t) => t.name).sort();
      expect(names).toEqual(["edit_image", "generate_image", "list_capabilities"]);
    } finally {
      await cleanup();
    }
  });

  it("each tool advertises its inputSchema with the expected fields", async () => {
    const { service } = buildService(() =>
      ok({ files: [], textParts: [], correlationId: "c", durationMs: 0 }),
    );
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = await client.listTools();
      const gen = result.tools.find((t) => t.name === "generate_image")!;
      expect(gen.inputSchema).toBeDefined();
      const props = (gen.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      for (const key of [
        "prompt",
        "aspectRatio",
        "resolution",
        "numImages",
        "seed",
        "thinkingLevel",
        "personGeneration",
      ]) {
        expect(props).toHaveProperty(key);
      }
      const edit = result.tools.find((t) => t.name === "edit_image")!;
      const editProps = (edit.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(editProps).toHaveProperty("imagePaths");
    } finally {
      await cleanup();
    }
  });

  it("callTool list_capabilities returns the static description", async () => {
    const { service } = buildService(() =>
      ok({ files: [], textParts: [], correlationId: "c", durationMs: 0 }),
    );
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = (await client.callTool({ name: "list_capabilities", arguments: {} })) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(result.content[0]!.text).toContain("gemini-3.1-flash-image-preview");
      expect(result.content[0]!.text).toContain("1:1");
    } finally {
      await cleanup();
    }
  });

  it("callTool generate_image invokes service and returns file paths", async () => {
    const { service, generate } = buildService(() =>
      ok({
        files: [join(outputDir, "out.png")],
        textParts: [],
        correlationId: "c",
        durationMs: 250,
      }),
    );
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = (await client.callTool({
        name: "generate_image",
        arguments: { prompt: "a red apple on a wooden table" },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      expect(result.isError).toBeFalsy();
      expect(result.content[0]!.text).toContain("out.png");
      expect(generate).toHaveBeenCalledOnce();
      const opts = generate.mock.calls[0]![0];
      expect(opts.prompt).toBe("a red apple on a wooden table");
      // defaults applied
      expect(opts.aspectRatio).toBe("1:1");
      expect(opts.resolution).toBe("1K");
    } finally {
      await cleanup();
    }
  });

  it("callTool generate_image surfaces service errors as isError result", async () => {
    const { service } = buildService(() => err({ kind: "quota" as const }));
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = (await client.callTool({
        name: "generate_image",
        arguments: { prompt: "x" },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Quota");
    } finally {
      await cleanup();
    }
  });

  it("input validation rejects empty prompt with a structured error", async () => {
    const { service, generate } = buildService(() =>
      ok({ files: [], textParts: [], correlationId: "c", durationMs: 0 }),
    );
    const { client, cleanup } = await makeServerAndClient(service);

    try {
      const result = (await client.callTool({
        name: "generate_image",
        arguments: { prompt: "" },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/validation|too_small|prompt/i);
      // The handler must not be invoked when input is invalid.
      expect(generate).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });
});
