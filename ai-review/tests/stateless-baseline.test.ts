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

function buildFixtureMarts(root: string): string {
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
  return path.join(marts, "v1");
}

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stateless-baseline-"));
  temporaryDirectories.push(root);
  return root;
}

test("builds the same schema-v1 baseline from unchanged marts", () => {
  const root = temporaryRoot();
  const marts = buildFixtureMarts(root);

  const firstFile = path.join(root, "first.json");
  const secondFile = path.join(root, "second.json");
  const first = buildStatelessBaseline({
    martsDir: marts,
    outputFile: firstFile,
  });
  const second = buildStatelessBaseline({
    martsDir: marts,
    outputFile: secondFile,
  });

  expect(second).toEqual(first);
  expect(fs.readFileSync(secondFile, "utf8")).toBe(fs.readFileSync(firstFile, "utf8"));
  expect(first.sample).toEqual({ pullRequests: 1, reviewRuns: 1, modelCalls: 1 });
  expect(first.uncachedInputTokens).toBe(700);
  expect(first.baselineId).toMatch(/^[a-f0-9]{64}$/);
});

test("treats mart paths as data during SQL template substitution", () => {
  const root = temporaryRoot();
  const marts = buildFixtureMarts(root);
  const manifestFile = path.join(marts, "scorecard-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    marts: { review_run_fact: { path: string } };
  };
  const original = path.join(marts, manifest.marts.review_run_fact.path);
  const collisionPath = "review__MODEL_RUN_FACT__.parquet";
  fs.copyFileSync(original, path.join(marts, collisionPath));
  manifest.marts.review_run_fact.path = collisionPath;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  const baseline = buildStatelessBaseline({ martsDir: marts, outputFile: path.join(root, "baseline.json") });
  expect(baseline.sample.reviewRuns).toBe(1);
});

test("rejects mart paths outside the marts directory or containing control characters", () => {
  const root = temporaryRoot();
  const marts = buildFixtureMarts(root);
  const manifestFile = path.join(marts, "scorecard-manifest.json");
  const original = fs.readFileSync(manifestFile, "utf8");
  const manifest = JSON.parse(original) as { marts: { review_run_fact: { path: string } } };

  manifest.marts.review_run_fact.path = "../outside.parquet";
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  expect(() => buildStatelessBaseline({ martsDir: marts, outputFile: path.join(root, "outside.json") }))
    .toThrow(/escapes the marts directory/);

  manifest.marts.review_run_fact.path = "bad\npath.parquet";
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  expect(() => buildStatelessBaseline({ martsDir: marts, outputFile: path.join(root, "control.json") }))
    .toThrow(/unsupported characters/);
});

test("rejects mart bytes that do not match the manifest provenance", () => {
  const root = temporaryRoot();
  const marts = buildFixtureMarts(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(marts, "scorecard-manifest.json"), "utf8")) as {
    marts: { review_run_fact: { path: string } };
  };
  fs.appendFileSync(path.join(marts, manifest.marts.review_run_fact.path), "tampered");

  expect(() => buildStatelessBaseline({ martsDir: marts, outputFile: path.join(root, "baseline.json") }))
    .toThrow(/checksum does not match/);
});
