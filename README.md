# image-generation — MCP server for Google Nano Banana 2 + Pro

An MCP (Model Context Protocol) server that gives Claude Code and other MCP-capable clients access to Google's image-generation models, with auto-routing between **Nano Banana 2** (Flash 3.1, fast/cheap default) and **Nano Banana Pro** (Gemini 3 Pro Image, premium for text and multi-reference work).

Ships with **12 Claude Code skills** that teach the AI when and how to use the tools — marketing heroes, e-commerce product shots, infographics, style transfer, variants, compositing, upscale/restore, safety handling, and more.

> **License:** PolyForm Noncommercial 1.0.0. Free for personal and internal use. Installing it for a paying client or selling it requires a commercial license — see [LICENSE](LICENSE).

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

- **Node.js ≥ 18** (Node 20 or 22 recommended)
- **Google AI Studio API key** — get one free at <https://aistudio.google.com/apikey>
  - The key must start with `AIza...`
  - **Billing must be enabled** to use Nano Banana Pro (the Flash model works on the free tier)
- **Claude Code** (or any MCP-capable client) — <https://claude.com/claude-code>

---

## Install

There are three install paths. Pick one.

### A. Install from npm (when published)

```bash
# Globally available as bin commands
npm install -g image-generation
```

> Not yet published as of this README. Use path B or C until it lands on npm.

### B. Install from source (recommended for now)

The exact commands differ slightly per OS.

#### Windows (PowerShell)

```powershell
# 1. Clone
git clone https://github.com/cristiandrei1234/mcp-image-generation.git
cd mcp-image-generation

# 2. Install + build
npm install
npm run build

# 3. Configure (interactive: asks for API key, default aspect, default resolution)
node dist/init.js
```

The config is saved to `%USERPROFILE%\.automwise\gimage.json` with restrictive permissions where the filesystem supports them.

#### macOS / Linux (bash or zsh)

```bash
# 1. Clone
git clone https://github.com/cristiandrei1234/mcp-image-generation.git
cd mcp-image-generation

# 2. Install + build
npm install
npm run build

# 3. Configure
node dist/init.js
```

The config is saved to `~/.automwise/gimage.json` with `chmod 600`.

### C. Install from a local checkout, globally linked

If you cloned the repo and want the `image-generation`, `image-generation-init`, and `image-generation-install-skills` commands available system-wide without npm publish:

```bash
cd mcp-image-generation
npm install
npm run build
npm link        # may need sudo on Linux/macOS
```

After `npm link`, the three commands are on your `$PATH`.

---

## Register the MCP server with Claude Code

After installation, tell Claude Code where to find it.

### Using the local build path (works everywhere)

#### Windows

```powershell
claude mcp add image-generation -- node "D:/path/to/mcp-image-generation/dist/server.js"
```

(Use forward slashes or escaped backslashes inside the path.)

#### macOS / Linux

```bash
claude mcp add image-generation -- node "/path/to/mcp-image-generation/dist/server.js"
```

### Using the globally linked / published binary

```bash
claude mcp add image-generation -- image-generation
```

### Verify

```bash
claude mcp list
```

You should see `image-generation` in the list. Restart Claude Code (close completely and reopen) so it picks up the new server.

In Claude Code, ask: `call list_capabilities` — you should get back the full reference text. If yes, the server is wired correctly.

---

## Install the skills

Skills are Markdown files that teach Claude when and how to use the tools (which model, which aspect ratio, which prompt patterns, when to escalate to Pro, etc.). They live in two possible locations:

- **System-wide:** `~/.claude/skills/` (macOS/Linux) or `%USERPROFILE%\.claude\skills\` (Windows) — available in every project on this machine.
- **Per-project:** `<your-project>/.claude/skills/` — only loaded when Claude Code is started in that project's directory.

### Option 1 — System-wide install (one command)

```bash
# Anywhere on your filesystem:
node /path/to/mcp-image-generation/dist/install-skills.js

