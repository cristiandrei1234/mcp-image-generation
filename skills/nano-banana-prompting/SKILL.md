---
name: nano-banana-prompting
description: Use when generating or editing images via the image-generation MCP server (Google Nano Banana 2 Flash + Nano Banana Pro). Provides the prompt structure, length sweet spots, anti-patterns, text-rendering rules, and reference-image patterns that are specific to these autoregressive (not diffusion) models.
---

# Prompting Nano Banana 2 + Nano Banana Pro

The `image-generation` MCP server exposes `generate_image`, `edit_image`, and three batch tools. Internally both Google models — **Nano Banana 2** (Flash 3.1) and **Nano Banana Pro** (Gemini 3 Pro Image) — are autoregressive multimodal LLMs, NOT diffusion. This single fact changes everything about how you prompt them.

## Core principle

> **Describe the scene, don't list keywords.** The encoder is the full Gemini 3 LLM. It reads your prompt like a designer reading a brief, not like CLIP matching tokens.

Concretely:

- Long, descriptive sentences work better than short keyword soup.
- Multi-step instructions ("First… Then… Finally…") are executed in order.
- Constraints inside the prompt are respected (hex colors, exact text, positional rules).
- Max input is **32,768 tokens** (~24,000 words). The sweet spot is **80–250 words for generate, 30–120 for edits**. Longer is fine for highly constrained briefs; shorter than ~30 words gives generic output.
- JSON-shaped constraints embedded in prose are respected. Example: `"Render the chart with these series: revenue (#2563EB, solid line), costs (#F59E0B, dashed line), profit (#10B981, area fill at 30% opacity)."` works.

## Multi-step instructions

Because the model "thinks", you can chain ordered instructions inside a single prompt:

```
First, establish the scene: a sunlit Scandinavian kitchen, morning light from the
upper-left window.

Then, place the subject: the ceramic mug from the reference image, centered on
the kitchen island marble countertop.

Next, add atmosphere: a slight steam rising from the mug, with a thin shaft of
sunlight catching the steam.

Finally, set the camera: 50mm equivalent lens, slightly elevated 3/4 angle,
f/2.8, shallow depth of field with the kitchen background gently blurred.

Style: editorial lifestyle photography for Kinfolk magazine, slight film grain.
```

The model executes the steps in order. Use this for complex compositions where
order-of-operations matters (e.g. "first remove X, then add Y, then re-light").

## Prompt structure formula

```
[GOAL]        what is this image FOR? (landing-page hero, product shot, infographic, etc.)
[SUBJECT]     who/what is in it, doing what
[ENVIRONMENT] setting, background, time of day, era
[COMPOSITION] aspect, framing, rule of thirds, negative space for copy, camera angle
[LIGHTING]    direction, quality, color temperature, mood
[STYLE]       editorial photography / 3D render / flat illustration / etc.
[COLORS]      hex codes when known; palette name as fallback
[TEXT]        any text that must appear, in quotes, with font / position
[TECHNICAL]   resolution, lens, depth of field, film grain
[CONSTRAINTS] what must STAY the same (for edits); what must be exact
[NEGATIVES]   "Avoid: …" — exclusion list at the end
```

Not every section is required for every prompt. Pick the ones that matter for the deliverable.

## Anti-patterns (will hurt your output)

- ❌ Midjourney keyword stuffing: `8k, ultra detailed, masterpiece, trending on artstation, --v 6`
- ❌ Vague briefs: `"a coffee shop"` (the model will guess your brand)
- ❌ `"no text"` when text is actually wanted (often interpreted as "decorative text")
- ❌ Brand names you don't own (`"Coca-Cola can"`, `"Disney style"`) — IMAGE_SAFETY blocks
- ❌ Real celebrity names — permanently blocked since Jan 23, 2026
- ❌ Anime / cartoon styles applied to adult subjects — high false-positive rate on Layer-2 safety
- ❌ Asking for a "logo" without context — generic McDonald's-flavored output

## Negative prompts (there is no `negative_prompt` field)

