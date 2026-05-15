#!/usr/bin/env node
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
async function main() {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/install-skills.js → ../skills relative to compiled output
    const skillsSource = join(here, "..", "skills");
    const skillsDest = join(homedir(), ".claude", "skills");
    if (!existsSync(skillsSource)) {
        console.error(chalk.red(`Skills source not found at ${skillsSource}.`));
        console.error(chalk.dim("The npm package may be corrupt — try reinstalling."));
        process.exit(1);
    }
    console.log(chalk.bold.cyan("\nimage-generation — install Claude Code skills\n"));
    console.log(chalk.dim(`Source:      ${skillsSource}`));
    console.log(chalk.dim(`Destination: ${skillsDest}\n`));
    if (!existsSync(skillsDest)) {
        await mkdir(skillsDest, { recursive: true });
    }
    const sourceEntries = (await readdir(skillsSource, { withFileTypes: true })).filter((d) => d.isDirectory());
    if (sourceEntries.length === 0) {
        console.log(chalk.yellow("No skills found in the package."));
        return;
    }
    let installed = 0;
    let skipped = 0;
    for (const entry of sourceEntries) {
        const from = join(skillsSource, entry.name);
        const to = join(skillsDest, entry.name);
        const fromIsDir = (await stat(from)).isDirectory();
        if (!fromIsDir)
            continue;
        if (existsSync(to)) {
            const overwrite = await confirm({
                message: `Skill "${entry.name}" already exists at destination. Overwrite?`,
                default: false,
            });
            if (!overwrite) {
                console.log(chalk.dim(`  skip   ${entry.name}`));
                skipped++;
                continue;
            }
        }
        await cp(from, to, { recursive: true, force: true });
        console.log(chalk.green(`  ok     ${entry.name}`));
        installed++;
    }
    console.log(chalk.bold(`\nDone. Installed: ${installed}, skipped: ${skipped}.`));
    console.log(chalk.dim("\nRestart Claude Code for the skills to be picked up.\n"));
}
main().catch((cause) => {
    if (cause && typeof cause === "object" && "name" in cause && cause.name === "ExitPromptError") {
        console.log(chalk.yellow("\nCancelled."));
        process.exit(130);
    }
    console.error(chalk.red("Install failed:"), cause instanceof Error ? cause.message : cause);
    process.exit(1);
});
