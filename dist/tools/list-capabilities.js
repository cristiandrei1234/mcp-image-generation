import { successResult } from "./helpers.js";
import { FLASH_MODEL_ID, PRO_MODEL_ID } from "../services/gemini-image.js";
const CAPABILITIES_TEXT = `IMAGE GENERATION CAPABILITIES

Two models, auto-routed by default:
  • Nano Banana 2 / Flash 3.1  — ${FLASH_MODEL_ID}
      Default. Fast (~2–10s). ~$0.045 (512) / $0.067 (1K) / $0.10 (2K).
      Strengths: speed, cost, character consistency, basic text, 512–4K, extreme aspect ratios.
  • Nano Banana Pro / Gemini 3 Pro Image  — ${PRO_MODEL_ID}
      Premium. Slower (~12–40s). ~$0.134 (1K/2K) / $0.24 (4K).
      Strengths: legible text rendering (multilingual: Latin/CJK/Arabic/Cyrillic/Devanagari),
                 up to 14 reference images, factuality, infographics, charts, multi-character scenes.

Auto-routing rules (when model='auto'):
  • hasText=true                  → Pro
  • resolution=4K                 → Pro
  • >3 reference images           → Pro
  • otherwise                     → Flash

Both models are AUTOREGRESSIVE, not diffusion. Long descriptive prompts (80–250 words for generate,
30–120 for edits) work better than Midjourney-style keyword stuffing. The encoder is the full
Gemini 3 LLM — write briefs the way you'd brief a designer.

Aspect ratios:
  • 1:1   — square (social posts)
  • 16:9  — landscape (blog hero, slides, YouTube thumbnails)
  • 9:16  — portrait (stories, reels, TikTok)
  • 4:3 / 3:4 — classic landscape / portrait
  • 2:3 / 3:2 / 4:5 / 5:4
  • 21:9  — ultra-wide cinematic
  • 8:1 / 1:8 / 4:1 / 1:4   — extreme banners / vertical posters (Flash only)

Resolutions:
  • 512  — drafts only (Flash only — rejected on Pro)
  • 1K   — default for iteration, social, internal use
  • 2K   — blog hero, presentations, print preview
  • 4K   — print, large displays, paid ad creatives (auto-routes to Pro)

Cost-awareness:
  Iterate at 1K. Pick the winner. Re-render only that at 2K or 4K.
  Never default to 4K unless explicitly required (it forces Pro = ~3× cost).

Reference image budgets:
  • Flash 3.1 : up to 4 humans / 10 objects / 14 total
  • Pro       : up to 5 humans / 6 objects / 14 total

Thinking level (Flash only — Pro is locked at max):
  MINIMAL | LOW | MEDIUM | HIGH
  Higher = slower, more expensive, more deliberate. Omit to let Flash decide.

Person generation policy (optional):
  ALLOW_ALL    — adults + children
  ALLOW_ADULT  — adults only, no children
  DONT_ALLOW   — no people at all

Reliability:
  generate_image / edit_image are retried up to 3 times with exponential backoff + jitter on:
    timeout, network, quota (HTTP 429), HTTP 5xx, HTTP 408.
  NOT retried on: auth, safety_block, bad_request, validation, no_image, parse, io.

Negative prompts: there is no negative_prompt field. Use semantic positives ("empty deserted street")
or an explicit exclusion line at the end of the prompt ("Do not include: text overlays, watermarks,
extra limbs, deformed hands.").

Safety:
  • Layer 1 (configurable) — harassment, hate, sexually explicit, dangerous content.
  • Layer 2 IMAGE_SAFETY (NOT configurable) — CSAM, gore, full nudity, real celebrities,
    copyrighted characters, financial-document tampering. Permanent blocks; thinking tokens
    are billed even when the image is blocked. NEVER auto-retry on safety_block — surface the
    error and reframe.

Tools:
  generate_image
    Text-to-image (sync). Use when you have a prompt and no source image.

  edit_image
    Image+text-to-image (sync). Use for edits, reframes, style transfer, multi-turn refinement,
    multi-reference compositing. Accepts 1–14 source images on disk.

  batch_generate_image
    Async batch (up to 100 requests / job, ~24h delivery, 50% price). For non-urgent bulk jobs.

  batch_get_job
    Polls a batch job; downloads images when SUCCEEDED.

  batch_list_jobs
    Lists recent batch jobs.

  list_capabilities
    This message.

Routing rules — which tool / model for which job:
  • Need text rendered in the image?           → generate_image with hasText=true (auto→Pro)
  • Iterating on a previous image?             → edit_image with previous output path
  • Pinterest variant of a 16:9 hero?          → edit_image with aspectRatio=3:4
  • 10 images of the same character?           → generate first, then edit_image with the first as reference
  • Style transfer / compositing (4+ refs)?    → edit_image with multiple imagePaths (auto→Pro)
  • Infographic, poster, ad headline?          → generate_image with hasText=true
  • Pure photoreal product shot, no text?      → generate_image (Flash is enough)
  • 50+ images, can wait until tomorrow?       → batch_generate_image (50% off)
`;
export { CAPABILITIES_TEXT };
export function registerListCapabilities(server) {
    server.registerTool("list_capabilities", {
        title: "List image generation capabilities",
        description: "Returns the full reference for this MCP server: supported models (Flash 3.1 + Pro), auto-routing rules, aspect ratios, resolutions, reference-image budgets, retry behavior, and safety policies. Call this when unsure how to configure generate_image, edit_image, or the batch tools.",
        inputSchema: {},
    }, async () => successResult(CAPABILITIES_TEXT));
}
