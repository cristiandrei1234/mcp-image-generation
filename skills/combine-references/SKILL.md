---
name: combine-references
description: Use this when the user wants to combine SPECIFIC, NAMED parts from multiple distinct reference images into one composite — "use the dress from A on the model from B in the setting from C", "place this product in the room from this photo with the lighting of that one", multi-character scenes from separate portraits. Each reference contributes a distinct element; the model composes them.
---

# Composite from multiple distinct references

This is the "Frankenstein the image from these parts" pattern. Each reference contributes ONE specific named contribution (subject, setting, lighting, props, style anchor). The model assembles them.

Distinct from:
- `style-transfer` — references provide visual language only, no specific elements.
- `generate-variants` — single subject preserved across N outputs.

If the brief is "same X but different Y", that's variants. If it's "X from here, Y from there, lighting from over there", that's combining.

## When to activate

User says any of:
- "use {element} from image 1 and {other element} from image 2"
- "put this person in that setting"
- "this dress on that model"
- "multi-character scene from separate portraits"
- "combine these N images"
- "Frankenstein these"
- "composite of A + B + C"

## 1. Gather context

For each reference image, ask the user to NAME what it contributes:
- Reference 1: provides {subject / object / setting / lighting / style / props}
- Reference 2: provides …
- Reference 3: provides …

Without explicit naming, the model guesses and averages — usually wrong.

## 2. Choose parameters

| Param | Default for compositing |
| --- | --- |
| Tool | `edit_image` |
| `imagePaths` | 2–14 references, ORDERED by importance (first = primary subject) |
| `aspectRatio` | matches the deliverable |
| `resolution` | 2K (skip 1K — composites need detail) |
| `model` | omit (auto). >3 refs auto-routes to Pro, which has stronger compositional reasoning. For 4+ refs always uses Pro. |
| `hasText` | only if final image needs text |
| `numImages` | 1 |

Compositing is the use case where Pro genuinely pays off — its 14-reference capacity + 5-human budget is its biggest edge over Flash.

## 3. Prompt skeleton

```
Compose a new image using these reference images as named sources:

  - First reference image: contributes {what it contributes — be specific}.
  - Second reference: contributes {…}.
  - Third reference: contributes {…}.
  - {…etc, up to 14}.

The final scene: {prose description of the composite — what's happening, where, when}.

Composition: {aspect, framing, camera angle, depth of field}.
Lighting: {how the named lighting reference should be applied}.
Style: {overall photographic / illustrative style for the composite}.

CRITICAL constraints:
  - Preserve {specific element to keep exact, e.g. branding / face / logo position} from {which reference}.
  - Do NOT include {what to exclude — e.g. references' own backgrounds, text, watermarks}.
```

## 4. Worked examples

### Product placement (3 references)

> Compose a new image using these reference images as named sources:
>
>   - First reference: contributes the product (a stainless-steel water bottle). Preserve its branding, lid shape, dimensions, and label position exactly.
>   - Second reference: contributes the setting (a sunlit modern kitchen with marble countertops and a window in the background).
>   - Third reference: contributes the lighting mood (warm golden-hour direction from upper-right, single soft source).
>
> The final scene: the water bottle from reference 1, sitting on the marble countertop from reference 2, lit with the warm directional light from reference 3, slight steam rising suggesting it was just filled with hot water.
>
> Composition: 4:5 portrait, slightly elevated 3/4 angle, depth of field with the bottle sharp and the kitchen softly blurred.
>
> CRITICAL: preserve the bottle's branding and label exactly from reference 1. Do not borrow the second reference's specific brand-name visible appliances — replace any visible brand text with generic surfaces.

→ `edit_image` with `imagePaths: [bottle.jpg, kitchen.jpg, lighting.jpg]`. Auto-routes to Pro (3+ refs).

### Multi-character scene (5 references — Pro-only territory)

