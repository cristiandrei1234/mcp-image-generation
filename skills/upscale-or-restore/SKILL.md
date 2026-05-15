---
name: upscale-or-restore
description: Use this when the user wants to upscale, enhance, sharpen, restore, repair, or "improve" an existing image — old photos, low-resolution outputs from a previous call, scans, screenshots needing detail, the final pick from a variant chain. Routes to Pro at 4K automatically when the goal is a high-quality enhanced version.
---

# Upscale, enhance, restore

This skill wraps `edit_image` with the right defaults for going FROM an existing image TO a cleaner, sharper, larger, or restored version of it. The model preserves the content; it improves the quality.

Three common goals:

- **Upscale** — produce a higher-resolution version of a smaller image.
- **Enhance** — sharpen, denoise, color-correct an existing image.
- **Restore** — repair damaged / old / scratched / faded photos.

Importantly: this is NOT a generative reframe (use `edit_image` directly for that), NOT a style transfer (use `style-transfer`), and NOT a variant (use `generate-variants`). The output should be **the same content, just better quality**.

## When to activate

User says any of:
- "upscale this image"
- "make this 4K"
- "enhance this photo"
- "sharpen / denoise this"
- "restore this old photo"
- "repair this scan"
- "improve the quality of …"
- "the final version at 4K" (after a variant chain at 1K)

Do NOT activate when:
- User wants to change the content (a different scene, different pose) → that's `edit_image` directly with an explicit change prompt.
- User wants a brand-new image at higher res → that's `generate_image` with `resolution: "4K"`.

## 1. Gather context

- **Source image path** on disk. Required.
- **Goal**: pure upscale (no quality issues to fix) / enhance (sharpen + denoise) / restore (visible damage, color shift, fade)?
- **Target resolution**: 2K (cheap) or 4K (for print or paid media).

## 2. Choose parameters

| Param | Default for upscale / restore |
| --- | --- |
| Tool | `edit_image` |
| `imagePaths` | `[source_path]` |
| `aspectRatio` | omit (let the source decide) — only set if also reframing |
| `resolution` | **4K** (the whole point of the skill is going higher quality) |
| `model` | omit (auto). 4K auto-routes to Pro. |
| `hasText` | true if the source has text that must remain legible after upscale. Don't set false if there's text. |
| `personGeneration` | match the source — `ALLOW_ADULT` if the photo has adults |
| `seed` | optional but useful if you want to retry deterministically |
| `numImages` | 1 |

**Cost note**: Pro at 4K = $0.24 per image. Be intentional — don't reflexively 4K everything. For internal review, 2K is plenty.

## 3. Prompt patterns

### Pure upscale (no quality fix needed)

> Upscale the reference image to high resolution while preserving every detail exactly as it appears in the source.
>
> Do not alter:
>   - composition, framing, or aspect
>   - subject identity, faces, or proportions
>   - colors, lighting, or shadows
>   - any branding, text, or logos visible
>
> Only increase resolution and add per-pixel sharpness consistent with the original style. Do not introduce new objects, props, or details that weren't in the source.

### Enhance (sharpen + denoise)

> Enhance the reference image to a sharper, cleaner version, preserving all content unchanged.
>
> Improvements to apply:
>   - Reduce visible noise / grain in flat areas, keep texture where intentional
>   - Restore micro-detail in textures (fabric, skin, foliage, surfaces)
>   - Tighten focal sharpness where the source is slightly soft
>   - Correct minor white-balance issues only if the source has an obvious cast
>
> Preserve unchanged:
>   - composition, framing, aspect
>   - subject identity and proportions
>   - intentional film grain or stylistic choices
>   - all branding, text, and logos
>
> Do not introduce new content. This is a quality enhancement, not a re-imagination.

### Restore (damaged / old / faded photo)

> Restore the reference image — an old / damaged / faded photograph — to a clean, well-preserved version.
>
> Repairs to apply:
>   - Remove scratches, dust spots, tears, fold lines, and edge damage
>   - Even out faded or shifted colors back to plausible natural tones
>   - Reduce sepia / yellow cast if present, but PRESERVE any intentional vintage look
>   - Restore detail in over-exposed highlights and under-exposed shadows
>   - Sharpen subtly where the original is soft from age, but do NOT change focus or depth of field
>
> Preserve absolutely unchanged:
>   - The identity of every person in the image — face structure, age, expression must be the SAME person
>   - Composition, framing, camera angle
>   - All clothing, props, and background details
>   - The era / period feel of the photo (do not modernize)
>
> This is restoration, not re-imagination. The result should look like the photo when it was first taken, not a 2026 reshoot.

### Upscale + reframe combo (less common — usually two passes)

If the user wants both higher res AND a different aspect:

1. First call: pure reframe at 1K with `edit_image`, prompt explicitly says reframe.
2. Second call (this skill): upscale the reframed output to 2K/4K.

Doing both in one call usually loses fidelity on one or the other.

## 4. Validation

After upscale / enhance / restore, check:

- [ ] Are faces still recognizable as the SAME person? (Restoration's #1 failure mode is identity drift.)
- [ ] Is any text in the original still legible AND spelled the same?
- [ ] Did logos / branding remain in the same position and color?
- [ ] Did the model add anything that wasn't there? (Common: extra props, fake watermarks, signature artifacts.)
- [ ] Is the aspect / framing identical to source?

If anything drifted, retry with a more explicit "preserve" constraint, or accept the original at lower res.

## 5. Failure modes

- **Identity drift on faces** — biggest restoration failure. Re-prompt: `"Preserve the face structure, age, and identity of the person in the source image EXACTLY. The result must be recognizable as the same person."` If still drifting, the source may be too damaged for the model to recover identity reliably.
- **Added details that weren't there** (extra ring, watch, jewelry, props) — re-prompt: `"Do NOT add or modify objects. Only restore what is already visible in the source."`
- **Lost film grain / intentional texture** — re-prompt: `"Preserve the intentional film grain / texture / style of the source. Only fix damage, not the aesthetic."`
- **Color shift on restoration** — be specific about era: `"Match the color palette of 1970s Kodachrome / 1990s consumer film / digital ca. 2008."`
- **4K output is barely sharper than 2K** — sometimes the source is the bottleneck, not the resolution setting. If the source is 800×600 with motion blur, no model can magic it into a tack-sharp 4K. Accept the limit.

## 6. When not to use this

- The user wants a meaningfully different image (different subject, new pose, recolored, restyled). Use `edit_image` directly with a change prompt, or `generate-variants` for color/angle swaps.
- The source is a low-res render of an AI-generated image you JUST made — instead, regenerate at the target resolution in one call (cheaper than upscale-after-the-fact).

## Avoid

- 4K-ing every output reflexively — it's Pro pricing.
- "Improve this" with no goal — say upscale OR enhance OR restore, each has different prompts.
- Trying to restore extremely damaged sources (more than 50% of the photo destroyed) — the model has to fabricate; identity won't survive.
- Setting `hasText: false` when the source has text — model may delete the text. Set to true.

## Hand-off

- Source needs content change (not just quality) → `edit_image` directly.
- Multi-variant chain done, upscale the winner → call this skill on the winner at 4K.
- Brand series, upscale all the final picks → loop this skill per file.
- Catalog work final delivery → after `ecommerce-product-shot` at 1K iteration, run this skill at 2K for delivery.
- Safety errors (rare on upscale; sometimes restoration of old photos with people) → `image-safety-handling`.
