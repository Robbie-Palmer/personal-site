import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  martVersion: z.string().min(1),
  marts: z.object({
    review_run_fact: z.object({ path: z.string(), rows: z.number(), sha256: z.string() }).loose(),
    model_run_fact: z.object({ path: z.string(), rows: z.number(), sha256: z.string() }).loose(),
  }).loose(),
}).loose();

const BaselineRowSchema = z.object({
  pull_requests: z.coerce.number().int().positive(),
  review_runs: z.coerce.number().int().positive(),
  model_calls: z.coerce.number().int().positive(),
  uncached_input_tokens: z.coerce.number().int().positive(),
  model_calls_per_pull_request: z.coerce.number().positive(),
  uncached_input_tokens_per_pull_request: z.coerce.number().positive(),
}).strict();

export interface StatelessBaseline {
  schemaVersion: 1;
  recordType: "ai-review-stateless-baseline";
  source: {
    martVersion: string;
    reviewRunFactSha256: string;
    modelRunFactSha256: string;
  };
  selection: { recordSchemaVersion: 1 };
  sample: { pullRequests: number; reviewRuns: number; modelCalls: number };
  uncachedInputTokens: number;
  modelCallsPerPullRequest: number;
  uncachedInputTokensPerPullRequest: number;
  baselineId: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sqlPath(file: string): string {
  const resolved = path.resolve(file);
  if (resolved.includes("'") || resolved.includes("\\") || /[\u0000-\u001f\u007f]/.test(resolved)) {
    throw new Error("SQL path contains unsupported characters");
  }
  return resolved;
}

function martPath(martsDir: string, manifestPath: string): string {
  const root = fs.realpathSync(martsDir);
  const candidate = path.resolve(root, manifestPath);
  sqlPath(candidate);
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`mart path escapes the marts directory: ${manifestPath}`);
  }
  const resolved = fs.realpathSync(candidate);
  const resolvedRelative = path.relative(root, resolved);
  if (resolvedRelative === ".." || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) {
    throw new Error(`mart path escapes the marts directory: ${manifestPath}`);
  }
  return sqlPath(resolved);
}

function baselineQuery(reviewRuns: string, modelRuns: string): string {
  const queryFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "stateless-baseline.sql");
  const template = fs.readFileSync(queryFile, "utf8");
  const replacements: Record<string, string> = {
    __REVIEW_RUN_FACT__: reviewRuns,
    __MODEL_RUN_FACT__: modelRuns,
  };
  const placeholders = template.match(/__[A-Z0-9_]+__/g) ?? [];
  if (
    placeholders.length !== 2 ||
    Object.keys(replacements).some((placeholder) =>
      placeholders.filter((candidate) => candidate === placeholder).length !== 1)
  ) {
    throw new Error(`baseline SQL must contain each mart placeholder exactly once: ${queryFile}`);
  }
  return template.replace(/__(?:REVIEW_RUN_FACT|MODEL_RUN_FACT)__/g, (placeholder) =>
    replacements[placeholder] ?? placeholder);
}

export function buildStatelessBaseline({
  martsDir,
  outputFile,
}: {
  martsDir: string;
  outputFile: string;
}): StatelessBaseline {
  const resolvedMarts = path.resolve(martsDir);
  const manifestFile = path.join(resolvedMarts, "scorecard-manifest.json");
  if (!fs.existsSync(manifestFile)) throw new Error(`scorecard manifest not found: ${manifestFile}`);
  const manifest = ManifestSchema.parse(JSON.parse(fs.readFileSync(manifestFile, "utf8")));
  const reviewRuns = martPath(resolvedMarts, manifest.marts.review_run_fact.path);
  const modelRuns = martPath(resolvedMarts, manifest.marts.model_run_fact.path);
  const query = baselineQuery(reviewRuns, modelRuns);
  const result = spawnSync("duckdb", ["-json", "-noheader", "-c", query], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`duckdb failed building stateless baseline: ${result.stderr?.trim() ?? result.error?.message}`);
  }
  const rows = z.array(BaselineRowSchema).length(1).parse(JSON.parse(result.stdout || "[]"));
  const row = rows[0];
  if (!row) throw new Error("stateless baseline query returned no rows");
  const body = {
    schemaVersion: 1,
    recordType: "ai-review-stateless-baseline",
    source: {
      martVersion: manifest.martVersion,
      reviewRunFactSha256: manifest.marts.review_run_fact.sha256,
      modelRunFactSha256: manifest.marts.model_run_fact.sha256,
    },
    selection: { recordSchemaVersion: 1 },
    sample: {
      pullRequests: row.pull_requests,
      reviewRuns: row.review_runs,
      modelCalls: row.model_calls,
    },
    uncachedInputTokens: row.uncached_input_tokens,
    modelCallsPerPullRequest: row.model_calls_per_pull_request,
    uncachedInputTokensPerPullRequest: row.uncached_input_tokens_per_pull_request,
  } as const;
  const baseline: StatelessBaseline = {
    ...body,
    baselineId: sha256(JSON.stringify(body)),
  };
  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.writeFileSync(path.resolve(outputFile), `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

function main(): void {
  const cacheRoot = process.env.AI_REVIEW_SCORECARD_CACHE || path.join(os.homedir(), ".cache", "ai-review");
  const { values } = parseArgs({
    options: {
      marts: { type: "string", default: path.join(cacheRoot, "marts", "v1") },
      output: { type: "string", default: path.join(cacheRoot, "baseline", "stateless-baseline.json") },
    },
  });
  if (!values.marts || !values.output) throw new Error("--marts and --output are required");
  const baseline = buildStatelessBaseline({ martsDir: values.marts, outputFile: values.output });
  process.stdout.write(
    `Wrote stateless baseline from ${baseline.sample.reviewRuns} runs across ${baseline.sample.pullRequests} pull requests to ${path.resolve(values.output)}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