> Compose a new scene with two characters from the reference images.
>
>   - First reference: provides Character A's identity (woman with shoulder-length brown hair, oval face, glasses). Preserve her face and identity exactly.
>   - Second reference: provides Character B's identity (man with short black hair, square jaw, beard). Preserve face and identity exactly.
>   - Third reference: provides the setting (a wood-paneled café interior with hanging pendant lights).
>   - Fourth reference: provides the lighting and color grading (warm tungsten + window backlight, slightly cinematic teal-orange).
>   - Fifth reference: provides the styling and wardrobe palette (autumn earth tones — rust, mustard, olive, cream).
>
> The final scene: Character A sitting across from Character B at a small round table in the café, mid-conversation, A holding a coffee cup with both hands, B gesturing with one open hand.
>
> Composition: 16:9 landscape, eye-level camera, both characters in profile to each other, rule-of-thirds composition, shallow depth of field with both faces sharp.
>
> CRITICAL: preserve each character's identity exactly from their reference. Do not introduce other people into the scene. No text in image.

→ `model: "pro"` (or auto, since 5 refs trigger Pro). Pro's 5-human budget is exactly what this needs.

### Brand-consistent ad (12 brand references)

For producing brand-aligned creatives, build a reference library:

- Logo (1)
- Color palette swatches (2)
- Typography sample (1)
- Prior brand photos (3)
- Product shots (3)
- Style moodboard (2)

Total: 12 images. Pass all as `imagePaths`:

> Compose a new social-media ad creative consistent with the visual identity defined in the reference images.
>
>   - References 1–2 (logo, palette): the brand's canonical mark and colors. Match the palette exactly in any decorative elements; do NOT render the logo into the image (we'll add it in post).
>   - References 3–5 (prior photos): the brand's photographic style — lighting, color grading, mood.
>   - References 6–8 (product shots): the visual language used for products in this brand.
>   - References 9–10 (moodboard): aesthetic anchors.
>   - References 11–12 (typography samples): for visual reference only — do NOT render any text.
>
> The final image: {new ad subject and message in prose}.
>
> Composition: {aspect, framing}. Style: continue the brand's established visual language.
>
> CRITICAL: match the established palette, lighting, and mood. No text in image. No real public figures.

This is Google's officially recommended "few-shot prompting for designers" pattern. Pro handles it; Flash will average too much.

## 5. Output management

- Always pass references in **importance order**. The first reference gets the most weight.
- For 5+ references, **explicitly name** what each one contributes. Order alone isn't enough.
- For repeating brand work, save the reference list as a named bundle in your workflow — passing the same 10 images for every brand ad is the right pattern.

## 6. Failure modes

- **Wrong identity transfers** — the dress from A appears on the wrong character. Fix: name each reference's contribution AND name what NOT to take from it (`"From reference 2, take only the setting — do NOT use the people visible in it"`).
- **Style averages** — composite looks like a blurry mean of all references. Fix: drop references that aren't critical; tighten the named contributions.
- **Logo/text leaks from a reference** — the model copies branding from one of the input images. Fix: `"Do NOT reproduce any text, logos, or watermarks visible in the reference images."`
- **>14 references silently truncated** — only the first 14 are used. Keep your library at 14 or fewer; rotate if you have more than that in the brand kit.

## Avoid

- More than 14 references — silently truncated by the API.
- Refs that contradict each other (warm sunlight + cold neon) — model picks one and ignores the other.
- Unnamed contributions ("here are 5 images, make something") — model averages and outputs slop.
- Compositing 3+ humans on Flash — use Pro for 4+ humans, Flash maxes at 4.
- Trying to composite text + image at once — too many constraints. Generate the photo first, then add text in a second `edit_image` pass with `hasText: true`.

## Hand-off

- One subject, N variant images → `generate-variants`.
- New aesthetic for new subject → `style-transfer`.
- Upscale the final composite → `upscale-or-restore`.
- Lifestyle scene (single product in a styled room) → `lifestyle-shot`.
- Single hero deliverable → `marketing-hero`.
- Catalog work → `ecommerce-product-shot`.
- Prompt structure → `nano-banana-prompting`.
- Safety errors (compositing people often triggers Layer-2) → `image-safety-handling`.
