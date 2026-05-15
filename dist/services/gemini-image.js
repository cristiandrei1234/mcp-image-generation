import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI, ApiError, PersonGeneration, ThinkingLevel } from "@google/genai";
import mime from "mime";
import { err, ok } from "../infra/result.js";
export const FLASH_MODEL_ID = "gemini-3.1-flash-image-preview";
export const PRO_MODEL_ID = "gemini-3-pro-image-preview";
/** @deprecated Use FLASH_MODEL_ID. Kept for backwards-compat with imports. */
export const MODEL_ID = FLASH_MODEL_ID;
/**
 * Picks Flash vs Pro based on explicit model and content hints.
 * Research-driven defaults: Flash unless one of the Pro triggers fires.
 */
export function chooseModel(opts) {
    if (opts.model === "flash")
        return "flash";
    if (opts.model === "pro")
        return "pro";
    // auto-routing triggers
    if (opts.hasText)
        return "pro";
    if (opts.resolution === "4K")
        return "pro";
    if ((opts.referenceImageCount ?? 0) > 3)
        return "pro";
    return "flash";
}
export function modelIdFor(resolved) {
    return resolved === "pro" ? PRO_MODEL_ID : FLASH_MODEL_ID;
}
const PERSON_MAP = {
    ALLOW_ALL: PersonGeneration.ALLOW_ALL,
    ALLOW_ADULT: PersonGeneration.ALLOW_ADULT,
    DONT_ALLOW: PersonGeneration.DONT_ALLOW,
};
const THINKING_MAP = {
    MINIMAL: ThinkingLevel.MINIMAL,
    LOW: ThinkingLevel.LOW,
    MEDIUM: ThinkingLevel.MEDIUM,
    HIGH: ThinkingLevel.HIGH,
};
export class GeminiImageService {
    logger;
    outputDir;
    client;
    constructor(apiKey, logger, outputDir) {
        this.logger = logger;
        this.outputDir = outputDir;
        this.client = new GoogleGenAI({ apiKey });
    }
    async generate(opts) {
        const correlationId = randomUUID();
        const startedAt = Date.now();
        const isEdit = (opts.referenceImages?.length ?? 0) > 0;
        const resolved = chooseModel({
            model: opts.model,
            hasText: opts.hasText,
            resolution: opts.resolution,
            referenceImageCount: opts.referenceImages?.length,
        });
        // 512 is Flash-only. Reject Pro+512 with a clear error instead of silently downgrading.
        if (resolved === "pro" && opts.resolution === "512") {
            return err({
                kind: "bad_request",
                status: 400,
                message: "Resolution 512 is only available on the Flash model. Use 1K+ for Pro, or pass model='flash'.",
            });
        }
        this.logger.info("gemini:start", {
            correlationId,
            mode: isEdit ? "edit" : "generate",
            resolvedModel: resolved,
            requestedModel: opts.model ?? "auto",
            hasTextHint: opts.hasText ?? false,
            aspectRatio: opts.aspectRatio,
            resolution: opts.resolution,
            numImages: opts.numImages,
            hasSeed: opts.seed !== undefined,
            thinkingLevel: opts.thinkingLevel,
            personGeneration: opts.personGeneration,
            promptLength: opts.prompt.length,
            referenceImageCount: opts.referenceImages?.length ?? 0,
        });
        const payload = buildGenerateContentArgs(opts, resolved);
        let stream;
        try {
            stream = await this.client.models.generateContentStream(payload);
        }
        catch (cause) {
            return err(this.mapError(cause, correlationId, startedAt));
        }
        const files = [];
        const textParts = [];
        try {
            for await (const chunk of stream) {
                const chunkParts = chunk.candidates?.[0]?.content?.parts ?? [];
                for (const part of chunkParts) {
                    const inline = part.inlineData;
                    if (inline?.data) {
                        const ext = mime.getExtension(inline.mimeType ?? "image/png") ?? "png";
                        const fname = `nb2_${Date.now()}_${files.length}.${ext}`;
                        const fpath = join(this.outputDir, fname);
                        try {
                            await writeFile(fpath, Buffer.from(inline.data, "base64"));
                        }
                        catch (cause) {
                            return err({ kind: "io", cause });
                        }
                        files.push(fpath);
                    }
                    else if (part.text) {
                        textParts.push(part.text);
                    }
                }
            }
        }
        catch (cause) {
            return err(this.mapError(cause, correlationId, startedAt));
        }
        const durationMs = Date.now() - startedAt;
        if (files.length === 0) {
            const reason = textParts.length > 0
                ? `Model returned text instead of image: ${textParts.join(" ").slice(0, 300)}`
                : "Stream finished with no image parts";
            this.logger.warn("gemini:no_image", { correlationId, durationMs, textChars: textParts.join("").length });
            return err({ kind: "no_image", reason });
        }
        this.logger.info("gemini:ok", { correlationId, files: files.length, durationMs });
        return ok({ files, textParts, correlationId, durationMs });
    }
    mapError(cause, correlationId, startedAt) {
        const durationMs = Date.now() - startedAt;
        const classified = classifyGeminiError(cause, durationMs);
        this.logError(classified, { correlationId, durationMs, cause });
        return classified;
    }
    logError(error, ctx) {
        switch (error.kind) {
            case "timeout":
                this.logger.error("gemini:timeout", { correlationId: ctx.correlationId, durationMs: ctx.durationMs });
                return;
            case "aborted":
                this.logger.error("gemini:aborted", { correlationId: ctx.correlationId, durationMs: ctx.durationMs });
                return;
            case "auth":
            case "quota":
            case "safety_block":
            case "bad_request":
            case "http":
                this.logger.error("gemini:api_error", {
                    correlationId: ctx.correlationId,
                    durationMs: ctx.durationMs,
                    kind: error.kind,
                    ...("status" in error && { status: error.status }),
                });
                return;
            case "network":
                this.logger.error("gemini:network", {
                    correlationId: ctx.correlationId,
                    durationMs: ctx.durationMs,
                    cause: ctx.cause instanceof Error ? ctx.cause.message : String(ctx.cause),
                });
                return;
            default:
                return;
        }
    }
}
export function buildGenerateContentArgs(opts, resolved) {
    const resolvedModel = resolved ??
        chooseModel({
            model: opts.model,
            hasText: opts.hasText,
            resolution: opts.resolution,
            referenceImageCount: opts.referenceImages?.length,
        });
    const parts = [];
    for (const ref of opts.referenceImages ?? []) {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data.toString("base64") } });
    }
    parts.push({ text: opts.prompt });
    // Pro is locked at max thinking; per research, do not pass thinkingConfig to it.
    const includeThinking = resolvedModel === "flash" && opts.thinkingLevel !== undefined;
    return {
        model: modelIdFor(resolvedModel),
        config: {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: opts.aspectRatio,
                imageSize: opts.resolution,
                ...(opts.personGeneration && { personGeneration: PERSON_MAP[opts.personGeneration] }),
            },
            ...(includeThinking && {
                thinkingConfig: { thinkingLevel: THINKING_MAP[opts.thinkingLevel] },
            }),
            ...(opts.seed !== undefined && { seed: opts.seed }),
            candidateCount: opts.numImages,
        },
        contents: [{ role: "user", parts }],
    };
}
export function classifyGeminiError(cause, durationMs) {
    if (cause instanceof DOMException) {
        if (cause.name === "TimeoutError")
            return { kind: "timeout", timeoutMs: durationMs };
        if (cause.name === "AbortError")
            return { kind: "aborted" };
    }
    if (cause instanceof ApiError) {
        const status = cause.status;
        const msg = cause.message ?? "";
        const isSafety = /safety|blocked|prohibited content|policy/i.test(msg);
        if (status === 401 || status === 403) {
            return { kind: "auth", status, message: msg };
        }
        if (status === 429) {
            return { kind: "quota" };
        }
        if (status === 400 && isSafety) {
            return { kind: "safety_block", reason: msg };
        }
        if (status >= 400 && status < 500) {
            return { kind: "bad_request", status, message: msg };
        }
        return {
            kind: "http",
            status,
            statusText: cause.name ?? "ApiError",
            body: msg,
        };
    }
    return { kind: "network", cause };
}
