import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "#": resolve(__dirname, "src"),
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    setupFiles: [],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/generated/**",
        "src/components/**",
        "src/routes/**",
      ],
      // Thresholds are set to what the current suite actually achieves, not to an
      // aspiration: a config that fails every run is a config people delete.
      thresholds: {
        statements: 55,
        branches: 45,
        functions: 50,
        lines: 55,
      },
    },
  },
});
