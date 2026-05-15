# image-generation — MCP server for Google Nano Banana 2 + Pro

An MCP (Model Context Protocol) server that gives Claude Code and other MCP-capable clients access to Google's image-generation models, with auto-routing between **Nano Banana 2** (Flash 3.1, fast/cheap default) and **Nano Banana Pro** (Gemini 3 Pro Image, premium for text and multi-reference work).

Ships with **12 Claude Code skills** that teach the AI when and how to use the tools — marketing heroes, e-commerce product shots, infographics, style transfer, variants, compositing, upscale/restore, safety handling, and more.

> **License:** PolyForm Noncommercial 1.0.0. Free for personal and internal use. Installing or selling it for a paying client requires a commercial license — see [LICENSE](LICENSE).

---

## What it does

Exposes 6 tools over MCP stdio:

| Tool | Purpose |
| --- | --- |
| `generate_image` | Text-to-image. Auto-routes Flash → Pro when `hasText`, `>3 refs`, or `resolution=4K`. |
| `edit_image` | Image+text-to-image. Edits, reframes, style transfer, compositing (1–14 references). |
| `batch_generate_image` | Async batch of up to 100 requests, ~24h delivery, 50% price. |
| `batch_get_job` | Poll a batch job; downloads images when complete. |
| `batch_list_jobs` | List recent batch jobs. |
| `list_capabilities` | Full reference for models, aspect ratios, resolutions, routing rules. |

Plus 12 skills (markdown files) the AI loads on demand to pick the right tool with the right parameters for each scenario.

---

## Prerequisites

- **Node.js ≥ 18** (Node 20 or 22 recommended) — <https://nodejs.org>
- **Git** (so npm can clone the repo during install) — usually preinstalled on macOS/Linux; on Windows install via <https://git-scm.com> or `winget install Git.Git`
- **Google AI Studio API key** — get one free at <https://aistudio.google.com/apikey>
  - The key starts with `AIza...`
  - Billing must be enabled in Google AI Studio to use Nano Banana Pro (Flash works on the free tier)
- **Claude Code** (or any MCP-capable client) — <https://claude.com/claude-code>

---

## Install (one command, all platforms)

```bash
npm install -g github:cristiandrei1234/mcp-image-generation
```

That's it. npm clones the repo, builds it, and puts the three commands on your `PATH`:

- `image-generation` — the MCP server (stdio)
- `image-generation-init` — interactive setup (asks for API key, default aspect, default resolution)
- `image-generation-install-skills` — copies the 12 skills into your Claude Code skills directory

### Platform notes

- **Windows:** open PowerShell or Windows Terminal. If `npm install -g` fails with permissions, run the terminal as Administrator, OR set a user-level npm prefix once:
  ```powershell
  mkdir -Force $env:APPDATA\npm
  npm config set prefix $env:APPDATA\npm
  # then add %APPDATA%\npm to your PATH if it isn't already
  ```
- **macOS:** if `npm install -g` complains about EACCES, fix permissions with:
  ```bash
  mkdir -p ~/.npm-global
  npm config set prefix ~/.npm-global
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
  source ~/.zshrc
  ```
- **Linux:** same as macOS, or use `sudo npm install -g …` if you don't mind global writes.

### Update later

```bash
npm install -g github:cristiandrei1234/mcp-image-generation
```

Same command. npm re-clones the latest `main`, rebuilds, replaces the bins.

### Uninstall

```bash
npm uninstall -g image-generation
```

---

## Configure (run once)

```bash
image-generation-init
```

This prompts you for:
1. Google AI Studio API key (input masked).
2. Default aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4, 21:9).
3. Default resolution (1K, 2K, 4K).

The config is saved to:
- **Windows:** `%USERPROFILE%\.automwise\gimage.json`
- **macOS / Linux:** `~/.automwise/gimage.json` (chmod 600)

