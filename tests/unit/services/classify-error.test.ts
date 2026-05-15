import { describe, it, expect } from "vitest";
import { ApiError } from "@google/genai";
import { classifyGeminiError } from "../../../src/services/gemini-image.js";

describe("classifyGeminiError", () => {
  it("maps DOMException TimeoutError → timeout", () => {
    const e = new DOMException("timed out", "TimeoutError");
    const result = classifyGeminiError(e, 12345);
    expect(result.kind).toBe("timeout");
    if (result.kind === "timeout") expect(result.timeoutMs).toBe(12345);
  });

  it("maps DOMException AbortError → aborted", () => {
    const e = new DOMException("aborted", "AbortError");
    expect(classifyGeminiError(e, 100).kind).toBe("aborted");
  });

  it("maps ApiError 401 → auth", () => {
    const e = new ApiError({ status: 401, message: "Bad API key" });
    const result = classifyGeminiError(e, 0);
    expect(result.kind).toBe("auth");
    if (result.kind === "auth") {
      expect(result.status).toBe(401);
      expect(result.message).toContain("Bad API key");
    }
  });

  it("maps ApiError 403 → auth", () => {
    const e = new ApiError({ status: 403, message: "Forbidden" });
    expect(classifyGeminiError(e, 0).kind).toBe("auth");
  });

  it("maps ApiError 429 → quota", () => {
    const e = new ApiError({ status: 429, message: "Rate limit" });
    expect(classifyGeminiError(e, 0).kind).toBe("quota");
  });

  it("maps ApiError 400 with safety wording → safety_block", () => {
    const e = new ApiError({
      status: 400,
      message: "Generation blocked due to prohibited content in prompt",
    });
    const result = classifyGeminiError(e, 0);
    expect(result.kind).toBe("safety_block");
    if (result.kind === "safety_block") {
      expect(result.reason).toContain("prohibited content");
    }
  });

  it("maps ApiError 400 without safety wording → bad_request", () => {
    const e = new ApiError({ status: 400, message: "Invalid aspect ratio" });
    expect(classifyGeminiError(e, 0).kind).toBe("bad_request");
  });

  it("maps ApiError 404 → bad_request", () => {
    const e = new ApiError({ status: 404, message: "Model not found" });
    expect(classifyGeminiError(e, 0).kind).toBe("bad_request");
  });

  it("maps ApiError 500 → http", () => {
    const e = new ApiError({ status: 500, message: "Internal error" });
    const result = classifyGeminiError(e, 0);
    expect(result.kind).toBe("http");
    if (result.kind === "http") expect(result.status).toBe(500);
  });

  it("maps ApiError 503 → http", () => {
    const e = new ApiError({ status: 503, message: "Service unavailable" });
    expect(classifyGeminiError(e, 0).kind).toBe("http");
  });

  it("maps generic Error → network", () => {
    const e = new Error("ECONNREFUSED 127.0.0.1:443");
    const result = classifyGeminiError(e, 0);
    expect(result.kind).toBe("network");
    if (result.kind === "network") expect(result.cause).toBe(e);
  });

  it("maps non-Error throw → network", () => {
    const result = classifyGeminiError("just a string", 0);
    expect(result.kind).toBe("network");
  });

  it("does not classify TypeError as timeout/abort", () => {
    const e = new TypeError("foo");
    expect(classifyGeminiError(e, 0).kind).toBe("network");
  });
});
