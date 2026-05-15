export interface Logger {
  info(event: string, ctx?: Record<string, unknown>): void;
  warn(event: string, ctx?: Record<string, unknown>): void;
  error(event: string, ctx?: Record<string, unknown>): void;
}

const SENSITIVE_KEYS = new Set(["apikey", "api_key", "authorization", "token", "password", "secret"]);

function redact(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return ctx;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500) + `…(+${v.length - 500} chars)`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, ctx?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(ctx),
  });
  process.stderr.write(line + "\n");
}

export function createLogger(): Logger {
  return {
    info: (event, ctx) => emit("info", event, ctx),
    warn: (event, ctx) => emit("warn", event, ctx),
    error: (event, ctx) => emit("error", event, ctx),
  };
}
