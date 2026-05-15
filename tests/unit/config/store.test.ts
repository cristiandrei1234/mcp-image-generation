import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Re-import store with a fresh module each test by mocking CONFIG_PATH via env-style indirection.
// We achieve that by re-mocking node:os.homedir to point to a temp dir before importing.

describe("config store", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "imgcfg-"));
    vi.resetModules();
    vi.doMock("node:os", async () => {
      const actual = await vi.importActual<typeof import("node:os")>("node:os");
      return { ...actual, homedir: () => tmp };
    });
  });

  afterEach(async () => {
    vi.doUnmock("node:os");
    await rm(tmp, { recursive: true, force: true });
  });

  async function importStore() {
    return await import("../../../src/config/store.js");
  }

  const validConfig = {
    version: 1 as const,
    apiKey: "AIza" + "x".repeat(35),
    defaults: { aspectRatio: "1:1" as const, resolution: "1K" as const },
  };

  it("loadConfig returns missing when file absent", async () => {
    const { loadConfig } = await importStore();
    const result = await loadConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing");
  });

  async function seedConfigFile(path: string, contents: string): Promise<void> {
    const { mkdir } = await import("node:fs/promises");
    const parent = path.replace(/[\\/][^\\/]+$/, "");
    await mkdir(parent, { recursive: true });
    await writeFile(path, contents, "utf-8");
  }

  it("loadConfig returns invalid_json on garbage file", async () => {
    const { CONFIG_PATH, loadConfig } = await importStore();
    await seedConfigFile(CONFIG_PATH, "{not json");

    const result = await loadConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_json");
  });

  it("loadConfig returns schema_invalid on missing fields", async () => {
    const { CONFIG_PATH, loadConfig } = await importStore();
    await seedConfigFile(CONFIG_PATH, JSON.stringify({ version: 1 }));

    const result = await loadConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("schema_invalid");
  });

  it("saveConfig then loadConfig returns the same data", async () => {
    const { loadConfig, saveConfig, CONFIG_PATH } = await importStore();
    await saveConfig(validConfig);

    const onDisk = JSON.parse(await readFile(CONFIG_PATH, "utf-8"));
    expect(onDisk).toEqual(validConfig);

    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config).toEqual(validConfig);
  });

  it("saveConfig refuses to persist invalid config", async () => {
    const { saveConfig } = await importStore();
    await expect(
      saveConfig({ ...validConfig, apiKey: "wrong-prefix" } as never),
    ).rejects.toThrow();
  });
});
