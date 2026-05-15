import { describe, expect, it } from "vitest";
import {
  chooseModel,
  modelIdFor,
  FLASH_MODEL_ID,
  PRO_MODEL_ID,
} from "../../../src/services/gemini-image.js";

describe("chooseModel", () => {
  describe("explicit choice always wins", () => {
    it("model='flash' stays Flash even when hints want Pro", () => {
      expect(
        chooseModel({ model: "flash", hasText: true, resolution: "4K", referenceImageCount: 14 }),
      ).toBe("flash");
    });

    it("model='pro' stays Pro even with no hints", () => {
      expect(chooseModel({ model: "pro", resolution: "1K" })).toBe("pro");
    });
  });

  describe("auto routing — Pro triggers", () => {
    it("hasText=true escalates to Pro", () => {
      expect(chooseModel({ model: "auto", hasText: true, resolution: "1K" })).toBe("pro");
    });

    it("resolution 4K escalates to Pro", () => {
      expect(chooseModel({ model: "auto", resolution: "4K" })).toBe("pro");
    });

    it("more than 3 reference images escalates to Pro", () => {
      expect(chooseModel({ model: "auto", resolution: "1K", referenceImageCount: 4 })).toBe("pro");
    });

    it("exactly 3 reference images stays on Flash", () => {
      expect(chooseModel({ model: "auto", resolution: "1K", referenceImageCount: 3 })).toBe("flash");
    });

    it("default (no hints) is Flash", () => {
      expect(chooseModel({ resolution: "1K" })).toBe("flash");
    });

    it("Flash holds for 1K/2K with no text and few refs", () => {
      for (const r of ["512", "1K", "2K"] as const) {
        expect(chooseModel({ model: "auto", resolution: r, referenceImageCount: 2 })).toBe("flash");
      }
    });
  });

  describe("modelIdFor", () => {
    it("maps 'flash' to the Flash 3.1 preview id", () => {
      expect(modelIdFor("flash")).toBe(FLASH_MODEL_ID);
      expect(FLASH_MODEL_ID).toBe("gemini-3.1-flash-image-preview");
    });
    it("maps 'pro' to the Gemini 3 Pro Image preview id", () => {
      expect(modelIdFor("pro")).toBe(PRO_MODEL_ID);
      expect(PRO_MODEL_ID).toBe("gemini-3-pro-image-preview");
    });
  });
});
