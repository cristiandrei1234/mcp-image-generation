import { describe, it, expect } from "vitest";
import { formatGeminiError, type GeminiError } from "../../../src/infra/errors.js";

describe("formatGeminiError", () => {
  const cases: Array<{ name: string; error: GeminiError; contains: string[] }> = [
    {
      name: "timeout",
      error: { kind: "timeout", timeoutMs: 12000 },
      contains: ["timed out", "12000"],
    },
    {
      name: "aborted",
      error: { kind: "aborted" },
      contains: ["aborted"],
    },
    {
      name: "network",
      error: { kind: "network", cause: new Error("ECONNREFUSED") },
      contains: ["Network", "ECONNREFUSED"],
    },
    {
      name: "http",
      error: { kind: "http", status: 502, statusText: "Bad Gateway", body: "upstream down" },
      contains: ["502", "Bad Gateway", "upstream down"],
    },
    {
      name: "quota with retry",
      error: { kind: "quota", retryAfterMs: 5000 },
      contains: ["Quota", "5000"],
    },
    {
      name: "quota no retry",
      error: { kind: "quota" },
      contains: ["Quota"],
    },
    {
      name: "safety_block",
      error: { kind: "safety_block", reason: "prohibited content" },
      contains: ["safety", "prohibited content"],
    },
    {
      name: "auth",
      error: { kind: "auth", status: 401, message: "Invalid key" },
      contains: ["Authentication", "401", "Invalid key"],
    },
    {
      name: "bad_request",
      error: { kind: "bad_request", status: 400, message: "Invalid aspect ratio" },
      contains: ["Bad request", "400", "Invalid aspect ratio"],
    },
    {
      name: "no_image",
      error: { kind: "no_image", reason: "Model returned text only" },
      contains: ["no image", "Model returned text only"],
    },
    {
      name: "parse",
      error: { kind: "parse", cause: new SyntaxError("Unexpected token") },
      contains: ["parse", "Unexpected token"],
    },
    {
      name: "validation",
      error: {
        kind: "validation",
        issues: [
          // Minimal shape — ZodIssue requires path[], message, code
          { code: "custom", path: ["prompt"], message: "Too short" } as never,
          { code: "custom", path: [], message: "Root error" } as never,
        ],
      },
      contains: ["validation", "prompt: Too short", "(root): Root error"],
    },
    {
      name: "io",
      error: { kind: "io", cause: new Error("EACCES") },
      contains: ["File I/O", "EACCES"],
    },
  ];

  for (const c of cases) {
    it(`formats ${c.name}`, () => {
      const msg = formatGeminiError(c.error);
      for (const needle of c.contains) {
        expect(msg).toContain(needle);
      }
    });
  }

  it("truncates very long http bodies", () => {
    const body = "x".repeat(1000);
    const msg = formatGeminiError({ kind: "http", status: 500, statusText: "ISE", body });
    expect(msg.length).toBeLessThan(500);
  });
});
