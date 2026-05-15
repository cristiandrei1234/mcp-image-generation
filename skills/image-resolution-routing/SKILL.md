---
name: image-resolution-routing
description: Activate whenever calling generate_image, edit_image, or batch_generate_image. Decides model (Flash vs Pro auto-routing), resolution (512/1K/2K/4K), aspect ratio, and whether to use the batch API — to control cost and quality.
---

# Choosing model, resolution, aspect, batch mode

Both Google models are exposed through the same tools. You don't pick the model directly — you give Claude the right hints and `model: 'auto'` does the rest.

## Default behavior

If the request is ambiguous, default to:
- `model: 'auto'` (omit the field — auto is the default)
- `resolution: '1K'`
- `aspectRatio: '1:1'`
- `numImages: 1`
- `hasText: false`

You can always upscale or re-render the winner.

## Auto-routing (Flash 3.1 vs Pro)

When `model='auto'`:

| Trigger | Routes to |
| --- | --- |
| `hasText: true` | **Pro** |
| `resolution: '4K'` | **Pro** |
| `imagePaths.length > 3` (edit_image) | **Pro** |
| otherwise | **Flash** |

Force with `model: 'flash'` or `model: 'pro'` when you know.

**Cost ratios** (per single 1K image):
- Flash 1K  ≈ $0.067
- Flash 2K  ≈ $0.101
- Flash 4K  ≈ $0.15  (but `auto` routes 4K to Pro — Pro 4K ≈ $0.24)
- Pro 1K/2K ≈ $0.134
- Pro 4K    ≈ $0.24

Pro is roughly **2× the price of Flash** at 1K/2K and **~1.6× at 4K**. Use it only when one of the triggers fires or when you've already failed twice on Flash.

## Resolution decision

| Resolution | When to use |
| --- | --- |
| **512** | Drafts only. Flash exclusive (Pro rejects 512). Use for ultra-cheap A/B exploration. |
| **1K** | Default for any new prompt. Web, social, internal use. |
| **2K** | Blog hero, presentation slides, email headers, printed handouts. |
| **4K** | Print, large displays, paid-media hero creative, posters. Auto-routes to Pro. |

**Rule**: iterate at 1K (or 512 if just exploring), upscale only the final pick.

## Aspect ratio decision

| Use case | Aspect |
| --- | --- |
| Instagram/Twitter post | 1:1 |
| Blog hero, YouTube thumb, slide | 16:9 |
| Story, TikTok, reel | 9:16 |
| Pinterest / vertical magazine | 3:4 or 4:5 |
| Twitter header, email banner | 16:9 or 8:1 |
| Cinematic / desktop wallpaper | 21:9 |
| Web banner (full-width) | 8:1 (Flash only) |
| Vertical poster | 1:8 (Flash only) |

For extreme ratios (8:1, 1:8, 4:1, 1:4) verify with one image at 1K before scaling — the composition can break.

## Number of images per call

- **1 (default)** for production.
- **2–4** only when exploring variations of a new concept. Switch back to 1 once you pick a direction.

## Batch mode (when to use it)

`batch_generate_image` is async, ~24h delivery, **50% off**.

| | `generate_image` (sync) | `batch_generate_image` (async) |
| --- | --- | --- |
| Latency | seconds | up to 24h |
| Price | 1.0× | 0.5× |
| Max per call | numImages 1–4 | up to 100 independent requests |

**Pick batch when ALL of these hold:**
- You need ≥20 images.
- You can wait until tomorrow.
- You've already validated the prompt template with 1–2 sync calls.

Otherwise, stick with `generate_image`.

**Batch workflow:**
1. Validate the prompt template with 1–2 sync calls.
2. `batch_generate_image({ requests: [...], displayName })` — save the returned `batches/...` name.
3. `batch_get_job({ name })` to poll. When state is `JOB_STATE_SUCCEEDED`, the same call downloads the images.

## Retry is automatic (don't roll your own)

`generate_image` and `edit_image` auto-retry on transient failures (timeout, network, quota 429, HTTP 5xx) up to 3 times with exponential backoff. You don't need a retry loop in your code.

Permanent failures (auth, safety_block, bad_request, validation, no_image) fail immediately. **Never auto-retry on safety_block** — Google still bills you for thinking tokens.

## Cost-aware decision rules

- **Exploring options?** 1K + numImages=4 once. Then go back to numImages=1.
- **One final hero?** 2K. Upgrade to 4K only for print.
- **20+ similar images?** Validate template at 1K, then `batch_generate_image`.
- **Same character / product across many images?** First sync at 2K, then `edit_image` with that as reference (≥4 refs auto-routes to Pro for the higher human budget).

## Hand-off

- Prompt structure / anti-patterns → `nano-banana-prompting`
- Marketing hero / OG / social → `marketing-hero`
- E-commerce product shots → `ecommerce-product-shot`
- Lifestyle product → `lifestyle-shot`
- Infographic / charts → `infographic`
- Same subject, N variants (color/angle/scene) → `generate-variants`
- New subject in the style of references → `style-transfer`
- Composite from named parts of multiple references → `combine-references`
- Upscale / enhance / restore → `upscale-or-restore`
- Blog article image set → `image-workflows-blog`
- Reacting to safety errors → `image-safety-handling`
