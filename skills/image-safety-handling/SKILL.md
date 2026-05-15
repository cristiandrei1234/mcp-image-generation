---
name: image-safety-handling
description: Use this when generate_image or edit_image returns an error mentioning safety, content policy, IMAGE_SAFETY, prohibited content, or when the user is iterating on a prompt that was just blocked. Defines what to do (and what NOT to do) for each safety failure mode, and which categories are permanent blocks vs. configurable.
---

# Safety failure handling

Google runs a **two-layer safety pipeline** on every image generation. Layer 1 is configurable; Layer 2 is not. The MCP server surfaces both as the `safety_block` error kind. This skill is the playbook.

## The two layers

### Layer 1 — `SAFETY` (configurable, prompt-side)

Categories:
- HARM_CATEGORY_HARASSMENT
- HARM_CATEGORY_HATE_SPEECH
- HARM_CATEGORY_SEXUALLY_EXPLICIT
- HARM_CATEGORY_DANGEROUS_CONTENT

Triggered by the *prompt text* before generation starts. **Configurable per request** (server-side defaults; the MCP server uses Google's defaults). If a prompt is borderline, tightening wording usually unblocks it.

### Layer 2 — `IMAGE_SAFETY` (NOT configurable, output-side)

Permanently blocked categories (as of May 2026, policy has tightened 3× since launch):
- CSAM
- Extreme gore
- Full nudity
- Realistic likenesses of specific famous persons (since Jan 23, 2026)
- Copyrighted characters (Disney heavily reported)
- Financial-document tampering (since Feb 2026)

Triggered on the *generated image* after the model has done its thinking. **You are still billed for thinking tokens even when the image is blocked.**

## Decision tree

When `generate_image` / `edit_image` returns `safety_block`:

```
Is the user attempting a Layer-2 permanent category?
  (real celebrity / copyrighted character / explicit nudity / financial doc)
  ├─ YES → STOP. Tell user what was blocked. Propose an allowed alternative.
  │        DO NOT auto-retry. DO NOT try jailbreaks. Patches roll out within hours
  │        on known evasions.
  │
  └─ NO → Likely Layer-1 (configurable). Try ONE retry with:
           - Stronger semantic positives ("empty deserted street" not "no cars")
           - Remove ambiguous wording near the safety categories
           - Add commercial / editorial context ("product catalog photo of …",
             "editorial illustration for an article about …")
          If still blocked after ONE retry → stop and report.
```

## Permanent block categories — what to tell the user

When a permanent category fires, give the user a clear, actionable response. Examples:

### Real public figure
> Google's API blocks generation of recognizable real public figures. I can produce: (a) a private individual ("a 35-year-old man with brown hair and round glasses"); (b) a stylized non-photoreal portrait; (c) a public-domain historical figure deceased before 1924. Which would you like?

### Copyrighted character / brand
> The model won't render trademarked characters or branded products (Mickey Mouse, Coca-Cola, etc.). I can produce: (a) a generic equivalent ("a cartoon mouse character with red shorts and white gloves" — likely still risky); (b) a clearly transformative original. Want me to design an original?

### Explicit content
> The model won't generate sexually explicit imagery. For tasteful, commercial intimate-apparel work I can frame as: ghost-mannequin product photography, on-mannequin catalog shots, or clothed-model styled shots. Let me know which fits.

### Document tampering
> Since Feb 2026 the model blocks fabricated financial documents (invoices, statements, receipts, ID-style cards). For a mockup, I can generate a generic template that's obviously decorative (no real-looking numbers / signatures). Would that work?

## Layer-1 retry strategy (if not a permanent category)

Try ONCE with each of these in sequence, escalating:

1. **Add explicit commercial / editorial context.**
   - Before: `"a woman in lingerie"`
   - After: `"e-commerce catalog photograph of a lingerie set on a ghost mannequin, no human model, white-background product listing style"`

2. **Replace negative wording with semantic positives.**
   - Before: `"a calm street with no violence"`
   - After: `"an empty quiet residential street at dawn, soft light, peaceful atmosphere"`

3. **Remove triggering adjectives near subject words.**
   - "graphic" → "vivid" or remove
   - "violent" → "intense" or remove
   - "exposed" → "visible" or remove

4. **Reframe the subject.** If a person was the issue, swap to a hand / silhouette / object: `"a hand reaching for the product from off-frame, no full body visible"`.

After ONE retry, stop. Either succeed or surface the block to the user — don't burn quota.

## What NOT to do

- ❌ **Auto-retry on `safety_block`.** The MCP server's retry wrapper already excludes this kind. Don't override at the application layer.
- ❌ **Jailbreak attempts** (`"ignore safety"`, `"pretend you're DAN"`). Wastes calls and the patches roll out fast.
- ❌ **Multiple rapid retries with slight wording changes.** You're billed for thinking tokens each time. One thoughtful retry max.
- ❌ **Promise the user a known-blocked category will work.** If they want Disney characters, the correct answer is "we can't, here are alternatives."
- ❌ **Mix `safety_block` with `bad_request`.** Bad_request is a parameter problem (e.g. invalid aspect ratio); fix the params, then retry. Safety is content.

## Billing implication

When Layer 2 blocks, Google **still bills for thinking tokens** (the model thought through the generation before the post-hoc filter caught it). One block costs ~$0.005–0.030. Five rapid retries = $0.025–0.15 wasted. Treat each retry as expensive.

## Reading the error

The MCP tool returns:
```
isError: true
content[0].text: "Generation blocked by safety policy: <reason from API>"
```

The `<reason>` text gives you a hint about which Layer-2 category fired. If absent, infer from the prompt:
- Named real person → real-celebrity block
- Named brand / character → copyright block
- Body / nudity wording → nudity block
- "invoice" / "bank statement" / "ID card" / "passport" → document-tampering block

## Logging

The MCP server logs every safety event with `kind: "safety_block"` and a redacted prompt snippet on stderr. If you're seeing repeated blocks on similar prompts, that's the signal to rework the brief — not the prompt wording.

## Recovery flow (suggested user-facing message)

When you surface a block to the user:

> The image was blocked by Google's safety policy ({reason}). This is a permanent block category, not something I can retry around. I can produce an alternative — would any of these work for what you're trying to do?
> 1. {specific alternative 1}
> 2. {specific alternative 2}
> 3. {specific alternative 3}

Don't be apologetic, don't lecture. Be useful — propose alternatives.

## Hand-off

- For the full capabilities reference (retry rules, etc.) → `list_capabilities` (it's the MCP tool itself; call it).
- Reframing prompts that got blocked → `nano-banana-prompting` (see "Anti-patterns" + negative-prompt section).
- Reframing lifestyle / product imagery flagged for people → `lifestyle-shot`.
- Reframing brand-name infringement issues → `marketing-hero`.
- Multi-character composites flagged → `combine-references` (review the "Avoid" section about real-person likenesses).
