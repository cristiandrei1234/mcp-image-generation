---
name: ecommerce-product-shot
description: Use this when the user asks for an e-commerce product image, Amazon main image, product photo, white-background shot, product mockup, ghost-mannequin apparel shot, product variant (color swap), or any "product photography" deliverable. Sets the right defaults for both clean-background main images and lifestyle context shots, including multi-variant workflows.
---

# E-commerce product photography

Two distinct deliverables under the same skill:

- **Main image** — pure white background, Amazon-compliant, identity-preserved. Default model: Flash.
- **Variant** — same product, different color / angle / pose. Use `edit_image` with the main as reference.

For *contextual* / styled lifestyle shots (product in a room, on a desk, in use), see `lifestyle-shot` instead.

## 1. Gather context

- **Source image**: the user must provide a reference photo of the actual product (path to file on disk). Without one, the model will invent the product and the deliverable is worthless.
- **Deliverable type**: Amazon main / Shopify catalog / variant (color swap) / multi-angle / ghost mannequin
- **Variants needed**: list of color / angle / pose variations

## 2. Choose parameters

| Deliverable | Tool | Aspect | Resolution | Model | hasText |
| --- | --- | --- | --- | --- | --- |
| Amazon main image | `edit_image` | 1:1 | 2K | Flash (auto) | false |
| Catalog white-BG | `edit_image` | 1:1 or 4:5 | 2K | Flash | false |
| Multi-angle set | `edit_image` chain | 1:1 | 2K | Flash | false |
| Ghost mannequin | `edit_image` | 4:5 or 1:1 | 2K | Flash | false |
| Color variant | `edit_image` | match original | match | Flash | false |
| Pack of 10+ variants | `batch_generate_image` | 1:1 | 1K → 2K final | Flash | false |

`generate_image` (text-only) is the wrong tool here — without a reference photo, the model invents the product.

## 3. Prompt patterns

### Amazon-compliant main image

> Transform the uploaded product photo into an Amazon-compliant main image. Place the product centered on a pure white background (RGB 255, 255, 255), occupying ~85% of the frame, with a soft contact shadow directly beneath. Three-point softbox lighting, no harsh highlights, no color cast on the product. The product itself — exact shape, colors, textures, logos, every detail — MUST be preserved 1:1 from the uploaded image; only background and lighting may change. 1:1 square, 2K. No text, no props, no other objects.

### Multi-angle from a single reference (chain `edit_image` calls)

After producing the main image (call 1), reuse its output path as `imagePaths` for each subsequent angle:

- Call 2: `"Same product, identical lighting and surface. Show a clean side profile, camera at eye level with the product."`
- Call 3: `"Same product, identical lighting and surface. Top-down view, camera directly overhead."`
- Call 4: `"Same product, slightly elevated 3/4 angle, identical lighting."`

If composition drift creeps in by call 4–5, re-anchor by passing the ORIGINAL reference, not the previous output.

### Ghost mannequin (apparel)

> Using the uploaded apparel photo as reference, remove the mannequin / model entirely while preserving the exact garment shape — hollow at the neck and sleeves so the garment appears to float in space. Preserve every fabric texture, color, stitching detail, and logo position pixel-faithfully. Place on a pure white background with a subtle drop shadow. Ghost-mannequin e-commerce style. 4:5, 2K. Do not stretch, recolor, or alter the garment in any way.

### Color variant

> Same product as the uploaded reference. Identical pose, identical lighting, identical background. Color of the {part — e.g. "shell", "stitching", "main body"} changed to {target color name + hex, e.g. "deep forest green #1B4332"}. All other attributes — shape, texture, logo, stitching, materials, position — must be pixel-identical to the reference.

## 4. Bulk variants via batch

For 20+ color swaps or angle variations:

1. Validate with one sync `edit_image` call (Flash, 1K).
2. If output looks right, submit the full set:
   ```
   batch_generate_image({
     requests: [
       { prompt: "<variant 1 prompt>", numImages: 1, resolution: "2K" },
       { prompt: "<variant 2 prompt>", numImages: 1, resolution: "2K" },
       ...
     ],
     displayName: "Spring-2026-color-variants"
   })
   ```
3. Save the returned `batches/...` name. Poll later with `batch_get_job({ name })`.

Note: batch_generate_image is text-only (no image references). For variant work that needs the original product as reference, use the sync `edit_image` in a loop instead — batch isn't suited for ref-conditioned generation.

## 5. Validation checklist before delivering

- [ ] Background is pure white (RGB 255, 255, 255), not off-white.
- [ ] Product fills ~80–90% of the frame.
- [ ] No fabricated text, watermarks, or fake brand stamps.
- [ ] Logo position matches the reference photo exactly.
- [ ] Shadow is subtle, single-source, directly beneath.
- [ ] No extra props or background objects.
- [ ] Colors match the reference (eyeball test; for critical brand colors, compare hex values).

If any check fails, edit again with a constrained prompt: `"Keep the product unchanged. Fix only: {specific issue}."`

## 6. On safety failure

For e-commerce: rare, but apparel close to "underwear" or "swimwear" can trigger Layer-2 IMAGE_SAFETY. If blocked, rephrase to emphasize the commercial context: `"product catalog photo of swimwear on a ghost mannequin, no human model, e-commerce listing style."` See `image-safety-handling`.

## Avoid

- Generating product photos without a reference image (results will be made-up products).
- Asking for "no text" if the product itself has text/logos — model may interpret this as "remove the product's logo too". Use `"Preserve all original branding and text on the product unchanged"` instead.
- Chains longer than 4–5 turns from the same reference — quality drifts.
- 4K for catalog work — 2K is enough for web and Amazon listings; 4K only for print catalogs.

## Hand-off

- For products styled in a room / on a desk / "in use" → `lifestyle-shot`.
- For pure aesthetic / marketing-y hero shots of a product (not catalog) → `marketing-hero`.
- For dedicated color / angle / pose variant workflow → `generate-variants` (deeper than this skill's section).
- For combining product + setting + lighting from separate references → `combine-references`.
- For upscaling the final pick to 4K → `upscale-or-restore`.
- For prompt structure rules → `nano-banana-prompting`.
- For batch routing → `image-resolution-routing`.
- For safety errors → `image-safety-handling`.
