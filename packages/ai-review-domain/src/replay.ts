import { z } from "zod";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export const ReplayProviderSchema = z.enum(["openrouter", "opencode"]);
export type ReplayProvider = z.infer<typeof ReplayProviderSchema>;

export const ReplayProviderListSchema = z.array(ReplayProviderSchema)
  .min(1)
  .refine((providers) => new Set(providers).size === providers.length, "providers must be unique");

const ScoutModelExperimentSchema = z.object({
  kind: z.literal("scout-model"),
  models: z.array(z.object({
    model: z.string().trim().min(1),
    provider: ReplayProviderSchema,
  }).strict()).min(1),
}).strict();

const MergerModelExperimentSchema = z.object({
  kind: z.literal("merger-model"),
  model: z.string().trim().min(1),
}).strict();

const PromptVersionExperimentSchema = z.object({
  kind: z.literal("prompt-version"),
  prompt: z.object({
    version: z.string().trim().min(1),
    scoutSystem: z.string().trim().min(1),
    mergerSystem: z.string().trim().min(1),
  }).strict(),
}).strict();

const CoveragePolicyExperimentSchema = z.object({
  kind: z.literal("coverage-policy"),
  policy: z.object({
    version: z.string().trim().min(1),
    mode: z.enum(["recorded", "full"]),
  }).strict(),
}).strict();

export const ReplayExperimentSchema = z.discriminatedUnion("kind", [
  ScoutModelExperimentSchema,
  MergerModelExperimentSchema,
  PromptVersionExperimentSchema,
  CoveragePolicyExperimentSchema,
]);
export type ReplayExperiment = z.infer<typeof ReplayExperimentSchema>;

export const ReplayLimitsSchema = z.object({
  maxModels: z.number().int().positive(),
  maxScoutTokens: z.number().int().positive(),
  maxMergerTokens: z.number().int().positive(),
  maxCostUsd: z.number().positive(),
  allowedProviders: ReplayProviderListSchema,
  requireZeroDataRetention: z.boolean(),
  timeoutMs: z.number().int().positive().max(MAX_TIMER_DELAY_MS),
  maxRepetitions: z.number().int().positive(),
}).strict();
export type ReplayLimits = z.infer<typeof ReplayLimitsSchema>;
