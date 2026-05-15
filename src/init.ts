#!/usr/bin/env node
import { password, select, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import {
  CONFIG_PATH,
  loadConfig,
  saveConfig,
} from "./config/store.js";
import {
  AspectRatioSchema,
  ResolutionSchema,
  type AspectRatio,
  type Resolution,
  type GimageConfig,
} from "./config/schema.js";

async function main(): Promise<void> {
  console.log(chalk.bold.cyan("\nimage-generation — setup\n"));

  const existing = await loadConfig();
  if (existing.ok) {
    const overwrite = await confirm({
      message: `Config already exists at ${CONFIG_PATH}. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.yellow("Cancelled. Existing config preserved."));
      return;
    }
  } else if (existing.reason !== "missing") {
    console.log(chalk.yellow(`Existing config is unreadable (${existing.reason}). Recreating.`));
  }

  console.log(
    chalk.dim("Get your Google AI Studio API key at https://aistudio.google.com/apikey\n"),
  );

  const apiKey = await password({
    message: "Google AI Studio API key (starts with AIza...):",
    mask: "*",
    validate: (value) => {
      if (!value) return "API key is required";
      if (!value.startsWith("AIza")) return "Google API keys start with 'AIza'";
      if (value.length < 30) return "Key looks too short";
      return true;
    },
  });

  console.log(
    chalk.dim(
      "Images will be saved under <project-dir>/Generations/Images/ (created automatically when you call the MCP from a project).\n",
    ),
  );

  const aspectRatio = (await select<AspectRatio>({
    message: "Default aspect ratio:",
    choices: [
      { name: "1:1   — square (social posts)", value: "1:1" },
      { name: "16:9  — landscape (blog hero, slides, thumbnails)", value: "16:9" },
      { name: "9:16  — portrait (stories, reels)", value: "9:16" },
      { name: "4:3   — classic landscape", value: "4:3" },
      { name: "3:4   — classic portrait", value: "3:4" },
      { name: "21:9  — ultra-wide cinematic", value: "21:9" },
    ],
    default: "1:1",
  })) as AspectRatio;

  // Validate explicitly even though select returns a typed value.
  AspectRatioSchema.parse(aspectRatio);

  const resolution = (await select<Resolution>({
    message: "Default resolution:",
    choices: [
      { name: "1K — fast, cheap (recommended for iteration)", value: "1K" },
      { name: "2K — blog hero, presentations", value: "2K" },
      { name: "4K — print, large displays", value: "4K" },
    ],
    default: "1K",
  })) as Resolution;

  ResolutionSchema.parse(resolution);

  const config: GimageConfig = {
    version: 1,
    apiKey,
    defaults: { aspectRatio, resolution },
  };

  try {
    await saveConfig(config);
  } catch (cause) {
    console.error(chalk.red("Failed to save config:"), cause);
    process.exit(1);
  }

  console.log(chalk.green(`\nConfig saved to ${CONFIG_PATH}`));
  console.log(chalk.dim(`\nNext steps:\n`));
  console.log(
    `  1. Register the MCP with Claude Code:\n     ${chalk.bold("claude mcp add image-generation -- npx -y image-generation")}\n`,
  );
  console.log(
    `  2. Install the Claude Code skills (so Claude knows when to use the tools):\n     ${chalk.bold("npx -y image-generation install-skills")}\n`,
  );
  console.log(
    chalk.dim("Tip: if you are running from source, replace the bin name above with `node dist/server.js`.\n"),
  );
}

main().catch((cause) => {
  if (cause && typeof cause === "object" && "name" in cause && (cause as { name?: string }).name === "ExitPromptError") {
    // User pressed Ctrl+C in inquirer
    console.log(chalk.yellow("\nCancelled."));
    process.exit(130);
  }
  console.error(chalk.red("Setup failed:"), cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
