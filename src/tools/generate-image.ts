import { z } from "zod";
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
  prompt: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "Image description in English. Be specific about subject, action, setting, style, lighting, composition.",
    ),
  aspectRatio: AspectRatioSchema.optional().describe(
    "Image shape. Defaults to the config setting. Common: 1:1 (social), 16:9 (hero/slide), 9:16 (story), 4:3, 3:4, 21:9, 8:1, 1:8.",
  ),
  resolution: ResolutionSchema.optional().describe(
    "512=tiny drafts (Flash only), 1K=default iteration, 2K=blog hero/slides, 4K=print/large display (auto-routes to Pro). Iterate cheap, upscale only the winner.",
  ),
  model: ModelChoiceSchema.optional().default("auto").describe(
    "auto (default) picks Flash and escalates to Pro when hasText=true, refs>3, or resolution=4K. Force with 'flash' or 'pro'. Pro is ~3× the price of Flash but renders text accurately and handles >3 reference images.",
  ),
  hasText: z.boolean().optional().describe(
    "Set true if the image must contain readable text (headlines, signs, infographics, posters). Auto-routes to Pro because Flash often garbles text. Use the exact text in quotes inside the prompt.",
  ),
  numImages: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("How many variants to generate in one call (1–4)."),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Set for reproducible output (same prompt+seed → same image). Omit for variation."),
  thinkingLevel: ThinkingLevelSchema.optional().describe(
    "Reasoning effort: MINIMAL/LOW/MEDIUM/HIGH. Higher = slower, more expensive, more deliberate. Omit to let the model decide.",
  ),
  personGeneration: PersonGenerationSchema.optional().describe(
    "Policy for generating people: ALLOW_ALL (adults+children), ALLOW_ADULT (no children), DONT_ALLOW (no people).",
  ),
};

export const generateImageInputShape = inputShape;

export type GenerateImageDeps = {
  service: Pick<GeminiImageService, "generate">;
  defaults: GimageConfig["defaults"];
};

export function makeGenerateImageHandler(deps: GenerateImageDeps) {
  return async (args: {
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
    });
    if (!result.ok) return errorResult(result.error);
    return filesResult(
      result.value.files,
      `Generated ${result.value.files.length} image(s) in ${result.value.durationMs}ms:`,
    );
  };
}

export function registerGenerateImage(server: McpServer, deps: GenerateImageDeps): void {
  server.registerTool(
    "generate_image",
    {
      title: "Generate Image",
      description: `Generate one or more images from a text prompt using Google's Nano Banana family.

Two models, auto-routed:
  • Nano Banana 2 (Flash 3.1) — default, fast, cheap. Good for iteration, social, product shots without text.
  • Nano Banana Pro (Gemini 3 Pro Image) — escalated automatically when hasText=true, refs>3, or resolution=4K. Best for readable text-in-image, infographics, multi-reference compositing.

Both are autoregressive (NOT diffusion): they reward long, descriptive briefs (80–250 words is the sweet spot). Avoid Midjourney-style keyword stuffing.

Use 'edit_image' for source-image edits or multi-turn refinement.
Use 'list_capabilities' for the full reference.

Saves PNG files to <cwd>/Generations/Images/ and returns absolute file paths.`,
      inputSchema: inputShape,
    },
    makeGenerateImageHandler(deps),
  );
}
