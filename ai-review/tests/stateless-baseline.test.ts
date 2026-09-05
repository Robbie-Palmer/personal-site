import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { buildStatelessBaseline } from "../analytics/stateless-baseline";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("builds the same schema-v1 baseline from unchanged marts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stateless-baseline-"));
  temporaryDirectories.push(root);
  const aiReviewRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const marts = path.join(root, "marts");
  const build = spawnSync(
    "bash",
    [
      path.join(aiReviewRoot, "analytics", "build-scorecard.sh"),
      path.join(aiReviewRoot, "analytics", "fixtures"),
      marts,
    ],
    { encoding: "utf8", shell: false },
  );
  expect(build.status, build.stderr).toBe(0);

  const firstFile = path.join(root, "first.json");
  const secondFile = path.join(root, "second.json");
  const first = buildStatelessBaseline({
    martsDir: path.join(marts, "v1"),
    outputFile: firstFile,
  });
  const second = buildStatelessBaseline({
    martsDir: path.join(marts, "v1"),
    outputFile: secondFile,
  });

  expect(second).toEqual(first);
  expect(fs.readFileSync(secondFile, "utf8")).toBe(fs.readFileSync(firstFile, "utf8"));
  expect(first.sample).toEqual({ pullRequests: 1, reviewRuns: 1, modelCalls: 1 });
  expect(first.uncachedInputTokens).toBe(700);
  expect(first.baselineId).toMatch(/^[a-f0-9]{64}$/);
});
