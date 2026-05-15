import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../../src/infra/logger.js";

describe("logger", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function lastLine(): Record<string, unknown> {
    const call = writeSpy.mock.calls.at(-1);
    if (!call) throw new Error("no log emitted");
    const raw = String(call[0]).trimEnd();
    return JSON.parse(raw);
  }

  it("emits JSON with ts, level, event", () => {
    const log = createLogger();
    log.info("test:event", { foo: "bar" });

    const entry = lastLine();
    expect(entry).toMatchObject({ level: "info", event: "test:event", foo: "bar" });
    expect(typeof entry.ts).toBe("string");
    expect(new Date(entry.ts as string).getTime()).not.toBeNaN();
  });

  it("supports warn and error levels", () => {
    const log = createLogger();
    log.warn("w:event");
    expect(lastLine().level).toBe("warn");
    log.error("e:event");
    expect(lastLine().level).toBe("error");
  });

  it("redacts sensitive keys (case-insensitive)", () => {
    const log = createLogger();
    log.info("auth:check", {
      apiKey: "AIzaSecret123",
      Authorization: "Bearer abc",
      password: "hunter2",
      token: "tok_xyz",
      secret: "s",
      visible: "ok",
    });

    const entry = lastLine();
    expect(entry.apiKey).toBe("[redacted]");
    expect(entry.Authorization).toBe("[redacted]");
    expect(entry.password).toBe("[redacted]");
    expect(entry.token).toBe("[redacted]");
    expect(entry.secret).toBe("[redacted]");
    expect(entry.visible).toBe("ok");
  });

  it("truncates long strings", () => {
    const log = createLogger();
    const huge = "x".repeat(800);
    log.info("e", { huge });

    const entry = lastLine();
    expect(String(entry.huge)).toContain("…(+300 chars)");
    expect(String(entry.huge).length).toBeLessThan(huge.length);
  });

  it("handles missing context", () => {
    const log = createLogger();
    log.info("no:ctx");
    const entry = lastLine();
    expect(entry.event).toBe("no:ctx");
  });
});
