import { describe, it, expect } from "vitest";
import { CAPABILITIES_TEXT } from "../../../src/tools/list-capabilities.js";
import { MODEL_ID } from "../../../src/services/gemini-image.js";

describe("CAPABILITIES_TEXT", () => {
  it("mentions the current model id", () => {
    expect(CAPABILITIES_TEXT).toContain(MODEL_ID);
  });

  it("lists the supported aspect ratios", () => {
    for (const ratio of ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "8:1", "1:8"]) {
      expect(CAPABILITIES_TEXT).toContain(ratio);
    }
  });

  it("lists the supported resolutions", () => {
    for (const res of ["1K", "2K", "4K"]) {
      expect(CAPABILITIES_TEXT).toContain(res);
    }
  });

  it("lists all thinking levels", () => {
    for (const level of ["MINIMAL", "LOW", "MEDIUM", "HIGH"]) {
      expect(CAPABILITIES_TEXT).toContain(level);
    }
  });

  it("lists all person generation policies", () => {
    for (const pol of ["ALLOW_ALL", "ALLOW_ADULT", "DONT_ALLOW"]) {
      expect(CAPABILITIES_TEXT).toContain(pol);
    }
  });

  it("references the three tools", () => {
    expect(CAPABILITIES_TEXT).toContain("generate_image");
    expect(CAPABILITIES_TEXT).toContain("edit_image");
    expect(CAPABILITIES_TEXT).toContain("list_capabilities");
  });
});
