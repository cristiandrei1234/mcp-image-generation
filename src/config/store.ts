import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { GimageConfigSchema, type GimageConfig } from "./schema.js";

export const CONFIG_DIR = join(homedir(), ".automwise");
export const CONFIG_PATH = join(CONFIG_DIR, "gimage.json");

export type LoadConfigResult =
  | { ok: true; config: GimageConfig }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "unreadable"; cause: unknown }
  | { ok: false; reason: "invalid_json"; cause: unknown }
  | { ok: false; reason: "schema_invalid"; issues: ReturnType<typeof GimageConfigSchema.safeParse> extends { error: infer E } ? E : never };

export async function loadConfig(): Promise<LoadConfigResult> {
  if (!existsSync(CONFIG_PATH)) {
    return { ok: false, reason: "missing" };
  }

  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch (cause) {
    return { ok: false, reason: "unreadable", cause };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    return { ok: false, reason: "invalid_json", cause };
  }

  const parsed = GimageConfigSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: "schema_invalid", issues: parsed.error as never };
  }

  return { ok: true, config: parsed.data };
}

export async function saveConfig(config: GimageConfig): Promise<void> {
  const validated = GimageConfigSchema.parse(config);
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_PATH, JSON.stringify(validated, null, 2), "utf-8");
  try {
    await chmod(CONFIG_PATH, 0o600);
  } catch {
    // Windows often refuses POSIX chmod — not fatal, file is in user-owned dir.
  }
}

export function ensureDir(path: string): Promise<void> {
  if (existsSync(path)) return Promise.resolve();
  return mkdir(path, { recursive: true }).then(() => undefined);
}

export { dirname };
