---
name: generate-variants
description: Use this when the user wants multiple images featuring the SAME subject (same character, same product, same model) — color swaps, multi-angle sets, pose variations, scene variations, "show me the same thing but in 5 different settings", consistent series. Preserves identity across all outputs by chaining edit_image from a single anchor reference.
---

# Generate variants of a single subject

This is the "same X, different Y" pattern. Y can be color, angle, pose, scene, lighting, framing, time of day — whatever varies. X is the **anchor** that must stay identical across every output.

If the user wants to combine DISTINCT subjects from different references (no shared identity), use `combine-references` instead. If they want a new aesthetic for a new subject, use `style-transfer`.

## When to activate

User says any of:
- "same character / model / product, but now …"
- "show this from different angles"
- "show this in different colors"
- "generate 5 scenes with the same person"
- "consistent series of N images"
- "variant of this in red / blue / green"
- "multi-angle catalog set"
- "different poses of this character"

## 1. Gather context

- **Anchor reference path** on disk (1 image — the canonical version of the subject).
- **Variant axis**: what varies? (color / angle / pose / scene / outfit / time of day)
- **Variant list**: enumerate every variant. Do NOT ask the model to "generate 10 variations" without specifying each one — it will improvise badly.
- **Output**: N separate images, one per variant.

## 2. Choose parameters

| Param | Default |
| --- | --- |
| Tool | `edit_image` (chained, one call per variant) |
| `imagePaths` | `[anchor]` for each call; re-use ORIGINAL anchor, not previous output |
| `aspectRatio` | matches the use case (1:1 catalog, 4:5 social, 16:9 lifestyle) |
| `resolution` | 1K for the variant chain; 2K for the final pick |
| `model` | omit (auto). If anchor is a person and you need >3 references, force `model: "pro"` for the 5-human budget. |
| `hasText` | usually false |
| `seed` | optional but useful for reproducibility |

## 3. Workflow

### Step 1: Produce / acquire the anchor

If the user gives you a reference photo, use it as anchor. If not:

```
generate_image({
  prompt: "<maximum-detail description of the subject>",
  aspectRatio: <chosen>,
  resolution: "2K",
  numImages: 1,
})
```

Save the returned file path. This becomes the **anchor**.

### Step 2: Iterate variants — one `edit_image` call per variant

For each variant in the list:

```
edit_image({
  imagePaths: [anchor_path],   // always the original anchor
  prompt: "<variant directive>",
  aspectRatio: <same as anchor or new>,
  resolution: "1K",
  seed: <optional>,
})
```

**Critical rule**: always pass the ORIGINAL anchor, never the previous variant. Chains of edits from each other drift exponentially past turn 5.

### Step 3: Validate, upscale the winners

Validate each variant matches the anchor's identity. For final-delivery variants, re-render at 2K.

## 4. Prompt patterns by variant axis

### Color swap

> Same product / character as the first reference image. Identical pose, identical lighting, identical background. Color of the {part — e.g. "shell", "main body", "dress"} changed to {target — e.g. "deep forest green #1B4332"}. All other attributes — shape, texture, logo, stitching, materials, position — must be pixel-identical to the reference.

### Multi-angle (catalog)

> Same product as the reference. Identical lighting (three-point softbox), identical pure-white background, identical contact shadow. Camera angle changed to: {top-down / 3/4 elevated / side profile / front straight-on}. Preserve every detail of the product — branding, materials, proportions — from the reference.

### Same character, different scenes

> Same character as the reference — identical face, hair, build, age range, and overall identity. Now: {new scene description}. {Lighting}, {mood}, {time of day}. Preserve the character's exact appearance from the reference.

### Pose variation

> Same character as the reference — identical identity, identical outfit, identical environment. Pose changed to: {new pose, e.g. "seated at a wooden table, leaning forward with both hands resting on the table"}. Preserve face, hair, clothing, and surroundings from the reference.

### Outfit / styling variation

> Same character as the reference. Identical face, hair, body, pose, background, lighting. Outfit changed to: {new outfit description}. All other elements pixel-identical to the reference.

## 5. Bulk variants

For >10 variants:

- Sync chain (one call per variant): **simple, works, slow**. Each call ~5–10s. Suitable up to ~20 variants.
- Batch: **does NOT support reference images**. Batch is text-only, so it can't preserve identity from an anchor. For variant work, sync chain is the only option.

If you have 100+ variants to produce and need to use batch, accept that batch outputs will be **separately generated subjects**, not identity-preserved variants. Different use case.

## 6. Re-anchoring strategy (preventing drift)

Drift checklist after each variant:

- Did the face / shape / proportions shift? → re-anchor (regenerate with the original).
- Did dominant color change? → include the palette in the prompt explicitly.
- Did lighting direction change when it shouldn't? → re-specify the original lighting.
- Is sharpness or detail dropping? → re-render that variant at 2K from the original.

NEVER chain edits from the previous variant; always go back to the original anchor.

## 7. Locked-seed variants (optional, advanced)

For variants where you want bit-comparable framing (e.g. A/B color comparisons for marketing), set the same `seed` value across all variant calls. The model will produce more comparable compositions. Note: the same seed + different prompts still varies — seed isn't a hard lock, more a soft bias.

## Failure modes

- **Face morphs** across variants → re-anchor every 3–5 variants.
- **Wrong color applied** ("change to red" but model paints the background red too) → constrain explicitly: `"Change ONLY the {specific part} color to {target}. Do not modify any other element."`
- **Loses logo / detail** during color swap → explicit: `"Preserve the logo position, branding, and all surface details exactly."`
- **Composition reframes itself** unintentionally → mention: `"Match the reference's camera angle and framing exactly."`

## Avoid

- Asking for "10 variations" without enumerating each one.
- Chaining variants (`edit_image(prev_output)` → `edit_image(that_output)` → …). Always anchor on the original.
- Using batch_generate_image when identity preservation matters — batch is text-only.
- Re-rendering identical variants at 4K from the start. Iterate at 1K, upscale winners.

## Hand-off

- Apply a new visual STYLE to a new subject → `style-transfer`.
- Combine SPECIFIC parts from multiple references → `combine-references`.
- Upscale the final variant → `upscale-or-restore`.
- Pure white-BG catalog variants → `ecommerce-product-shot` (it has a variant section).
- Lifestyle / scene variants → `lifestyle-shot`.
- Prompt structure → `nano-banana-prompting`.
- Cost / batch routing → `image-resolution-routing`.
