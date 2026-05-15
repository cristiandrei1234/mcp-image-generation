import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { z } from "zod";
import mime from "mime";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeminiImageService } from "../services/gemini-image.js";
import type { GimageConfig } from "../config/schema.js";
import {
  AspectRatioSchema,
  ModelChoiceSchema,
  PersonGenerationSchema,
  ResolutionSchema,
  ThinkingLevelSchema,
} from "../config/schema.js";
import { errorResult, filesResult } from "./helpers.js";

const inputShape = {
  imagePaths: z
    .array(z.string().min(1))
    .min(1)
    .max(14)
    .describe(
      "Absolute paths to 1–14 source images on disk (PNG/JPG/WebP). Used as visual reference: edit (1–2 images), style transfer (1–3), character consistency (up to 4 on Flash, 5 on Pro), object/product consistency (up to 10 on Flash, 6 on Pro), or compositing (any mix up to 14). >3 images auto-routes to Pro.",
    ),
  prompt: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "What to change. Be specific and aim for one change at a time. Mention what should STAY the same (e.g. 'keep her face unchanged, change the dress from blue to red').",
    ),
  aspectRatio: AspectRatioSchema.optional().describe(
    "Output shape. Defaults to config. Use when you want to reframe (e.g. hero 16:9 → Pinterest 3:4).",
  ),
  resolution: ResolutionSchema.optional().describe("Output resolution. Defaults to config."),
  numImages: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("How many edited variants to generate."),
  seed: z.number().int().optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
  personGeneration: PersonGenerationSchema.optional(),
  model: ModelChoiceSchema.optional().default("auto"),
  hasText: z.boolean().optional(),
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const editImageInputShape = inputShape;
export const EDIT_MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;

export type EditImageDeps = {
  service: Pick<GeminiImageService, "generate">;
  defaults: GimageConfig["defaults"];
};

export function makeEditImageHandler(deps: EditImageDeps) {
  return async (args: {
    imagePaths: string[];
    prompt: string;
    aspectRatio?: z.infer<typeof AspectRatioSchema>;
    resolution?: z.infer<typeof ResolutionSchema>;
    numImages: number;
    seed?: number;
    thinkingLevel?: z.infer<typeof ThinkingLevelSchema>;
    personGeneration?: z.infer<typeof PersonGenerationSchema>;
    model?: z.infer<typeof ModelChoiceSchema>;
    hasText?: boolean;
  }) => {
    const refs: Array<{ data: Buffer; mimeType: string }> = [];
    for (const path of args.imagePaths) {
      let buf: Buffer;
      try {
        buf = await readFile(path);
      } catch (cause) {
        return errorResult({ kind: "io", cause });
      }
      if (buf.length > MAX_IMAGE_BYTES) {
        return errorResult({
          kind: "bad_request",
          status: 413,
          message: `Image ${path} is ${buf.length} bytes (max ${MAX_IMAGE_BYTES})`,
        });
      }
      const detected = mime.getType(extname(path)) ?? "image/png";
      refs.push({ data: buf, mimeType: detected });
    }

    const result = await deps.service.generate({
      prompt: args.prompt,
      aspectRatio: args.aspectRatio ?? deps.defaults.aspectRatio,
      resolution: args.resolution ?? deps.defaults.resolution,
      numImages: args.numImages,
      seed: args.seed,
      thinkingLevel: args.thinkingLevel,
      personGeneration: args.personGeneration,
      model: args.model,
      hasText: args.hasText,
      referenceImages: refs,
    });
    if (!result.ok) return errorResult(result.error);
    return filesResult(
      result.value.files,
      `Edited ${refs.length} reference image(s) into ${result.value.files.length} output(s) in ${result.value.durationMs}ms:`,
    );
  };
}

export function registerEditImage(server: McpServer, deps: EditImageDeps): void {
  server.registerTool(
    "edit_image",
    {
      title: "Edit Image",
      description: `Edit one or more source images using Google Nano Banana 2.

Supports natural-language edits while preserving subject identity. Use for:
- Reframing/aspect-ratio changes ("convert this hero to vertical 3:4")
- Object/background changes ("change the sky to a sunset", "remove the watermark")
- Style transfer (combine multiple reference images + a style description)
- Iterative refinement (call repeatedly with the previous output as input)

Tips: one change per call, mention what to keep unchanged, pass the previous output's file path as imagePaths for multi-turn refinement.`,
      inputSchema: inputShape,
    },
    makeEditImageHandler(deps),
  );
}