# Or, if you ran `npm link`:
image-generation-install-skills
```

This copies the 12 skills from the repo's `skills/` directory into your global Claude Code skills directory. It will ask for confirmation before overwriting any skill that already exists.

### Option 2 — Per-project install

If you want the skills to apply only to a specific project (e.g. one client's repo):

#### Windows (PowerShell)

```powershell
# From inside your project directory
New-Item -ItemType Directory -Force .claude/skills | Out-Null
Copy-Item -Recurse "D:/path/to/mcp-image-generation/skills/*" .claude/skills/
```

#### macOS / Linux

```bash
# From inside your project directory
mkdir -p .claude/skills
cp -r /path/to/mcp-image-generation/skills/* .claude/skills/
```

### Verify skills are loaded

Restart Claude Code. In the project (or any project, for system-wide install), ask: `which skills do you have available for image generation?`. Claude should list at least: `nano-banana-prompting`, `image-resolution-routing`, `marketing-hero`, `ecommerce-product-shot`, `lifestyle-shot`, `infographic`, `style-transfer`, `generate-variants`, `combine-references`, `upscale-or-restore`, `image-safety-handling`, `image-workflows-blog`.

---

## Using it

Once the server and skills are installed and Claude Code is restarted, you can ask in natural language:

| You say | What happens |
| --- | --- |
| "Generate me a hero image for our SaaS landing page, dark premium aesthetic" | `marketing-hero` skill activates; calls `generate_image` with `aspectRatio: 21:9`, `resolution: 2K`. |
| "Make a poster with the headline 'Build agents that ship'" | `marketing-hero` activates with `hasText: true` → auto-routes to Pro. |
| "Take this product photo and produce 5 color variants" | `generate-variants` activates; chains `edit_image` calls with locked seed. |
| "Combine this dress photo with this model photo in a beach setting" | `combine-references` activates; >3 refs → auto-routes to Pro. |
| "Upscale this image to 4K" | `upscale-or-restore` activates; `edit_image` at 4K → auto-routes to Pro. |
| "I need 80 product images for the catalog, ready by tomorrow" | `image-resolution-routing` activates; recommends `batch_generate_image` for 50% cost. |
| "Generate an infographic explaining how MCP servers work" | `infographic` activates with `hasText: true` → Pro. |

Generated images are saved to `<current-directory>/Generations/Images/`. Claude returns the absolute file path in its reply.

---

## Tool reference

For the canonical reference (aspect ratios, resolutions, person-generation policies, retry rules, safety policies), ask Claude to call `list_capabilities` — that response is updated alongside the code, so it's always authoritative.

A short summary:

- **Aspect ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `2:3`, `3:2`, `4:5`, `5:4`, `21:9`, `8:1`, `1:8`, `4:1`, `1:4`.
- **Resolutions:** `512` (Flash only), `1K`, `2K`, `4K` (4K auto-routes to Pro).
- **Models:** `auto` (default), `flash`, `pro`.
- **Auto-routing triggers:** `hasText: true`, `resolution: '4K'`, or `>3` reference images → Pro.

---

## Updating

When you pull new code:

```bash
git pull
npm install            # in case dependencies changed
npm run build          # rebuild dist/
node dist/install-skills.js   # optional, only if skill content changed
```

You do NOT need to re-run `image-generation-init` unless the config schema changed.

---

## Running tests

```bash
npm test               # unit + integration + e2e (currently 156 tests)
npm run typecheck      # tsc --noEmit, src + tests
npm run test:coverage  # generates HTML report in coverage/
```

CI runs on every push to `main` / `master` and on PRs — see `.github/workflows/ci.yml`.

---

## Troubleshooting

**`No config found at ~/.automwise/gimage.json. Run image-generation-init first.`**
Run `node dist/init.js` (or `image-generation-init` if globally linked).

**`HTTP 401` / `Authentication failed`**
The API key in your config is invalid or expired. Re-run init.

**`Quota exceeded`**
You've hit the free-tier rate limit. Either wait (the server auto-retries with backoff), enable billing in Google AI Studio, or use the Batch API for non-urgent bulk work.

**`Generation blocked by safety policy`**
Google's IMAGE_SAFETY filter caught the prompt or output. See the `image-safety-handling` skill — most permanent blocks (real celebrities, copyrighted characters) cannot be retried around.

**Claude doesn't see the MCP server after restart**
Check `claude mcp list`. If `image-generation` is missing, re-run `claude mcp add ...`. If the command fails, verify the path to `dist/server.js` exists.

**Claude doesn't seem to use the skills**
Skills must live in `~/.claude/skills/<skill-name>/SKILL.md` (system-wide) or `<project>/.claude/skills/<skill-name>/SKILL.md` (per-project), with a YAML frontmatter `name:` and `description:`. Claude loads them based on the trigger keywords in the description.

**Windows: paths with backslashes break in `claude mcp add`**
Use forward slashes (`/`) inside the path, even on Windows — Node accepts them.

---

## Project layout

```
src/
├── config/            # Zod schema + load/save (chmod 600)
├── infra/             # Result type, GeminiError, logger, retry wrapper
├── services/
│   ├── gemini-image.ts   # Wrapper over @google/genai with auto-routing
│   └── gemini-batch.ts   # Batch API wrapper
├── tools/             # MCP tool handlers
├── server.ts          # MCP bootstrap (stdio + graceful shutdown)
├── init.ts            # Interactive setup CLI
└── install-skills.ts  # Copies skills/ → ~/.claude/skills/

skills/                # 12 Claude Code skill markdown files
tests/                 # Vitest unit + integration + e2e (156 tests)
```

---

## License

PolyForm Noncommercial 1.0.0 + Commercial Addendum. See [LICENSE](LICENSE).

Short version:
- **Free** for personal use, hobby projects, education, evaluation, and **internal use within your own company**.
- **Paid commercial license required** to: install this for a paying client, sell or sublicense it, offer it as a paid hosted service, or bundle it in a paid product.

For a commercial license, contact **cristian@automwise.com** with intended use and approximate scale.
