#!/usr/bin/env node
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, CONFIG_PATH, ensureDir } from "./config/store.js";
import { createLogger } from "./infra/logger.js";
import { withRetry } from "./infra/retry.js";
import { GeminiImageService, type GenerateOpts } from "./services/gemini-image.js";
import { GeminiBatchService } from "./services/gemini-batch.js";
import { registerGenerateImage } from "./tools/generate-image.js";
import { registerEditImage } from "./tools/edit-image.js";
import { registerListCapabilities } from "./tools/list-capabilities.js";
import { registerBatchTools } from "./tools/batch-tools.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const logger = createLogger();

  const loaded = await loadConfig();
  if (!loaded.ok) {
    const hint =
      loaded.reason === "missing"
        ? `No config found at ${CONFIG_PATH}. Run \`image-generation-init\` first.`
        : loaded.reason === "schema_invalid"
          ? `Config at ${CONFIG_PATH} is invalid. Run \`image-generation-init\` to recreate it.`
          : `Failed to load config (${loaded.reason}). Run \`image-generation-init\`.`;
    process.stderr.write(`[image-generation] ${hint}\n`);
    process.exit(1);
  }

  const config = loaded.config;
  const outputDir = join(process.cwd(), "Generations", "Images");
  await ensureDir(outputDir);

  const baseService = new GeminiImageService(config.apiKey, logger, outputDir);
  const retryingService: Pick<GeminiImageService, "generate"> = {
    generate: (opts: GenerateOpts) =>
      withRetry(() => baseService.generate(opts), { logger }),
  };

  const server = new McpServer({
    name: "image-generation",
    version: VERSION,
  });

  registerGenerateImage(server, { service: retryingService, defaults: config.defaults });
  registerEditImage(server, { service: retryingService, defaults: config.defaults });
  registerListCapabilities(server);

  const batchService = new GeminiBatchService(config.apiKey, logger, outputDir);
  registerBatchTools(server, { service: batchService, defaults: config.defaults });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("server:ready", {
    version: VERSION,
    outputDir,
    cwd: process.cwd(),
    defaults: config.defaults,
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server:shutdown", { signal });
    void server
      .close()
      .catch((cause) => logger.warn("server:close_failed", { cause: String(cause) }))
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (error) => {
    logger.error("uncaught_exception", { message: error.message, stack: error.stack });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled_rejection", { reason: String(reason) });
    process.exit(1);
  });
}

main().catch((error) => {
  process.stderr.write(`[image-generation] fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
