import { describe, it, expect } from "vitest";
import { GimageConfigSchema } from "../../../src/config/schema.js";

const validConfig = {
  version: 1,
  apiKey: "AIza" + "x".repeat(35),
  defaults: { aspectRatio: "1:1", resolution: "1K" },
} as const;

describe("GimageConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = GimageConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("rejects API key not starting with AIza", () => {
    const result = GimageConfigSchema.safeParse({ ...validConfig, apiKey: "sk-" + "x".repeat(40) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("apiKey"))).toBe(true);
    }
  });

  it("rejects too-short API key", () => {
    const result = GimageConfigSchema.safeParse({ ...validConfig, apiKey: "AIzaShort" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid aspect ratio", () => {
    const result = GimageConfigSchema.safeParse({
      ...validConfig,
      defaults: { aspectRatio: "100:1", resolution: "1K" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid resolution", () => {
    const result = GimageConfigSchema.safeParse({
      ...validConfig,
      defaults: { aspectRatio: "1:1", resolution: "8K" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong version", () => {
    const result = GimageConfigSchema.safeParse({ ...validConfig, version: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects missing defaults", () => {
    const result = GimageConfigSchema.safeParse({ version: 1, apiKey: validConfig.apiKey });
    expect(result.success).toBe(false);
  });
});
