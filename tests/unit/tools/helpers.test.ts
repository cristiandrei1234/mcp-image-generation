import { describe, it, expect } from "vitest";
import { errorResult, filesResult, successResult } from "../../../src/tools/helpers.js";

describe("tool helpers", () => {
  it("successResult wraps text in content", () => {
    const r = successResult("hello");
    expect(r.isError).toBeFalsy();
    expect(r.content).toEqual([{ type: "text", text: "hello" }]);
  });

  it("errorResult sets isError and formats kind", () => {
    const r = errorResult({ kind: "timeout", timeoutMs: 5000 });
    expect(r.isError).toBe(true);
    const text = (r.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("timed out");
    expect(text).toContain("5000");
  });

  it("filesResult prints header and bulleted paths", () => {
    const r = filesResult(["/a/1.png", "/b/2.png"], "Made 2 files:");
    const text = (r.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("Made 2 files:");
    expect(text).toContain("- /a/1.png");
    expect(text).toContain("- /b/2.png");
  });

  it("filesResult handles empty list", () => {
    const r = filesResult([], "Empty:");
    const text = (r.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("Empty:");
  });
});
