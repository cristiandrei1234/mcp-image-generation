---
name: lifestyle-shot
description: Use this when the user asks for a lifestyle product shot, "product in context", "product in use", "in-room photo", "on a desk", contextual product photography, or a styled scene featuring an existing product. Bridges the gap between catalog photography and editorial — the product is the subject, but the environment matters.
---

# Lifestyle product photography

Lifestyle shots are the bread-and-butter for ad creatives, social posts, and PDP secondary images. The product identity must be preserved exactly while the surrounding scene tells a story.

Pure catalog work (white BG, ghost mannequin) → use `ecommerce-product-shot` instead.

## 1. Gather context

- **Source image**: a clean reference photo of the product (path on disk). Required.
- **Scene**: where is it? (kitchen, desk, café, beach, gym, bedroom)
- **Time of day / light**: morning / golden hour / midday / evening
- **Lifestyle vibe**: minimal modern / cozy rustic / Scandi / brutalist / tropical / etc.
- **Co-props**: any specific objects to include (mug, notebook, plant, etc.)
- **People**: ideally none (Layer-2 IMAGE_SAFETY false positives are common with people, especially close-ups). If a person is needed, frame them so the face is out of focus or off-camera.

## 2. Choose parameters

| Param | Default for lifestyle |
| --- | --- |
| Tool | `edit_image` (product reference is mandatory) |
| `aspectRatio` | 4:5 (Instagram), 16:9 (web hero), 1:1 (catalog secondary) |
| `resolution` | 2K |
| `model` | omit (auto). Routes to Pro automatically if >3 references. |
| `hasText` | false |
| `personGeneration` | `DONT_ALLOW` if no people, `ALLOW_ADULT` if adult-only |

## 3. Prompt skeleton

```
[GOAL]        Lifestyle product photograph for {use case — social post / PDP / ad creative}.
[SUBJECT]     Place this product (uploaded as reference) in {scene}, {position in scene}.
[ENVIRONMENT] {scene description — surfaces, props, room style, era}.
[CO-PROPS]    Beside it: {co-props with materials}.
[LIGHTING]    {direction}, {quality}, {color temperature}, {time of day}.
[COMPOSITION] {aspect}, {framing}, {camera position and angle}, {depth of field}.
[STYLE]       {editorial / lifestyle / documentary / commercial} photography style. {Lens specification — e.g. 35mm f/2.8}.
[CONSTRAINTS] Preserve the product's exact branding, colors, materials, proportions, and logo position from the reference image. No alterations to the product itself.
```

## 4. Worked examples

### Kitchen / morning scene (ceramic coffee mug)

> Lifestyle product photograph for a social post. Place this product (uploaded as reference) in a bright modern kitchen on a marble countertop, slightly off-center to the right third. Beside it: a small ceramic dish with two croissants, an open hardcover notebook with a pen on top, and a small terracotta plant in the background. Soft natural window light from upper left, warm 5500K temperature, golden hour. 4:5 portrait, 35mm f/2.8, shallow depth of field with subtle bokeh on the background. Editorial lifestyle photography style. Preserve the product's exact branding, colors, materials, proportions, and logo position from the reference image. No alterations to the product. No people, no text overlays.

### Desk / WFH scene (a notebook product)

> Lifestyle product photograph of this notebook (uploaded as reference) on a walnut desk in a sunlit minimalist home office, late morning. Beside it: a slim silver laptop closed (no visible brand), a black ballpoint pen, a small concrete planter with a succulent. Soft window light from upper right, neutral 5000K. 16:9, 50mm f/4, medium depth of field with everything in the focal plane sharp. Stripe/Linear aesthetic, clean and intentional. Preserve every detail of the notebook from the reference: cover color, embossed logo, page block. No people, no other readable text in the scene.

### Beach / tropical (a swimwear / outdoor product)

> Lifestyle product photograph of this product (uploaded) styled on a white-sand beach at golden hour. Place on a soft natural surface (driftwood, a folded linen towel) with a blurred ocean and palm fronds in the background. Warm 4200K light from the lower right, low golden-hour sun. 4:5 portrait, slight bokeh, 35mm f/2.8. Travel-editorial style. Preserve product branding, colors, and materials exactly. No people, no real or generic text overlays.

## 5. Multi-image composition (advanced)

If the brief is "use the product from image 1, in the setting of image 2, with the lighting/style of image 3", pass all references as `imagePaths` (the order matters — first is the primary subject) and name them in the prompt:

> Take the product from the first reference image and place it in the setting of the second reference image, with the lighting mood and color grading of the third. Preserve the product's exact branding from the first reference. Match the camera framing and depth of field of the second reference.

With ≥4 references, auto-routing fires Pro for better compositional reasoning.

## 6. On safety failure

Lifestyle shots involving people, even just an arm or hand holding the product, can trigger Layer-2 IMAGE_SAFETY false positives — especially for swimwear, lingerie, fitness wear. Mitigations:

- Frame so no person is fully visible: `"a hand reaching for the product from off-frame, no full body visible"`.
- Add explicit commercial context: `"product catalog lifestyle shot for an e-commerce listing"`.
- If still blocked, fall back to a no-person version: ghost-mannequin or "as if just placed" framing.

See `image-safety-handling` for the full protocol.

## Avoid

- Faces of identifiable real people (the model isn't allowed to generate specific public figures).
- Recognizable brand logos on co-props (no Coca-Cola can, no Apple laptop — describe as `"a closed silver laptop"`).
- Text on signage in the scene unless `hasText: true` and you've set the exact text in the prompt.
- More than 4–5 prop objects in one frame — composition falls apart.
- Asking for "natural" with no specification — give time of day, light direction, color temperature.

## Hand-off

- For pure white-background catalog → `ecommerce-product-shot`.
- For abstract / marketing-y product hero (no realistic scene) → `marketing-hero`.
- For copying the look of a reference moodboard onto a new subject → `style-transfer`.
- For combining specific parts (product from A, room from B, light from C) → `combine-references`.
- For producing multiple variants of the same lifestyle scene → `generate-variants`.
- For upscaling the final pick to 4K → `upscale-or-restore`.
- For prompt structure / language → `nano-banana-prompting`.
- For safety errors → `image-safety-handling`.
