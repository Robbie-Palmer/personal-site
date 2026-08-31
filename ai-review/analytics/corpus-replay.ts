import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { Env, ReviewWorkflowParams } from "../src/env";
import {
  createProductionReplayAdapter,
  runControlledReplay,
  type ReplayCorpusStore,
  type ReplayExperiment,
  type ReplayLimits,
} from "../src/replay-runner";

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

function positiveNumber(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be positive`);
  return parsed;
}

function exclusiveClaim(file: string): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.closeSync(fs.openSync(file, "wx"));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      snapshot: { type: "string" },
      "corpus-id": { type: "string" },
      output: { type: "string" },
      model: { type: "string" },
      provider: { type: "string", default: "openrouter" },
      "max-cost-usd": { type: "string", default: "0.25" },
      "timeout-ms": { type: "string", default: "120000" },
      repetition: { type: "string", default: "0" },
      execute: { type: "boolean", default: false },
    },
  });
  const snapshotFile = path.resolve(required(values.snapshot, "--snapshot"));
  const corpusId = required(values["corpus-id"], "--corpus-id");
  if (!/^[a-f0-9]{64}$/.test(corpusId)) {
    throw new Error("--corpus-id must be the snapshot SHA-256");
  }
  const outputRoot = path.resolve(required(values.output, "--output"));
  const model = required(values.model, "--model");
  const provider = values.provider;
  if (provider !== "openrouter" && provider !== "opencode") {
    throw new Error("--provider must be openrouter or opencode");
  }
  const repetition = Number(values.repetition);
  if (!Number.isInteger(repetition) || repetition < 0) {
    throw new Error("--repetition must be a non-negative integer");
  }
  const limits: ReplayLimits = {
    maxModels: 1,
    maxScoutTokens: 8_000,
    maxMergerTokens: 6_000,
    maxCostUsd: positiveNumber(values["max-cost-usd"], "--max-cost-usd"),
    allowedProviders: provider === "openrouter" ? ["openrouter"] : ["openrouter", "opencode"],
    requireZeroDataRetention: false,
    timeoutMs: positiveNumber(values["timeout-ms"], "--timeout-ms"),
    maxRepetitions: repetition + 1,
  };
  const experiment: ReplayExperiment = {
    kind: "scout-model",
    models: [{ model, provider }],
  };
  const store: ReplayCorpusStore = {
    loadSnapshot: async (requestedCorpusId) =>
      requestedCorpusId === corpusId ? fs.readFileSync(snapshotFile, "utf8") : null,
    get: async (key) => {
      const file = path.join(outputRoot, key);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    },
    claim: async (key) => exclusiveClaim(path.join(outputRoot, `${key}.claim`)),
    put: async (key, value) => {
      const file = path.join(outputRoot, key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${value}\n`, { flag: "wx" });
    },
  };
  const params: ReviewWorkflowParams = {
    deliveryId: `replay-${corpusId}`,
    eventName: "controlled-replay",
    action: values.execute ? "execute" : "plan",
    repository: process.env.AI_REVIEW_REPOSITORY ?? "Robbie-Palmer/personal-site",
    pullRequestNumber: 0,
    force: false,
  };
  const env = process.env as unknown as Env;
  const adapter = createProductionReplayAdapter({ env, params, limits });
  const result = await runControlledReplay({
    corpusId,
    experiment,
    limits,
    repetition,
    dryRun: !values.execute,
  }, adapter, store);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
