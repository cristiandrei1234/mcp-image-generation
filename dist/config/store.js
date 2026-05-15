import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { GimageConfigSchema } from "./schema.js";
export const CONFIG_DIR = join(homedir(), ".automwise");
export const CONFIG_PATH = join(CONFIG_DIR, "gimage.json");
export async function loadConfig() {
    if (!existsSync(CONFIG_PATH)) {
        return { ok: false, reason: "missing" };
    }
    let raw;
    try {
        raw = await readFile(CONFIG_PATH, "utf-8");
    }
    catch (cause) {
        return { ok: false, reason: "unreadable", cause };
    }
    let json;
    try {
        json = JSON.parse(raw);
    }
    catch (cause) {
        return { ok: false, reason: "invalid_json", cause };
    }
    const parsed = GimageConfigSchema.safeParse(json);
    if (!parsed.success) {
        return { ok: false, reason: "schema_invalid", issues: parsed.error };
    }
    return { ok: true, config: parsed.data };
}
export async function saveConfig(config) {
    const validated = GimageConfigSchema.parse(config);
    if (!existsSync(CONFIG_DIR)) {
        await mkdir(CONFIG_DIR, { recursive: true });
    }
    await writeFile(CONFIG_PATH, JSON.stringify(validated, null, 2), "utf-8");
    try {
        await chmod(CONFIG_PATH, 0o600);
    }
    catch {
        // Windows often refuses POSIX chmod — not fatal, file is in user-owned dir.
    }
}
export function ensureDir(path) {
    if (existsSync(path))
        return Promise.resolve();
    return mkdir(path, { recursive: true }).then(() => undefined);
}
export { dirname };
