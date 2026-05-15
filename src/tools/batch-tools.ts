import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeminiBatchService } from "../services/gemini-batch.js";
import type { GimageConfig } from "../config/schema.js";
import {
  AspectRatioSchema,
  ModelChoiceSchema,
  PersonGenerationSchema,
  ResolutionSchema,
  ThinkingLevelSchema,
} from "../config/schema.js";
import { errorResult, successResult } from "./helpers.js";

const RequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspectRatio: AspectRatioSchema.optional(),
  resolution: ResolutionSchema.optional(),
  numImages: z.number().int().min(1).max(4).default(1),
  seed: z.number().int().optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
  personGeneration: PersonGenerationSchema.optional(),
  model: ModelChoiceSchema.optional().default("auto"),
  hasText: z.boolean().optional(),
});

const submitShape = {
  requests: z
    .array(RequestSchema)
    .min(1)
    .max(100)
    .describe(
      "Array of independent image-generation requests (1–100). Each entry is the same shape as generate_image's input. The job is processed asynchronously by Google; results come back in up to 24h at 50% of the per-image price.",
    ),
  displayName: z
    .string()
    .max(200)
    .optional()
    .describe("Human-readable label for the batch job, shown in `batch_list_jobs`."),
};

const nameShape = {
  name: z
    .string()
    .regex(/^batches\/[A-Za-z0-9_-]+$/, "Must be a batch job name like 'batches/abc123'")
    .describe("Full batch job name returned by batch_generate_image, e.g. 'batches/abc123'."),
};

export type BatchToolsDeps = {
  service: GeminiBatchService;
  defaults: GimageConfig["defaults"];
};

export function makeBatchSubmitHandler(deps: BatchToolsDeps) {
  return async (args: {
    requests: Array<z.infer<typeof RequestSchema>>;
    displayName?: string;
  }) => {
    const result = await deps.service.submit({
      requests: args.requests.map((r) => ({
        prompt: r.prompt,
        aspectRatio: r.aspectRatio ?? deps.defaults.aspectRatio,
        resolution: r.resolution ?? deps.defaults.resolution,
        numImages: r.numImages,
        seed: r.seed,
        thinkingLevel: r.thinkingLevel,
        personGeneration: r.personGeneration,
        model: r.model,
        hasText: r.hasText,
      })),
      displayName: args.displayName,
    });
    if (!result.ok) return errorResult(result.error);
    const j = result.value;
    return successResult(
      `Batch job submitted.\n  name:        ${j.name}\n  displayName: ${j.displayName ?? "(none)"}\n  state:       ${j.state}\n\nUse batch_get_job to poll status; once state is JOB_STATE_SUCCEEDED, the same call will download the images.`,
    );
  };
}

export function makeBatchGetHandler(deps: BatchToolsDeps) {
  return async (args: { name: string }) => {
    const result = await deps.service.getResults(args.name);
    if (!result.ok) return errorResult(result.error);
    const v = result.value;
    if (v.files.length === 0 && v.errors.length === 0) {
      return successResult(
        `Batch ${args.name} is in state ${v.state}.\nNo results yet — call again later. Typical completion: up to 24h.`,
      );
    }
    const lines: string[] = [`Batch ${args.name} — state ${v.state}`];
    if (v.files.length > 0) {
      lines.push(`\n${v.files.length} image(s) downloaded:`);
      for (const f of v.files) lines.push(`  - ${f}`);
    }
    if (v.errors.length > 0) {
      lines.push(`\n${v.errors.length} request(s) failed:`);
      for (const e of v.errors) lines.push(`  - ${e}`);
    }
    return successResult(lines.join("\n"));
  };
}

export function makeBatchListHandler(deps: BatchToolsDeps) {
  return async () => {
    const result = await deps.service.list();
    if (!result.ok) return errorResult(result.error);
    if (result.value.length === 0) {
      return successResult("No batch jobs found.");
    }
    const lines = ["Batch jobs (most recent first):", ""];
    for (const j of result.value) {
      lines.push(`  ${j.name}`);
      lines.push(`    state:       ${j.state}`);
      lines.push(`    displayName: ${j.displayName ?? "(none)"}`);
      if (j.createTime) lines.push(`    created:     ${j.createTime}`);
      if (j.endTime) lines.push(`    ended:       ${j.endTime}`);
      if (j.error?.message) lines.push(`    error:       ${j.error.message}`);
      lines.push("");
    }
    return successResult(lines.join("\n").trimEnd());
  };
}

export function registerBatchTools(server: McpServer, deps: BatchToolsDeps): void {
  server.registerTool(
    "batch_generate_image",
    {
      title: "Submit a batch image-generation job",
      description: `Submit an asynchronous batch of image-generation requests to Google.

WHEN TO USE: large multi-image jobs that are NOT time-critical — bulk content libraries, A/B sets, sweeps over prompts. The batch is processed within ~24h at 50% of the streaming price.

WHEN NOT TO USE: anything you need now. For interactive/iterative work, call generate_image directly (synchronous, no discount).

Returns a job name like 'batches/abc123'. Use batch_get_job to poll status and download results.`,
      inputSchema: submitShape,
    },
    makeBatchSubmitHandler(deps),
  );

  server.registerTool(
    "batch_get_job",
    {
      title: "Get a batch job's status and download results",
      description: `Polls a batch job. If still running, returns the current state. If completed (SUCCEEDED/FAILED), downloads any generated images to the output directory and reports per-request errors.

Idempotent: safe to call repeatedly. Call this every few hours after submitting a batch.`,
      inputSchema: nameShape,
    },
    makeBatchGetHandler(deps),
  );

  server.registerTool(
    "batch_list_jobs",
    {
      title: "List recent batch jobs",
      description: "Lists the most recent batch jobs created with this API key, with their state and display names. Useful when you forgot a job name or want to clean up.",
      inputSchema: {},
    },
    makeBatchListHandler(deps),
  );
}
