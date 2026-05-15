import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { makeEditImageHandler, EDIT_MAX_IMAGE_BYTES } from "../../../src/tools/edit-image.js";
import type { GeminiImageService, GenerateOpts } from "../../../src/services/gemini-image.js";
import { ok } from "../../../src/infra/result.js";

const defaults = { aspectRatio: "16:9" as const, resolution: "2K" as const };

function buildService() {
  const generate = vi.fn<(opts: GenerateOpts) => ReturnType<GeminiImageService["generate"]>>(
    async () =>
      ok({
        files: ["/out/edited.png"],
        textParts: [],
        correlationId: "test",
        durationMs: 200,
      }),
  );
  return { service: { generate } as unknown as GeminiImageService, generate };
}

describe("edit_image handler", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "imgedit-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function writeFixture(name: string, bytes: number, content?: Buffer): Promise<string> {
    const path = join(tmp, name);
    const buf = content ?? Buffer.alloc(bytes, 0xab);
    await writeFile(path, buf);
    return path;
  }

  it("reads files from disk and forwards as referenceImages", async () => {
    const { service, generate } = buildService();
    const handler = makeEditImageHandler({ service, defaults });
    const p1 = await writeFixture("a.png", 1024);
    const p2 = await writeFixture("b.jpg", 2048);

    const result = await handler({
      imagePaths: [p1, p2],
      prompt: "change bg",
      numImages: 1,
    });

    expect(result.isError).toBeFalsy();
    const opts = generate.mock.calls[0]![0];
    expect(opts.referenceImages).toHaveLength(2);
    expect(opts.referenceImages![0]!.data.length).toBe(1024);
    expect(opts.referenceImages![0]!.mimeType).toBe("image/png");
    expect(opts.referenceImages![1]!.mimeType).toBe("image/jpeg");
  });

  it("returns io error when path does not exist", async () => {
    const { service } = buildService();
    const handler = makeEditImageHandler({ service, defaults });

    const result = await handler({
      imagePaths: [join(tmp, "nope.png")],
      prompt: "x",
      numImages: 1,
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("File I/O");
  });

  it("rejects images over the size cap", async () => {
    const { service } = buildService();
    const handler = makeEditImageHandler({ service, defaults });
    const huge = await writeFixture("huge.png", EDIT_MAX_IMAGE_BYTES + 1);

    const result = await handler({
      imagePaths: [huge],
      prompt: "x",
      numImages: 1,
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("Bad request");
    expect(text).toContain("413");
  });

  it("applies defaults for aspectRatio/resolution", async () => {
    const { service, generate } = buildService();
    const handler = makeEditImageHandler({ service, defaults });
    const p = await writeFixture("a.png", 100);

    await handler({ imagePaths: [p], prompt: "x", numImages: 1 });

    const opts = generate.mock.calls[0]![0];
    expect(opts.aspectRatio).toBe("16:9");
    expect(opts.resolution).toBe("2K");
  });

  it("respects explicit reframe args", async () => {
    const { service, generate } = buildService();
    const handler = makeEditImageHandler({ service, defaults });
    const p = await writeFixture("a.png", 100);

    await handler({
      imagePaths: [p],
      prompt: "reframe to vertical",
      aspectRatio: "3:4",
      resolution: "1K",
      numImages: 1,
    });

    const opts = generate.mock.calls[0]![0];
    expect(opts.aspectRatio).toBe("3:4");
    expect(opts.resolution).toBe("1K");
  });

  it("does not call service if any input file is unreadable", async () => {
    const { service, generate } = buildService();
    const handler = makeEditImageHandler({ service, defaults });
    const ok1 = await writeFixture("a.png", 100);

    await handler({
      imagePaths: [ok1, join(tmp, "ghost.png")],
      prompt: "x",
      numImages: 1,
    });

    expect(generate).not.toHaveBeenCalled();
  });
});
