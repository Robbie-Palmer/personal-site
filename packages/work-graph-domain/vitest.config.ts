import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: [
        "text",
        ["lcovonly", { projectRoot: path.resolve(packageDirectory, "../..") }],
      ],
      reportsDirectory: path.resolve(packageDirectory, "coverage"),
    },
  },
});
