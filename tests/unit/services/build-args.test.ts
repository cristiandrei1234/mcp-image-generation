import { describe, expect, it } from "vitest";
import { buildGenerateContentArgs, MODEL_ID } from "../../../src/services/gemini-image.js";

const base = {
  prompt: "a cat",
  aspectRatio: "16:9" as const,
  resolution: "2K" as const,
  numImages: 1,
};

describe("buildGenerateContentArgs", () => {
  it("uses MODEL_ID and IMAGE modality", () => {
    const args = buildGenerateContentArgs(base);
    expect(args.model).toBe(MODEL_ID);
    expect(args.config.responseModalities).toEqual(["IMAGE"]);
  });

  it("maps aspectRatio and resolution into imageConfig", () => {
    const args = buildGenerateContentArgs(base);
    expect(args.config.imageConfig.aspectRatio).toBe("16:9");
    expect(args.config.imageConfig.imageSize).toBe("2K");
  });

  it("omits seed/thinkingConfig/personGeneration when absent", () => {
    const args = buildGenerateContentArgs(base);
    expect(args.config.seed).toBeUndefined();
    expect(args.config.thinkingConfig).toBeUndefined();
    expect(args.config.imageConfig.personGeneration).toBeUndefined();
  });

  it("includes seed when provided", () => {
    const args = buildGenerateContentArgs({ ...base, seed: 7 });
    expect(args.config.seed).toBe(7);
  });

  it("maps thinkingLevel HIGH → enum value", () => {
    const args = buildGenerateContentArgs({ ...base, thinkingLevel: "HIGH" });
    expect(args.config.thinkingConfig?.thinkingLevel).toBe("HIGH");
  });

  it("maps personGeneration DONT_ALLOW → enum", () => {
    const args = buildGenerateContentArgs({ ...base, personGeneration: "DONT_ALLOW" });
    expect(args.config.imageConfig.personGeneration).toBe("DONT_ALLOW");
  });

  it("text-only request has a single text part", () => {
    const args = buildGenerateContentArgs(base);
    expect(args.contents[0]!.parts).toHaveLength(1);
    expect(args.contents[0]!.parts[0]).toMatchObject({ text: "a cat" });
  });

  it("reference images precede the text part", () => {
    const args = buildGenerateContentArgs({
      ...base,
      referenceImages: [
        { data: Buffer.from([1, 2, 3]), mimeType: "image/png" },
        { data: Buffer.from([4, 5]), mimeType: "image/jpeg" },
      ],
    });
    const parts = args.contents[0]!.parts;
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveProperty("inlineData");
    expect((parts[0] as { inlineData: { mimeType: string } }).inlineData.mimeType).toBe("image/png");
    expect(parts[2]).toMatchObject({ text: "a cat" });
  });

  it("base64-encodes reference image buffers", () => {
    const args = buildGenerateContentArgs({
      ...base,
      referenceImages: [{ data: Buffer.from("hello"), mimeType: "image/png" }],
    });
    const part = args.contents[0]!.parts[0] as { inlineData: { data: string } };
    expect(Buffer.from(part.inlineData.data, "base64").toString()).toBe("hello");
  });

  it("candidateCount tracks numImages", () => {
    const args = buildGenerateContentArgs({ ...base, numImages: 4 });
    expect(args.config.candidateCount).toBe(4);
  });
});
