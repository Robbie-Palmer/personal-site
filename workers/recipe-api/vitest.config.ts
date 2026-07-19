import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", ["lcovonly", { projectRoot: "../.." }]],
      reportsDirectory: "coverage",
    },
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    globals: true,
  },
});
