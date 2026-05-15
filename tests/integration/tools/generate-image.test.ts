import { describe, it, expect, vi } from "vitest";
import { makeGenerateImageHandler } from "../../../src/tools/generate-image.js";
import type { GeminiImageService, GenerateOpts } from "../../../src/services/gemini-image.js";
import { ok, err } from "../../../src/infra/result.js";

const defaults = { aspectRatio: "16:9" as const, resolution: "2K" as const };

function buildService(impl: (opts: GenerateOpts) => Awaited<ReturnType<GeminiImageService["generate"]>>) {
  const generate = vi.fn(async (opts: GenerateOpts) => impl(opts));
  return { service: { generate } as unknown as GeminiImageService, generate };
}

describe("generate_image handler", () => {
  it("applies config defaults when args omit aspectRatio/resolution", async () => {
    const { service, generate } = buildService(() =>
      ok({
        files: ["/tmp/a.png"],
        textParts: [],
        correlationId: "test",
        durationMs: 100,
      }),
    );
    const handler = makeGenerateImageHandler({ service, defaults });

    await handler({ prompt: "a cat", numImages: 1 });

    expect(generate).toHaveBeenCalledOnce();
    const opts = generate.mock.calls[0]![0];
    expect(opts.aspectRatio).toBe("16:9");
    expect(opts.resolution).toBe("2K");
    expect(opts.prompt).toBe("a cat");
    expect(opts.numImages).toBe(1);
    expect(opts.referenceImages).toBeUndefined();
  });

  it("forwards explicit aspectRatio/resolution over defaults", async () => {
    const { service, generate } = buildService(() =>
      ok({ files: ["/tmp/a.png"], textParts: [], correlationId: "c", durationMs: 50 }),
    );
    const handler = makeGenerateImageHandler({ service, defaults });

    await handler({
      prompt: "x",
      aspectRatio: "9:16",
      resolution: "4K",
      numImages: 2,
      seed: 42,
      thinkingLevel: "HIGH",
      personGeneration: "DONT_ALLOW",
    });

    const opts = generate.mock.calls[0]![0];
    expect(opts.aspectRatio).toBe("9:16");
    expect(opts.resolution).toBe("4K");
    expect(opts.numImages).toBe(2);
    expect(opts.seed).toBe(42);
    expect(opts.thinkingLevel).toBe("HIGH");
    expect(opts.personGeneration).toBe("DONT_ALLOW");
  });

  it("returns a success result with file paths", async () => {
    const { service } = buildService(() =>
      ok({
        files: ["/out/a.png", "/out/b.png"],
        textParts: [],
        correlationId: "c",
        durationMs: 1234,
      }),
    );
    const handler = makeGenerateImageHandler({ service, defaults });

    const result = await handler({ prompt: "x", numImages: 2 });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("/out/a.png");
    expect(text).toContain("/out/b.png");
    expect(text).toContain("1234ms");
    expect(text).toContain("Generated 2");
  });

  it("returns an error result on service failure", async () => {
    const { service } = buildService(() =>
      err({ kind: "quota" as const }),
    );
    const handler = makeGenerateImageHandler({ service, defaults });

    const result = await handler({ prompt: "x", numImages: 1 });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("Quota");
  });

  it("does not include referenceImages (generate path)", async () => {
    const { service, generate } = buildService(() =>
      ok({ files: ["/o.png"], textParts: [], correlationId: "c", durationMs: 0 }),
    );
    const handler = makeGenerateImageHandler({ service, defaults });

    await handler({ prompt: "x", numImages: 1 });

    const opts = generate.mock.calls[0]![0];
    expect(opts.referenceImages).toBeUndefined();
  });
});
