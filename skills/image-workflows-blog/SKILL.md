---
name: image-workflows-blog
description: Activate when the user requests images for a blog post, article, newsletter, or SEO content. Orchestrates the standard multi-image set (hero, body, social share, Pinterest) with consistent style and the cheapest route per slot.
---

# Blog content image workflow

A typical published article needs multiple images at different sizes and aspects. Producing them ad-hoc wastes calls and breaks visual consistency. This skill orchestrates the full set.

## Standard deliverable per article

| Slot | Aspect | Resolution | Model (auto) | Purpose |
| --- | --- | --- | --- | --- |
| **Hero** | 16:9 | 2K | Flash (or Pro if text wanted) | The image readers see first |
| **Open Graph / social share** | 16:9 | 1K | Flash | Twitter / LinkedIn / FB preview |
| **Body image 1–3** | 16:9 or 4:3 | 1K | Flash | Illustrate specific sections |
| **Pinterest** | 3:4 | 1K | Flash | Vertical, reframed from the hero |

For a short post (<800 words), drop body images to 1; for long-form (>2000 words), aim for 3–4.

## Production order

1. **Hero first** — `generate_image` at 16:9, 2K. Set `hasText: true` if the hero must show the article title (this auto-routes to Pro). This is the visual anchor; everything else derives from it.
2. **Pinterest variant** — `edit_image` with the hero as `imagePaths`, aspectRatio=3:4, resolution=1K, prompt `"reframe to vertical 3:4 composition, keep subject centered, same style"`. Free visual consistency.
3. **Body images** — `generate_image` at 16:9, 1K, one per call. Use the same style anchor in every prompt.
4. **Open Graph** — usually the hero downscaled (no extra generation needed). If you need text overlay, `edit_image` with the hero + `hasText: true`.

## Prompt template for blog imagery

```
[GOAL]   Editorial illustration for an article about {topic}.
[SUBJECT] {concrete scene or visual metaphor — NOT abstract concepts}.
[STYLE]  {style anchor — editorial photography / modern flat illustration / conceptual photography}.
[COLORS] {palette aligned with brand}.
[MOOD]   {inspiring / analytical / calm / energetic}.
[CONSTRAINTS] No text in image. Generous negative space for cropping.
```

The "No text in image" clause is important for hero/body images — text in the image fights with the article's own headline (unless the brief is specifically "title card with the headline rendered").

## Worked example — article on "How agentic commerce reshapes e-commerce in 2026"

**Hero (16:9, 2K, hasText=false → Flash)**:
> Conceptual editorial photography of a robotic hand and a human hand meeting over a glowing digital marketplace floating between them, with soft blue and warm gold light. Shallow depth of field, slight bokeh in the background, optimistic professional magazine style. Cream-and-navy color palette with amber accents. No text in image. Generous negative space at the top for cropping.

**Pinterest variant via `edit_image`** (3:4, 1K):
> Reframe to vertical 3:4 composition. Keep the two hands centered. Same color palette, same lighting, same editorial style. No text.

**Body 1 (16:9, 1K)**:
> Wide shot of a modern e-commerce warehouse with autonomous robots sorting packages along moving conveyor belts. Golden hour light streaming through skylights, slight haze, documentary photography style. Continue in the same cream-navy palette established in the hero. No text in image.

**Body 2 (16:9, 1K)**:
> Macro shot of a smartphone screen showing an AI shopping assistant mid-conversation, with chat bubbles visible but blurred (no readable text). Held by a person off-camera. Soft natural window light, lifestyle photography aesthetic. Continue the cream-navy palette. No readable text in image.

## Visual consistency tips

- Pick a **style anchor phrase** once ("editorial photography, soft natural light, slight film grain") and copy it into every prompt for the article.
- Pick a **color palette phrase** once ("cream, walnut, espresso brown") and reuse it verbatim.
- If the article has a recurring object (a specific product, mascot), generate it at 2K first, then pass its file path as `imagePaths` in subsequent calls. This locks identity.

## When to title-card the hero (text on image)

For "best practices" or "guide" articles where the hero acts as a thumbnail with the article title:

- Set `hasText: true` (auto-routes to Pro).
- Put the exact title in quotes: `with the headline "How Agentic Commerce Reshapes E-Commerce" in bold sans-serif, white, centered on the upper third`.
- Specify font style and position.
- Pro will render it legibly; Flash often garbles.

## Cost estimate (auto-routing on)

Typical post (1 hero + 3 body + 1 Pinterest):
- 1 hero @ 2K Flash: $0.101
- 3 body @ 1K Flash: 3 × $0.067 = $0.20
- 1 Pinterest @ 1K Flash (via edit_image): $0.067
- **Total: ~$0.37 per article**

With a title-card hero (hasText=true → Pro 2K = $0.134): +$0.03.

## Avoid

- Generic stock-photo language (`businessman shaking hands`, `rocket launching`, `lightbulb above a head`) → AI slop.
- Body images with text overlay unless the article specifically needs it.
- More than 3 distinct subjects in one image → composition falls apart.
- Calling `generate_image` 4× separately for "4 versions of the same thing" — use `numImages: 4` once.

## Hand-off

- Prompt structure / language → `nano-banana-prompting`
- Resolution / batch / model routing → `image-resolution-routing`
- Hero with text overlay → `marketing-hero`
- Infographic for a how-to post → `infographic`
- Multiple variants of the same hero (A/B testing) → `generate-variants`
- Applying a moodboard style to all images in the post → `style-transfer`
- Upscale final hero to 4K for print → `upscale-or-restore`
- Safety errors → `image-safety-handling`
