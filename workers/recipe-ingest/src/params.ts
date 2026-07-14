import type { Env } from "./env";

export interface StageParams {
  model: string;
  requestTimeoutMs: number;
  retryLimit: number;
}

// Defaults mirror ml-pipelines/recipe-parsing/params.yaml; wrangler.toml vars override.
const DEFAULTS: Record<LlmStage, StageParams> = {
  extract: {
    model: "google/gemini-3-flash-preview",
    requestTimeoutMs: 30_000,
    retryLimit: 2,
  },
  normalize: {
    model: "google/gemini-3-flash-preview",
    requestTimeoutMs: 30_000,
    retryLimit: 2,
  },
  canonicalize: {
    model: "google/gemini-2.5-flash",
    requestTimeoutMs: 15_000,
    retryLimit: 1,
  },
};

export type LlmStage = "extract" | "normalize" | "canonicalize";

export function parseIntVar(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function stageParams(env: Env, stage: LlmStage): StageParams {
  const defaults = DEFAULTS[stage];
  const prefix = stage.toUpperCase() as Uppercase<LlmStage>;
  return {
    model: env[`${prefix}_MODEL`] ?? defaults.model,
    requestTimeoutMs: parseIntVar(
      env[`${prefix}_TIMEOUT_MS`],
      defaults.requestTimeoutMs,
    ),
    retryLimit: parseIntVar(env[`${prefix}_RETRIES`], defaults.retryLimit),
  };
}
