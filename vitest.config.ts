import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/init.ts",
        "src/install-skills.ts",
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
      },
    },
  },
});
