import { describe, it, expect, vi } from "vitest";
import { computeDelayMs, shouldRetry, withRetry } from "../../../src/infra/retry.js";
import { ok, err, type Result } from "../../../src/infra/result.js";
import type { GeminiError } from "../../../src/infra/errors.js";

describe("shouldRetry", () => {
  const retryable: GeminiError[] = [
    { kind: "timeout", timeoutMs: 100 },
    { kind: "network", cause: new Error("x") },
    { kind: "quota" },
    { kind: "http", status: 500, statusText: "ISE" },
    { kind: "http", status: 503, statusText: "U" },
    { kind: "http", status: 408, statusText: "Timeout" },
  ];
  const nonRetryable: GeminiError[] = [
    { kind: "aborted" },
    { kind: "auth", status: 401, message: "x" },
    { kind: "safety_block", reason: "x" },
    { kind: "bad_request", status: 400, message: "x" },
    { kind: "no_image", reason: "x" },
    { kind: "parse", cause: new Error("x") },
    { kind: "validation", issues: [] },
    { kind: "io", cause: new Error("x") },
    { kind: "http", status: 404, statusText: "NF" },
    { kind: "http", status: 401, statusText: "U" },
  ];

  for (const e of retryable) {
    it(`retries ${e.kind}${"status" in e ? `:${e.status}` : ""}`, () => {
      expect(shouldRetry(e)).toBe(true);
    });
  }
  for (const e of nonRetryable) {
    it(`does NOT retry ${e.kind}${"status" in e ? `:${e.status}` : ""}`, () => {
      expect(shouldRetry(e)).toBe(false);
    });
  }
});

describe("computeDelayMs", () => {
  it("exponential backoff without jitter", () => {
    const o = { baseDelayMs: 100, maxDelayMs: 10_000, jitter: false };
    expect(computeDelayMs(1, o)).toBe(100);
    expect(computeDelayMs(2, o)).toBe(200);
    expect(computeDelayMs(3, o)).toBe(400);
    expect(computeDelayMs(10, o)).toBe(10_000); // capped
  });

  it("jitter ≤ exponential cap", () => {
    const o = { baseDelayMs: 100, maxDelayMs: 10_000, jitter: true };
    for (let i = 0; i < 50; i++) {
      const d = computeDelayMs(3, o);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(400);
    }
  });

  it("honors retryAfterMs when error is quota", () => {
    const o = { baseDelayMs: 100, maxDelayMs: 10_000, jitter: false };
    const d = computeDelayMs(1, o, { kind: "quota", retryAfterMs: 2500 });
    expect(d).toBe(2500);
  });

  it("caps retryAfterMs at maxDelayMs", () => {
    const o = { baseDelayMs: 100, maxDelayMs: 5_000, jitter: false };
    const d = computeDelayMs(1, o, { kind: "quota", retryAfterMs: 60_000 });
    expect(d).toBe(5_000);
  });
});

describe("withRetry", () => {
  function makeSleep() {
    const sleeps: number[] = [];
    return {
      sleeps,
      fn: vi.fn(async (ms: number) => {
        sleeps.push(ms);
      }),
    };
  }

  it("returns ok on first attempt", async () => {
    const fn = vi.fn(async () => ok(42) as Result<number, GeminiError>);
    const { fn: sleep } = makeSleep();
    const result = await withRetry(fn, {}, sleep);

    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries on retryable error and eventually succeeds", async () => {
    const fn = vi
      .fn<() => Promise<Result<string, GeminiError>>>()
      .mockResolvedValueOnce(err({ kind: "network", cause: "x" }))
      .mockResolvedValueOnce(err({ kind: "network", cause: "x" }))
      .mockResolvedValueOnce(ok("done"));
    const { fn: sleep, sleeps } = makeSleep();

    const result = await withRetry(fn, { jitter: false, baseDelayMs: 100, maxDelayMs: 10_000 }, sleep);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("done");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it("does not retry on non-retryable error", async () => {
    const fn = vi
      .fn<() => Promise<Result<unknown, GeminiError>>>()
      .mockResolvedValueOnce(err({ kind: "auth", status: 401, message: "bad key" }));
    const { fn: sleep } = makeSleep();

    const result = await withRetry(fn, {}, sleep);

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops at maxAttempts and returns the last error", async () => {
    const fn = vi
      .fn<() => Promise<Result<unknown, GeminiError>>>()
      .mockResolvedValue(err({ kind: "quota" }));
    const { fn: sleep, sleeps } = makeSleep();

    const result = await withRetry(fn, { maxAttempts: 3, jitter: false, baseDelayMs: 100 }, sleep);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("quota");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it("treats maxAttempts=1 as no retries", async () => {
    const fn = vi
      .fn<() => Promise<Result<unknown, GeminiError>>>()
      .mockResolvedValue(err({ kind: "network", cause: "x" }));
    const { fn: sleep } = makeSleep();

    await withRetry(fn, { maxAttempts: 1 }, sleep);

    expect(fn).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
