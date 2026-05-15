---
name: infographic
description: Use this when the user asks for an infographic, data visualization, "explainer image", how-it-works diagram, comparison chart, numbered steps illustration, technical diagram, or anything where structured layout AND legible text inside the image both matter. This is the killer use case for Nano Banana Pro — auto-routes there.
---

# Infographic / structured layout with legible text

Infographics combine three things only Nano Banana Pro does well at scale:

1. **Legible multilingual text rendering** inside the image
2. **Structured layout** — numbered steps, columns, stacked sections
3. **Factuality** — accurate-looking labels, dates, citations

Always set `hasText: true` here — this auto-routes to Pro.

## 1. Gather context

- **Topic / question**: what does the infographic explain?
- **Structure**: numbered steps (3–6) / pillars (3 horizontal) / comparison (2 columns) / timeline / hierarchy
- **Exact copy**: the user MUST provide the literal text for each section, or you should propose it and confirm. Do NOT ask the model to "generate" the copy inside the image — the model will improvise plausibly wrong text. Pre-write all copy.
- **Brand colors**: hex codes
- **Source citation**: optional bottom line ("Source: …, 2026")

## 2. Choose parameters

| Param | Default |
| --- | --- |
| Tool | `generate_image` |
| `aspectRatio` | 9:16 (vertical infographic, Pinterest/IG story), 16:9 (slide / web), 4:5 (social carousel) |
| `resolution` | 2K (don't go 4K — Pro 4K costs 1.8× and the difference is invisible on screens) |
| `hasText` | **true** (always — this triggers Pro auto-routing) |
| `model` | omit (auto routes to Pro via hasText) |
| `numImages` | 1 |

## 3. Prompt skeleton

```
[GOAL]        Vertical/horizontal infographic titled "{title}" for {audience}.
[STRUCTURE]   {N} {numbered sections / pillars / columns / timeline points} stacked {vertically / horizontally}.
[SECTION DETAILS]
              Section 1: icon — {icon description}; title — "{exact title}" in bold;
                         body — "{exact body copy, one sentence}".
              Section 2: …
              Section 3: …
[STYLE]       Clean Swiss / flat-design / editorial / consulting style.
[COLORS]      Background {hex}, primary {hex}, accent {hex}, text {hex}.
[TYPOGRAPHY]  {Inter / Helvetica / Geometric sans-serif}, hierarchy: section titles bold, body regular smaller.
[FOOTER]      (optional) "{source citation}, 2026" small, bottom-center, light grey.
[CONSTRAINTS] Text must be crisp, perfectly spelled, properly kerned, single-language ({lang}). Generous whitespace. No decorative gradients. No clipart icons — use flat geometric shapes.
```

## 4. Worked examples

### Vertical 9:16 process infographic ("How an MCP server actually works")

> Vertical 9:16 infographic titled "How an MCP server actually works." 4 numbered sections stacked vertically with generous space between them. Section 1: a flat-design icon of a chat bubble on the left; title "Client sends request" in bold dark navy; body "An AI assistant emits a JSON-RPC tool call." Section 2: icon of a shield with a checkmark; title "Server validates input"; body "Zod schema rejects malformed arguments before any code runs." Section 3: icon of three gears; title "Tool executes"; body "The handler delegates to a service that calls the underlying API." Section 4: icon of an inbox / response arrow; title "Response back"; body "Structured result returned to the AI assistant in standard MCP format." Footer in small grey text: "Source: modelcontextprotocol.io · 2026". Clean Swiss design, off-white background #FAFAF9, cobalt #2563EB accent for icons, dark navy #0F172A text. Inter typography. Text must be crisp, perfectly spelled, properly kerned. Generous whitespace. No gradients, no clipart.

### Horizontal 16:9 three-pillar slide ("Connect / Orchestrate / Govern")

> 16:9 deck slide infographic titled "Three pillars of AI automation." Three horizontal columns of equal width. Column 1: a minimal plug icon at top; pillar name "Connect" in bold dark navy below; subtitle "Plug into your data sources securely" in mid-grey under the title. Column 2: a conductor's wand icon; pillar name "Orchestrate"; subtitle "Sequence multi-step workflows reliably." Column 3: a shield icon; pillar name "Govern"; subtitle "Audit and approve every action." Top-left header "Q2 2026" in small caps. Bottom-right page number "3 / 24" in muted grey. White background, dark navy #0F172A primary, single amber #F59E0B accent on the icons. Inter typography, geometric, professional consulting style. Text crisp and perfectly spelled. Generous negative space between columns. No clipart, no gradients.

### Comparison chart (2 columns, 16:9 slide)

> 16:9 comparison chart titled "Sync vs. Batch image generation." Two columns of equal width separated by a thin vertical divider. Left column header "Sync (generate_image)" in bold; below in 4 stacked rows: "Latency: seconds", "Price: 1.0×", "Use: iteration", "Max: 4 images per call". Right column header "Batch (batch_generate_image)" in bold; same 4 rows: "Latency: up to 24h", "Price: 0.5×", "Use: bulk non-urgent", "Max: 100 requests per job". Each row in monospaced font for the values; row labels in regular sans-serif. White background, navy text, cobalt #2563EB highlight on the column headers. Inter typography. Text crisp and perfectly aligned. Generous whitespace.

## 5. Validation checklist

- [ ] Every word of every section matches the copy you specified (eyeball each label).
- [ ] No mis-spellings, no merged words, no random characters.
- [ ] Icons match what was described (a "shield" should look like a shield, not a generic blob).
- [ ] Numbers in any chart-like content match exactly (model can plausibly fabricate plot values — verify).
- [ ] Footer / source citation is present if specified.
- [ ] Whitespace generous; layout not cramped.

If a label is mis-spelled or the wrong text appeared:
- `edit_image` with the previous output: `"Fix only the label in section 2: change to '{correct copy}'. Keep everything else exactly the same."`
- If multiple errors, simpler to regenerate with `numImages: 2–3` and pick the best.

## 6. Limits

- **Paragraphs > 400 words** of in-image text degrade even on Pro. For dense text use a horizontal layout with bullets, not paragraphs.
- **Tiny fonts** (< 12px equivalent) garble. Keep readable.
- **Numeric labels on real charts** — the model can be off by a value or two. Use it for visual-aid charts (general shape), not for client-facing data viz with real numbers.
- **Anime / cartoon style icons** raise Layer-2 false positives — use flat geometric instead.
- **Cultural idioms in translated text** can be off — proofread non-English output with a native speaker.

## 7. Optional: search grounding for factuality

For "current state of X" infographics (e.g. "Top AI models in 2026"), if you have a grounded tool exposed, run a fact-check FIRST with text-only Gemini 3, then pass the verified copy into the image prompt. The MCP server here doesn't expose search grounding directly yet — write the copy in chat first, then pass it to `generate_image`.

## Avoid

- Asking the model to invent the data ("show 5 trends in AI"). It will fabricate plausible-sounding wrong content.
- Generic "infographic style" without specifying layout — you get an unstructured grid of icons.
- Trying to fit 10+ sections in one image — split into multiple.
- Tiny fonts to fit more copy — better to use a taller aspect (9:16 or 1:8 vertical poster).

## Hand-off

- Plain text on a hero image (no data structure) → `marketing-hero`.
- Photo + text overlay → `marketing-hero` with `hasText: true`.
- Series of infographics in the same visual style → `style-transfer` (apply look across new content).
- Translated variants (same layout, different language) → `generate-variants`.
- Print-quality 4K final → `upscale-or-restore`.
- Prompt structure rules → `nano-banana-prompting`.
- Routing / cost → `image-resolution-routing`.
- Safety errors → `image-safety-handling`.
