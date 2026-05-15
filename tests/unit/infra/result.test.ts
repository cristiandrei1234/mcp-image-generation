import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "../../../src/infra/result.js";

describe("ok / err", () => {
  it("ok wraps a value with ok=true", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("err wraps an error with ok=false", () => {
    const r = err("nope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("nope");
  });

  it("supports type narrowing in switch", () => {
    const r: Result<number, string> = Math.random() > 2 ? ok(1) : err("x");
    // Compile-time check via runtime branch
    if (r.ok) {
      const _n: number = r.value;
      expect(typeof _n).toBe("number");
    } else {
      const _e: string = r.error;
      expect(typeof _e).toBe("string");
    }
  });
});