Generated images go to `<current-directory>/Generations/Images/` — i.e. relative to wherever you launch Claude Code from.

---

## Register the MCP server with Claude Code

```bash
claude mcp add image-generation -- image-generation
```

Verify:

```bash
claude mcp list
```

You should see `image-generation` listed. **Restart Claude Code** (close completely and reopen) so it picks up the new server.

In Claude Code, ask: `call list_capabilities`. If you get back the full reference text, the server is wired correctly.

---

## Install the skills

Skills are Markdown files that teach Claude **when and how** to use the tools — which model, which aspect ratio, which prompt patterns, when to escalate to Pro. They live in one of two places:

- **System-wide** — available in every project on this machine.
- **Per-project** — only when Claude Code is launched in that project's directory. Useful if you want different skills for different clients.

### System-wide install (one command)

```bash
image-generation-install-skills
```

Copies all 12 skills into:
- **Windows:** `%USERPROFILE%\.claude\skills\`
- **macOS / Linux:** `~/.claude/skills/`

It asks for confirmation before overwriting any skill that already exists at the destination.

### Per-project install

If you want the skills only in a specific project (e.g. one client's repo):

**Windows (PowerShell):**

```powershell
cd path\to\your\project
New-Item -ItemType Directory -Force .claude\skills | Out-Null
$src = Join-Path (npm root -g) 'image-generation\skills'
Copy-Item -Recurse "$src\*" .claude\skills\
```

**macOS / Linux (bash/zsh):**

```bash
cd /path/to/your/project
mkdir -p .claude/skills
cp -r "$(npm root -g)/image-generation/skills"/* .claude/skills/
```

### Verify skills are loaded

Restart Claude Code. In the project (or any project, for system-wide install), ask:
> *what image-generation skills do you have available?*

Claude should list at least these 12:
`nano-banana-prompting`, `image-resolution-routing`, `image-workflows-blog`, `marketing-hero`, `ecommerce-product-shot`, `lifestyle-shot`, `infographic`, `style-transfer`, `generate-variants`, `combine-references`, `upscale-or-restore`, `image-safety-handling`.

---

## Using it

Once the server and skills are installed and Claude Code is restarted, you ask in natural language:

| You say | What happens |
| --- | --- |
| "Generate a hero image for our SaaS landing page, dark premium aesthetic" | `marketing-hero` skill activates → `generate_image` with `aspectRatio: 21:9`, `resolution: 2K`. |
| "Make a poster with the headline 'Build agents that ship'" | `marketing-hero` with `hasText: true` → auto-routes to Pro for legible text. |
| "Take this product photo and produce 5 color variants" | `generate-variants` activates; chains `edit_image` from the original anchor. |
| "Combine this dress photo with this model in a beach setting" | `combine-references` activates; >3 refs → auto-routes to Pro. |
| "Upscale this image to 4K" | `upscale-or-restore` activates; 4K → Pro. |
| "I need 80 product images for the catalog by tomorrow" | `image-resolution-routing` recommends `batch_generate_image` for 50% off. |
| "Generate an infographic explaining how MCP servers work" | `infographic` activates with `hasText: true` → Pro. |

Files are saved to `<cwd>/Generations/Images/`. Claude returns the absolute path in its reply.

---

## Tool reference

The canonical reference (aspect ratios, resolutions, person-generation policies, retry rules, safety policies) is updated alongside the code — ask Claude to call `list_capabilities` to see it.

Short summary:

- **Aspect ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `2:3`, `3:2`, `4:5`, `5:4`, `21:9`, `8:1`, `1:8`, `4:1`, `1:4`.
- **Resolutions:** `512` (Flash only), `1K`, `2K`, `4K` (4K auto-routes to Pro).
- **Models:** `auto` (default), `flash`, `pro`.
- **Auto-routing triggers:** `hasText: true`, `resolution: '4K'`, or `>3` reference images → Pro.

---

## Troubleshooting

**`No config found … Run image-generation-init first.`**
You skipped step 2. Run `image-generation-init`.

**`HTTP 401` / `Authentication failed`**
API key invalid or revoked. Re-run `image-generation-init` to set a new one.

**`Quota exceeded` (HTTP 429)**
You've hit Google's free-tier rate limit. The server auto-retries with backoff. For sustained load, enable billing in Google AI Studio or use the Batch API for bulk non-urgent work.

**`Generation blocked by safety policy`**
Google's IMAGE_SAFETY filter caught the prompt or output. See the `image-safety-handling` skill — most permanent blocks (real celebrities, copyrighted characters, financial-document tampering) cannot be retried around.

**Claude doesn't see the MCP server after restart**
Check `claude mcp list`. If `image-generation` is missing, re-run `claude mcp add image-generation -- image-generation`. If the command itself isn't found, verify the global install:
```bash
which image-generation         # macOS/Linux
Get-Command image-generation   # PowerShell
```
If empty, your global npm bin directory isn't on PATH (see Platform notes above).

**Claude doesn't seem to use the skills**
Confirm they're on disk: `ls ~/.claude/skills/` should show 12 directories. If empty, run `image-generation-install-skills`. Each skill needs a `SKILL.md` with YAML frontmatter (`name:`, `description:`) for Claude to load it.

**Windows: `npm install -g` fails with EPERM / EACCES**
Either run PowerShell as Administrator OR set a user-level npm prefix (see Platform notes).

**Windows: paths with backslashes break in `claude mcp add` (rare with global install)**
With `claude mcp add image-generation -- image-generation` you don't need paths at all. Only relevant if you're running from a local checkout.

---

## Development / contributing

If you want to hack on the source rather than just use it:

```bash
git clone https://github.com/cristiandrei1234/mcp-image-generation.git
cd mcp-image-generation
npm install              # installs deps + auto-builds via the `prepare` script
node dist/init.js        # local setup
```

Useful scripts:

```bash
npm run build            # compile src/ → dist/
npm run typecheck        # tsc --noEmit (covers src + tests)
npm test                 # vitest run (unit + integration + e2e, 156 tests)
npm run test:watch       # vitest in watch mode
npm run test:coverage    # generates HTML report in coverage/
npm run inspect          # launch MCP Inspector against the local build
```

To register your local build with Claude Code instead of the npm-installed one:

```bash
claude mcp remove image-generation       # remove the global registration first
claude mcp add image-generation -- node /absolute/path/to/repo/dist/server.js
```

CI runs on every push to `main` and on PRs — Node 20 + 22 × Ubuntu + Windows matrix. See `.github/workflows/ci.yml`.

---

## Project layout

```
src/
├── config/            # Zod schema + load/save (chmod 600)
├── infra/             # Result type, GeminiError, logger, retry wrapper
├── services/
│   ├── gemini-image.ts   # @google/genai wrapper + auto-routing
│   └── gemini-batch.ts   # Batch API wrapper
├── tools/             # MCP tool handlers (generate, edit, list_capabilities, batch_*)
├── server.ts          # MCP bootstrap (stdio + graceful shutdown)
├── init.ts            # Interactive setup CLI
└── install-skills.ts  # Copies skills/ → ~/.claude/skills/

skills/                # 12 Claude Code skill markdown files
tests/                 # Vitest unit + integration + e2e (156 tests)
```

---

## License

PolyForm Noncommercial 1.0.0 + Commercial Addendum. See [LICENSE](LICENSE).

**Short version:**
- **Free** for personal use, hobby projects, education, evaluation, and **internal use within your own company** (even for-profit companies, as long as you're not selling the software itself).
- **Paid commercial license required** to: install this for a paying client, sell or sublicense it, offer it as a paid hosted/SaaS service, or bundle it in a paid product.

For a commercial license, contact **cristian@automwise.com** with intended use and approximate scale.