Three working alternatives:

1. **Semantic positives.** `"an empty deserted street"` instead of `"no cars"`.
2. **Explicit exclusion at the end.** `"Avoid: text overlays, watermarks, harsh reflections, extra limbs, deformed hands."`
3. **Constrained edits.** `"Change ONLY the sofa to brown leather. Keep everything else — pillows, lighting, walls — unchanged."`

Pro respects exclusion lists better than Flash.

## Text rendering inside images

This is the killer feature, but only on **Nano Banana Pro**. Flash often garbles text.

When the image must contain readable text:

1. Set `hasText: true` on `generate_image` — this auto-routes to Pro.
2. Put the exact text in **quotes** in the prompt: `with the text "Summer Sale 2026" in bold red letters`.
3. Specify **position**: `text in the upper right corner`, `centered below the product`.
4. Specify **typography**: `bold sans-serif`, `serif`, `handwritten script`, `condensed display font`.
5. Keep text **short**. Single phrases work; paragraphs > 400 words degrade.
6. For multilingual text, name the script: Latin, CJK, Arabic, Cyrillic, Devanagari.

For text-heavy deliverables, write the copy first, then pass it inside the image prompt.

## Character / subject consistency

For series of images with the same person / product / character:

1. Generate the first image with maximum detail about the subject.
2. Save the file path.
3. For each subsequent image, call `edit_image` with the first as `imagePaths` (≥4 references → auto-routes to Pro for the higher human/object budget).
4. Re-anchor every 5–10 turns; quality drifts beyond that.

Reference image budgets:
- **Flash 3.1**: 4 humans / 10 objects / 14 total
- **Pro**: 5 humans / 6 objects / 14 total (better composition reasoning)

## Multi-turn chat sessions (advanced, not exposed by this MCP)

The Google SDK supports `client.chats.create()` which preserves "thought signatures" — encrypted blobs the model attaches to each turn that must be echoed back on the next call. The official SDK handles them automatically; raw REST does not.

This MCP server uses one-shot `generateContentStream` calls. For multi-turn conversational editing, each `edit_image` call is stateless — the only continuity is whatever you pass in `imagePaths`. This means:

- Drift accumulates faster than in a real chat session.
- Always re-anchor on the **original** reference, not the previous output.
- For 5+ progressive edits on the same subject, accept some drift OR fall back to a custom script using the SDK's `chats.create()` directly.

If you need a true chat session (rare — usually 5 stateless edits with the original anchor is enough), call the MCP server's `edit_image` 5 times with the same `imagePaths: [anchor]`.

## Editing rules

- **One change per call.** "Change the sky and the dress and add a dog" usually fails. Split.
- **Be precise.** `"change the dress color from blue to red"` beats `"make the dress different"`.
- **Anchor what to keep.** `"keep the woman's face and hair unchanged, only modify the background to a beach at sunset"`.
- **Reframing.** Pass the source as `imagePaths` and set `aspectRatio` to the new shape; `"reframe to vertical 3:4 composition, keep subject centered"`.

## When to set `thinkingLevel`

Only meaningful on Flash. Pro is locked at max thinking.

- **Omit** by default — Flash auto-picks.
- **`HIGH`** when a previous attempt failed and you need a complex multi-subject composition.
- Higher = slower and ~5–18% more expensive. Don't enable preemptively.

## Hand-off

- Resolution / cost / batch routing → `image-resolution-routing`
- Full multi-image blog set → `image-workflows-blog`
- Landing-page hero / OG / social → `marketing-hero`
- E-commerce product shots → `ecommerce-product-shot`
- Lifestyle product photography → `lifestyle-shot`
- Text + structured data + factuality → `infographic`
- Same subject across many images (color/angle/scene variants) → `generate-variants`
- New subject in the visual style of N references → `style-transfer`
- Combine specific parts from multiple images into one composite → `combine-references`
- Upscale / enhance / restore an existing image → `upscale-or-restore`
- Reacting to IMAGE_SAFETY / SAFETY errors → `image-safety-handling`
