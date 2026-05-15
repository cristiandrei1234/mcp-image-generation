---
name: style-transfer
description: Use this when the user wants to apply the visual look of one or more reference images to a NEW subject — "in the style of this moodboard", "make a new image with this aesthetic", "match the look of these references but with a different subject". Does NOT copy the references' subjects, only their style (color palette, lighting quality, level of detail, mood).
---

# Style transfer

Pass 1–3 style references; describe a new subject; the model renders the new subject in the references' visual language. The references provide **look-and-feel only** — the subject in them is ignored.

If the user wants to keep the subject and change the scene, that's a variant — use `generate-variants` instead. If they want to combine specific parts of multiple images, use `combine-references`.

## When to activate

User says any of:
- "in the style of this image / these references / this moodboard"
- "match the look of …"
- "same aesthetic as …"
- "render with the visual language of …"
- "apply this art direction to a new scene"

Do NOT activate when:
- The user wants to preserve identity of a subject in the reference (→ `generate-variants` or `combine-references`).
- The user wants to edit the reference itself (→ `edit_image` directly, no style transfer needed).

## 1. Gather context

- **Style reference paths** (1–3 images on disk). More than 3 dilutes the style and starts to confuse the model.
- **New subject** in prose: what should the new image show?
- **Deliverable**: aspect, resolution.

## 2. Choose parameters

| Param | Default |
| --- | --- |
| Tool | `edit_image` |
| `imagePaths` | 1–3 style refs, ordered by influence (first = strongest) |
| `aspectRatio` | matches the deliverable (independent of the references' aspect) |
| `resolution` | 2K |
| `model` | omit (auto). 1–3 refs stay on Flash. Set `model: "pro"` if style is highly detailed / textured / multi-element. |
| `hasText` | only if the new image also needs rendered text |
| `numImages` | 1 (try `numImages: 2` once to see variation, then commit to one) |

## 3. Prompt skeleton

```
Generate a NEW image of {new subject in prose}, rendered in the visual style
demonstrated by the reference image(s).

Style elements to match from the references:
  - Color palette and color grading
  - Lighting quality, direction, and color temperature
  - Level of detail / texture / film grain
  - Compositional rhythm and use of negative space
  - Overall mood and atmosphere

Do NOT copy the references' subject matter. Only the style.

[aspect, resolution, technical specs as needed]
[CONSTRAINTS] {anything else, e.g. "No text", "No people", brand-specific rules}
```

## 4. Worked examples

### Single moodboard image → new product shot

User uploads one moodboard image (Kinfolk-style kitchen aesthetic) and wants a coffee mug shot in that style.

> Generate a new image of a matte black ceramic coffee mug on a wooden tray, rendered in the visual style demonstrated by the reference image.
>
> Style elements to match: muted earthy color palette (cream, walnut, taupe), soft natural side light from a single window, slight film grain, generous negative space, magazine-editorial photography mood.
>
> Do NOT copy the reference's subject. Only the style.
>
> 4:5 portrait, 2K, 50mm f/2.8 lens character, shallow depth of field.

→ call `edit_image` with `imagePaths: [moodboard.jpg]`.

### Three brand-style references → new ad creative

User has 3 prior brand ads and wants a new one in the same family.

> Generate a new image of a wireless earbuds case sitting on a clean surface, rendered in the visual style demonstrated by the three reference images.
>
> Match from the references: dark navy + warm amber color palette, single dramatic rim light from upper right, sub-pixel sharp 3D-render aesthetic, ample negative space at the bottom for a future headline.
>
> Do NOT copy the references' subjects (those were headphones and a smartwatch — the new image is earbuds).
>
> 16:9, 2K. No text. Avoid stock-photo aesthetic.

→ `edit_image` with `imagePaths: [ad1.jpg, ad2.jpg, ad3.jpg]`. Auto-routing stays on Flash (3 refs); set `model: "pro"` if you want stronger style adherence.

### Hand-drawn sketch → photoreal rendering in the same composition

User has a pencil sketch and wants a photoreal version that respects the sketch's composition.

> Generate a new photorealistic image based on the compositional structure of the reference sketch, but rendered as: a photorealistic studio scene with matte materials, soft three-point lighting, neutral grey backdrop, professional product photography aesthetic.
>
> Match the sketch's composition (subject placement, framing, negative space) but produce a photoreal render, not a drawing.
>
> 1:1, 2K. Editorial product photography style.

This is a special case where the reference DOES provide subject + composition; specify in the prompt that style is the only thing being changed.

## 5. Failure modes

- **Style "averages out"** with 3+ very different references — the model picks neutral elements common to all. If this happens, drop to 1–2 strongest references or pick more cohesive moodboards.
- **Subject leak** — the new image accidentally copies an object from a reference. Restate explicitly: `"The new subject is X. Do NOT include any of the objects, characters, or text from the reference images."`
- **Style is too generic** ("photorealistic") — name the specific qualities: lighting direction, color palette, lens character, film grain, color grade.

## Avoid

- More than 3 style references — adds noise, dilutes style.
- Mixing style references with subject references in one call — model can't tell which is which. Split into two calls: subject anchor first, then style transfer on that output.
- Vague style descriptions ("modern", "cinematic") — useless without specifics about light, color, framing.

## Hand-off

- Subject identity must be preserved (same person/product across scenes) → `generate-variants`.
- Want to combine SPECIFIC parts of multiple images ("dress from A on model from B") → `combine-references`.
- Single product on white BG → `ecommerce-product-shot`.
- Product in a styled room → `lifestyle-shot`.
- Marketing hero with text → `marketing-hero`.
- Prompt structure rules → `nano-banana-prompting`.
