import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { err, ok } from "../infra/result.js";
import { buildGenerateContentArgs, classifyGeminiError, MODEL_ID, } from "./gemini-image.js";
export class GeminiBatchService {
    logger;
    outputDir;
    client;
    constructor(apiKey, logger, outputDir) {
        this.logger = logger;
        this.outputDir = outputDir;
        this.client = new GoogleGenAI({ apiKey });
    }
    async submit(opts) {
        const correlationId = randomUUID();
        const startedAt = Date.now();
        if (opts.requests.length === 0) {
            return err({
                kind: "bad_request",
                status: 400,
                message: "requests array must contain at least one request",
            });
        }
        this.logger.info("batch:submit", {
            correlationId,
            requestCount: opts.requests.length,
            displayName: opts.displayName,
        });
        const inlinedRequests = opts.requests.map((req) => {
            const args = buildGenerateContentArgs(req);
            return {
                model: args.model,
                contents: args.contents,
                config: args.config,
            };
        });
        try {
            const job = await this.client.batches.create({
                model: MODEL_ID,
                src: inlinedRequests,
                ...(opts.displayName && { config: { displayName: opts.displayName } }),
            });
            this.logger.info("batch:submitted", {
                correlationId,
                name: job.name,
                state: job.state,
                durationMs: Date.now() - startedAt,
            });
            return ok(summarize(job));
        }
        catch (cause) {
            const error = classifyGeminiError(cause, Date.now() - startedAt);
            this.logger.error("batch:submit_failed", {
                correlationId,
                kind: error.kind,
                durationMs: Date.now() - startedAt,
            });
            return err(error);
        }
    }
    async get(name) {
        if (!isLikelyBatchName(name)) {
            return err({ kind: "bad_request", status: 400, message: `"${name}" is not a batch job name` });
        }
        const startedAt = Date.now();
        try {
            const job = await this.client.batches.get({ name });
            return ok(summarize(job));
        }
        catch (cause) {
            return err(classifyGeminiError(cause, Date.now() - startedAt));
        }
    }
    async list(pageSize = 20) {
        const startedAt = Date.now();
        try {
            const pager = await this.client.batches.list({ config: { pageSize } });
            const jobs = [];
            for (const job of pager.page) {
                jobs.push(summarize(job));
            }
            return ok(jobs);
        }
        catch (cause) {
            return err(classifyGeminiError(cause, Date.now() - startedAt));
        }
    }
    async cancel(name) {
        if (!isLikelyBatchName(name)) {
            return err({ kind: "bad_request", status: 400, message: `"${name}" is not a batch job name` });
        }
        const startedAt = Date.now();
        try {
            await this.client.batches.cancel({ name });
            this.logger.info("batch:cancelled", { name });
            return ok(undefined);
        }
        catch (cause) {
            return err(classifyGeminiError(cause, Date.now() - startedAt));
        }
    }
    async getResults(name) {
        if (!isLikelyBatchName(name)) {
            return err({ kind: "bad_request", status: 400, message: `"${name}" is not a batch job name` });
        }
        const correlationId = randomUUID();
        const startedAt = Date.now();
        let job;
        try {
            job = await this.client.batches.get({ name });
        }
        catch (cause) {
            return err(classifyGeminiError(cause, Date.now() - startedAt));
        }
        const state = job.state ?? "JOB_STATE_UNSPECIFIED";
        const isTerminal = state === "JOB_STATE_SUCCEEDED" ||
            state === "JOB_STATE_FAILED" ||
            state === "JOB_STATE_CANCELLED" ||
            state === "JOB_STATE_EXPIRED";
        if (!isTerminal) {
            return ok({ state, files: [], errors: [], totalResponses: 0 });
        }
        const responses = job.dest?.inlinedResponses ?? [];
        const files = [];
        const errors = [];
        const shortId = (job.name ?? randomUUID()).split("/").pop() ?? "batch";
        for (let i = 0; i < responses.length; i++) {
            const r = responses[i];
            if (r.error) {
                errors.push(`#${i}: ${r.error.message ?? String(r.error)}`);
                continue;
            }
            const parts = r.response?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
                const inline = part.inlineData;
                if (inline?.data) {
                    const ext = mime.getExtension(inline.mimeType ?? "image/png") ?? "png";
                    const fname = `batch_${shortId}_${i}_${files.length}.${ext}`;
                    const fpath = join(this.outputDir, fname);
                    try {
                        await writeFile(fpath, Buffer.from(inline.data, "base64"));
                        files.push(fpath);
                    }
                    catch (cause) {
                        return err({ kind: "io", cause });
                    }
                }
            }
        }
        this.logger.info("batch:results", {
            correlationId,
            name,
            state,
            files: files.length,
            errors: errors.length,
            durationMs: Date.now() - startedAt,
        });
        return ok({ state, files, errors, totalResponses: responses.length });
    }
}
function summarize(job) {
    return {
        name: job.name ?? "",
        displayName: job.displayName,
        state: job.state ?? "JOB_STATE_UNSPECIFIED",
        createTime: job.createTime,
        endTime: job.endTime,
        ...(job.error && {
            error: { code: job.error.code, message: job.error.message },
        }),
    };
}
export function isLikelyBatchName(value) {
    return /^batches\/[A-Za-z0-9_-]+$/.test(value);
}
