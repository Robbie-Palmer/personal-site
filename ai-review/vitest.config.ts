import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(
        __dirname,
        "tests/cloudflare-workers.ts",
      ),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", ["lcovonly", { projectRoot: ".." }]],
      reportsDirectory: path.resolve(__dirname, "coverage"),
    },
  },
});
