const SENSITIVE_KEYS = new Set(["apikey", "api_key", "authorization", "token", "password", "secret"]);
function redact(ctx) {
    if (!ctx)
        return ctx;
    const out = {};
    for (const [k, v] of Object.entries(ctx)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) {
            out[k] = "[redacted]";
        }
        else if (typeof v === "string" && v.length > 500) {
            out[k] = v.slice(0, 500) + `…(+${v.length - 500} chars)`;
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
function emit(level, event, ctx) {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        event,
        ...redact(ctx),
    });
    process.stderr.write(line + "\n");
}
export function createLogger() {
    return {
        info: (event, ctx) => emit("info", event, ctx),
        warn: (event, ctx) => emit("warn", event, ctx),
        error: (event, ctx) => emit("error", event, ctx),
    };
}
