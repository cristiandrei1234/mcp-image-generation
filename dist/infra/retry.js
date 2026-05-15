const DEFAULTS = {
    maxAttempts: 3,
    baseDelayMs: 250,
    maxDelayMs: 10_000,
    jitter: true,
};
export function shouldRetry(error) {
    switch (error.kind) {
        case "timeout":
        case "network":
        case "quota":
            return true;
        case "http":
            return error.status >= 500 || error.status === 408;
        case "aborted":
        case "auth":
        case "safety_block":
        case "bad_request":
        case "no_image":
        case "parse":
        case "validation":
        case "io":
            return false;
    }
}
export function computeDelayMs(attempt, opts, error) {
    if (error?.kind === "quota" && typeof error.retryAfterMs === "number") {
        return Math.min(error.retryAfterMs, opts.maxDelayMs);
    }
    const exp = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
    return opts.jitter ? Math.random() * exp : exp;
}
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function withRetry(fn, opts = {}, sleep = defaultSleep) {
    const maxAttempts = opts.maxAttempts ?? DEFAULTS.maxAttempts;
    const baseDelayMs = opts.baseDelayMs ?? DEFAULTS.baseDelayMs;
    const maxDelayMs = opts.maxDelayMs ?? DEFAULTS.maxDelayMs;
    const jitter = opts.jitter ?? DEFAULTS.jitter;
    const logger = opts.logger;
    let lastResult;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await fn();
        if (result.ok) {
            if (attempt > 1) {
                logger?.info("retry:succeeded", { attempt });
            }
            return result;
        }
        lastResult = result;
        if (!shouldRetry(result.error) || attempt === maxAttempts) {
            if (attempt > 1) {
                logger?.warn("retry:exhausted", { attempt, kind: result.error.kind });
            }
            return result;
        }
        const delay = computeDelayMs(attempt, { baseDelayMs, maxDelayMs, jitter }, result.error);
        logger?.warn("retry:scheduled", {
            attempt,
            nextAttempt: attempt + 1,
            kind: result.error.kind,
            delayMs: Math.round(delay),
        });
        await sleep(delay);
    }
    // Unreachable: the loop returns inside on the final attempt.
    return lastResult;
}
