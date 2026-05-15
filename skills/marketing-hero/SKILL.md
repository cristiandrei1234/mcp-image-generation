---
name: marketing-hero
description: Use this when the user asks for a website hero, landing-page hero, blog header, OG / social-share image, pitch-deck slide illustration, ad creative, or any "marketing visual" / "above the fold" / "hero image". Sets sane defaults for aspect, resolution, model, and brand-consistent style — prefer this over raw generate_image for marketing deliverables.
---

# Marketing hero / OG share / pitch deck illustration

The deliverable here is a polished marketing image: clean, brand-aligned, ready for production use. Defaults are tuned for SaaS / consulting / agency aesthetic (Stripe / Linear / Anthropic family). Adjust palette per client.

## 1. Gather context (ask only if not already given)

- **Purpose**: landing-page hero / OG share card / pitch-deck slide / blog header / social carousel / ad creative
- **Brand colors** (hex codes) — or "use my brand" if reference assets are available
- **Headline copy** if any text should appear in the image
- **Mood**: premium / playful / technical / minimal / energetic

If context is missing, propose plausible defaults and ask the user to confirm rather than guessing silently.

## 2. Choose parameters

| Param | Default for marketing |
| --- | --- |
| `aspectRatio` | 21:9 for landing hero, 16:9 for OG / slide / blog, 4:5 for LinkedIn carousel |
| `resolution` | 2K (use 4K only for billboard or print) |
| `hasText` | `true` if a headline must be rendered legibly — auto-routes to Pro |
| `model` | omit (auto) — Pro fires automatically when `hasText: true` |
| `numImages` | 1 (use 2–3 only for exploration, not production) |

## 3. Construct the prompt

Use this skeleton, removing sections that don't apply:

```
[GOAL]        A {purpose} for a {industry/product}.
[SUBJECT]     {core_visual_concept — a concrete scene, not an abstract idea}.
[COMPOSITION] {aspect}, {off-center / centered}, {rule of thirds}, generous negative space on the {side} for headline copy.
[LIGHTING]    {dramatic single-source rim light from upper left / soft diffused / etc.}, {color temperature}, {mood}.
[STYLE]       ultra-clean modern aesthetic, Stripe/Linear/Anthropic-inspired, sub-pixel sharp, {photoreal | 3D render | flat illustration}.
[COLORS]      {brand hex codes} — primary {hex}, accent {hex}, background {hex}.
[TEXT]        (only if hasText=true) the headline "{exact text}" in {bold geometric sans-serif | serif | etc.}, {color}, {position}.
[CONSTRAINTS] No people, no logos (unless using brand references), no real famous figures.
[NEGATIVES]   Avoid: stock-photo clichés, gradient mesh backgrounds, generic AI aesthetic, watermarks, extra limbs.
```

## 4. Call the tool

```
generate_image({
  prompt: <built prompt>,
  aspectRatio: <chosen>,
  resolution: "2K",
  hasText: <true if headline rendered>,
  numImages: 1,
})
```

For pitch decks (multi-slide), brand consistency matters more than per-slide perfection. Generate slide 1, then for slide 2+:

```
edit_image({
  imagePaths: [<slide_1_output_path>],
  prompt: "Same visual style as the reference. New slide for the section 'X'. {new SUBJECT}. Keep colors, lighting, and design language identical.",
  aspectRatio: "16:9",
  resolution: "2K",
})
```

## 5. On safety failure

- `finishReason: "IMAGE_SAFETY"` → permanent block (celebrities, copyrighted characters, etc.). **Do NOT auto-retry.** Surface the error to the user and propose a reframe.
- `finishReason: "SAFETY"` → Layer-1 (configurable). Tighten the prompt with semantic positives and retry ONCE.

See the `image-safety-handling` skill for the full policy.

## 6. Output

Save returned path(s); display the file path and a one-line description back to the user.

## Examples (production-ready prompts)

### Landing-page hero, dark premium SaaS aesthetic (21:9, 2K, no text)

> A wide cinematic hero for a SaaS landing page about AI agent orchestration. An abstract isometric scene of geometric crystalline shapes floating in a void, glass-like translucency catching colored light, suggesting nodes in a network. 21:9, composition off-center to the right to leave generous left-side negative space for the headline. Dramatic single-source rim light from upper left, deep teal-to-violet gradient ambient, subtle volumetric haze. Color palette: #0A0A0F deep near-black, #6366F1 indigo accents, #F59E0B amber highlights. Style: ultra-clean 3D render, Stripe-meets-Linear aesthetic, sub-pixel sharp. No text, no logos, no people. Avoid: stock-photo clichés, gradient mesh backgrounds, generic AI aesthetic.

### OG image with headline (16:9, 2K, hasText=true → Pro)

> Horizontal 16:9 social share for an article titled "The State of AI in 2026." Background: dark navy #0F172A with a faint dotted grid. Foreground: a single bold 3D geometric icon of interconnected glowing cyan nodes on the left third. Right two-thirds: the headline "The State of AI in 2026" in clean bold sans-serif (Inter family), white, large; subtitle "Trends, models, and what comes next" in lighter grey below. Bottom-right corner: a small "yourcompany.com" tag. Text must be sharp, perfectly spelled, properly kerned. No watermarks, no stock-photo people, no generic AI aesthetic.

→ call with `hasText: true`.

### McKinsey-style pitch slide (16:9, 2K, hasText=true → Pro)

> 16:9 deck slide explaining the three pillars of an AI automation platform: "Connect", "Orchestrate", "Govern". McKinsey-consulting visual style: white background, generous negative space, single horizontal row of three pillars, each represented by a minimal geometric icon (plug, conductor's wand, shield). Each pillar's title in bold dark navy below its icon, a two-sentence description in mid-grey under the title. Top-left header reads "Q2 2026" in small caps. Bottom-right corner: subtle page-number "3/24". Typography: Inter, geometric, professional. No photographs, no decorative gradients, no clipart.

→ call with `hasText: true`.

## Avoid

- Stock-photo cliché subjects (`businessman shaking hands`, `lightbulb idea`, `rocket launch`).
- Asking for "logos" without brand reference images attached.
- Real celebrities or named characters (Disney, Marvel) — IMAGE_SAFETY blocks.
- Trying to fit a paragraph of marketing copy inside an image. Anything > 400 words of rendered text degrades, even on Pro.

## Hand-off

- For e-commerce single-product or lifestyle imagery → `ecommerce-product-shot` or `lifestyle-shot`.
- For data viz / infographics → `infographic`.
- For multi-slide decks needing strict brand consistency across 5+ slides → `combine-references` (with a brand reference library).
- For producing variants of a hero (color swaps, A/B tests) → `generate-variants`.
- For applying a moodboard's style to a hero subject → `style-transfer`.
- For upscaling the final hero to 4K for billboard / print → `upscale-or-restore`.
- For generic prompt structure rules → `nano-banana-prompting`.
