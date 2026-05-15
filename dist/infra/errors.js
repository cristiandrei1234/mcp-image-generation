export function formatGeminiError(error) {
    switch (error.kind) {
        case "timeout":
            return `Request timed out after ${error.timeoutMs}ms`;
        case "aborted":
            return "Request was aborted by the caller";
        case "network":
            return `Network error: ${String(error.cause)}`;
        case "http":
            return `HTTP ${error.status} ${error.statusText}${error.body ? ` — ${error.body.slice(0, 200)}` : ""}`;
        case "quota":
            return `Quota exceeded${error.retryAfterMs ? ` (retry after ${error.retryAfterMs}ms)` : ""}`;
        case "safety_block":
            return `Generation blocked by safety policy: ${error.reason}`;
        case "auth":
            return `Authentication failed (HTTP ${error.status}): ${error.message}. Check your GEMINI API key.`;
        case "bad_request":
            return `Bad request (HTTP ${error.status}): ${error.message}`;
        case "no_image":
            return `Model returned no image: ${error.reason}`;
        case "parse":
            return `Failed to parse response: ${String(error.cause)}`;
        case "validation":
            return `Input validation failed: ${error.issues
                .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; ")}`;
        case "io":
            return `File I/O error: ${String(error.cause)}`;
    }
}
