import { z } from "zod";
export const AspectRatioSchema = z.enum([
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
    "1:8",
    "8:1",
    "1:4",
    "4:1",
]);
export const ResolutionSchema = z.enum(["512", "1K", "2K", "4K"]);
export const ModelChoiceSchema = z.enum(["auto", "flash", "pro"]);
export const ThinkingLevelSchema = z.enum(["MINIMAL", "LOW", "MEDIUM", "HIGH"]);
export const PersonGenerationSchema = z.enum(["ALLOW_ALL", "ALLOW_ADULT", "DONT_ALLOW"]);
export const GimageConfigSchema = z.object({
    version: z.literal(1),
    apiKey: z
        .string()
        .min(20, "API key looks too short")
        .startsWith("AIza", "Google AI Studio keys start with 'AIza'"),
    defaults: z.object({
        aspectRatio: AspectRatioSchema,
        resolution: ResolutionSchema,
    }),
});
