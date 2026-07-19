import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import type { Env } from "../src/env";
import { type LlmStage, stageParams } from "../src/params";

// Only the secret is required; stage vars are intentionally unset so the
// code-default path is what gets compared against params.yaml.
const defaultsEnv = { OPENROUTER_API_KEY: "test" } as Env;

/**
 * Model names, R2 bucket names, and the Hyperdrive id are declared
 * independently in Wrangler config, Terraform, the ML evaluation pipeline,
 * and this Worker's code defaults. These checks fail CI when the copies
 * drift instead of letting production silently run different settings from
 * the ones the pipeline scored.
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

type WranglerConfig = {
  vars?: Record<string, string>;
  hyperdrive?: Array<{ id: string }>;
  r2_buckets?: Array<{ bucket_name: string }>;
};

type StageParamsYaml = Record<
  LlmStage,
  { model: string; request_timeout_ms: number; max_retries: number }
>;

const ingestWrangler = parseToml(
  readRepoFile("workers/recipe-ingest/wrangler.toml"),
) as WranglerConfig;
const apiWrangler = parseToml(
  readRepoFile("workers/recipe-api/wrangler.toml"),
) as WranglerConfig;
const ingestPreviewWrangler = parseToml(
  readRepoFile("workers/recipe-ingest/wrangler.preview.toml"),
) as WranglerConfig;
const apiPreviewWrangler = parseToml(
  readRepoFile("workers/recipe-api/wrangler.preview.toml"),
) as WranglerConfig;
const pipelineParams = parseYaml(
  readRepoFile("ml-pipelines/recipe-parsing/params.yaml"),
) as StageParamsYaml;
const terraformVariables = readRepoFile("infra/variables.tf");

function terraformDefault(variableName: string): string {
  // Skips over one level of nested blocks (validation, etc.) so a default
  // declared after them is still found.
  const match = new RegExp(
    `variable "${variableName}" \\{(?:[^{}]|\\{[^{}]*\\})*?default\\s*=\\s*"([^"]+)"`,
    "s",
  ).exec(terraformVariables);
  if (!match?.[1]) {
    throw new Error(`No default found for Terraform variable ${variableName}`);
  }
  return match[1];
}

const LLM_STAGES: LlmStage[] = ["extract", "normalize", "canonicalize"];

describe("LLM stage parameters", () => {
  it.each(LLM_STAGES)(
    "wrangler.toml %s vars match ml-pipelines params.yaml",
    (stage) => {
      const vars = ingestWrangler.vars ?? {};
      const prefix = stage.toUpperCase();
      const expected = pipelineParams[stage];

      expect(vars[`${prefix}_MODEL`]).toBe(expected.model);
      expect(Number(vars[`${prefix}_TIMEOUT_MS`])).toBe(
        expected.request_timeout_ms,
      );
      expect(Number(vars[`${prefix}_RETRIES`])).toBe(expected.max_retries);
    },
  );

  it.each(LLM_STAGES)(
    "code defaults for %s match ml-pipelines params.yaml",
    (stage) => {
      const expected = pipelineParams[stage];

      expect(stageParams(defaultsEnv, stage)).toEqual({
        model: expected.model,
        requestTimeoutMs: expected.request_timeout_ms,
        retryLimit: expected.max_retries,
      });
    },
  );
});

describe("shared infrastructure bindings", () => {
  it("recipe-api and recipe-ingest bind the same production Hyperdrive", () => {
    expect(apiWrangler.hyperdrive).toHaveLength(1);
    expect(apiWrangler.hyperdrive?.[0]?.id).toBeTruthy();
    expect(ingestWrangler.hyperdrive).toEqual(apiWrangler.hyperdrive);
  });

  it("production R2 bucket names match the Terraform default", () => {
    const bucketName = terraformDefault("r2_recipe_artifacts_bucket_name");

    for (const config of [apiWrangler, ingestWrangler]) {
      expect(config.r2_buckets).toHaveLength(1);
      expect(config.r2_buckets?.[0]?.bucket_name).toBe(bucketName);
    }
  });

  it("preview R2 bucket names match the Terraform default", () => {
    const bucketName = terraformDefault(
      "r2_recipe_artifacts_preview_bucket_name",
    );

    for (const config of [apiPreviewWrangler, ingestPreviewWrangler]) {
      expect(config.r2_buckets).toHaveLength(1);
      expect(config.r2_buckets?.[0]?.bucket_name).toBe(bucketName);
    }
  });
});
