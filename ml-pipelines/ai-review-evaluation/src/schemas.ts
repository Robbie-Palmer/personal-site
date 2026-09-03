import { z } from "zod";
import {
  ReplayExperimentSchema,
  ReplayProviderListSchema,
} from "ai-review-domain/replay";
import {
  FindingOutcomeRecordSchema,
  ModelMetricSchema,
  PartialReviewCoverageSchema,
  PullRequestMetadataSchema,
  ReplayInputSnapshotSchema,
  ReviewFindingSchema,
  ReviewTerminalRecordSchema,
} from "ai-review-domain/records";

const VariantSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9._-]+$/, "must be a path-safe name"),
  experiment: ReplayExperimentSchema,
}).strict();

const PipelineLimitsSchema = z.object({
  maxModels: z.number().int().positive(),
  allowedProviders: ReplayProviderListSchema,
  maxScoutTokens: z.number().int().positive(),
  maxMergerTokens: z.number().int().positive(),
  maxCostUsdPerReplay: z.number().positive(),
  maxTotalCostUsd: z.number().positive(),
  timeoutMs: z.number().int().positive(),
  requireZeroDataRetention: z.boolean(),
}).strict();

export const MatchingPolicySchema = z.object({
  methods: z.array(z.enum(["finding-id", "file-hunk", "file-line"]))
    .min(1)
    .refine((methods) => new Set(methods).size === methods.length, "methods must be unique"),
  manualAdjudicationBelowConfidence: z.number().min(0).max(1),
}).strict();

export const PrimaryMetricSchema = z.enum([
  "acceptedFindingsPerReplay",
  "acceptanceRate",
  "noiseRate",
  "historicalCoverageRate",
  "providerFailureRate",
  "meanLatencyMs",
  "costUsd",
]);

export const DecisionPolicySchema = z.object({
  primaryMetrics: z.array(PrimaryMetricSchema).min(1),
  sampleUnit: z.enum(["pull-requests", "adjudicated-findings", "completed-replays"]),
  minimumSampleSize: z.number().int().positive(),
  minimumRelativeImprovement: z.number().nonnegative(),
  minimumAbsoluteImprovementWhenBaselineZero: z.number().nonnegative(),
  rejectRelativeDecline: z.number().nonnegative(),
  maximumNoiseRateIncrease: z.number().nonnegative(),
  maximumCoverageRateDrop: z.number().nonnegative(),
  maximumProviderFailureRate: z.number().nonnegative(),
}).strict();

export const BOUNDED_CHANGE_SIZE_NAMES = ["small", "medium", "substantial", "large"] as const;
export const CHANGE_SIZE_NAMES = [...BOUNDED_CHANGE_SIZE_NAMES, "oversized"] as const;
export const ChangeSizeSchema = z.enum(CHANGE_SIZE_NAMES);
export type ChangeSize = z.infer<typeof ChangeSizeSchema>;

const BoundedChangeSizeBandSchema = z.object({
  maxExclusive: z.number().int().positive(),
}).strict();

export const ChangeSizeBandsSchema = z.object({
  small: BoundedChangeSizeBandSchema,
  medium: BoundedChangeSizeBandSchema,
  substantial: BoundedChangeSizeBandSchema,
  large: BoundedChangeSizeBandSchema,
  oversized: z.object({}).strict(),
}).strict();

const PipelineParamsBaseSchema = z.object({
  source: z.object({
    repository: z.string().trim().min(1),
    exportPath: z.string().trim().min(1),
  }).strict(),
  cohort: z.object({
    frozenAt: z.iso.datetime(),
    changeSizeBands: ChangeSizeBandsSchema,
    pullRequestNumbers: z.array(z.number().int().positive())
      .refine((numbers) => new Set(numbers).size === numbers.length, "pull request numbers must be unique"),
  }).strict(),
  experiment: z.object({
    variable: z.enum(["scout-model", "merger-model", "prompt-version", "coverage-policy"]),
    baseline: VariantSchema,
    candidate: VariantSchema,
    repetitions: z.number().int().min(2),
  }).strict(),
  limits: PipelineLimitsSchema,
  matching: MatchingPolicySchema,
  decision: DecisionPolicySchema,
  replay: z.object({ mode: z.enum(["execute", "plan"]) }).strict(),
}).strict();

type PipelineParamsInput = z.infer<typeof PipelineParamsBaseSchema>;

function validateChangeSizeBands(params: PipelineParamsInput, context: z.RefinementCtx): void {
  const bounds = BOUNDED_CHANGE_SIZE_NAMES.map(
    (name) => params.cohort.changeSizeBands[name].maxExclusive,
  );
  if (!bounds.every((bound, index) => index === 0 || bound > (bounds[index - 1] ?? 0))) {
    context.addIssue({
      code: "custom",
      path: ["cohort", "changeSizeBands"],
      message: "maxExclusive values must increase from small through large",
    });
  }
}

function validateExperiment(params: PipelineParamsInput, context: z.RefinementCtx): void {
  if (params.experiment.baseline.id === params.experiment.candidate.id) {
    context.addIssue({ code: "custom", path: ["experiment", "candidate", "id"], message: "variant IDs must be distinct" });
  }
  validateVariant(params, "baseline", context);
  validateVariant(params, "candidate", context);
}

function validateVariant(
  params: PipelineParamsInput,
  role: "baseline" | "candidate",
  context: z.RefinementCtx,
): void {
  const experiment = params.experiment[role].experiment;
  if (experiment.kind !== params.experiment.variable) {
    context.addIssue({ code: "custom", path: ["experiment", role, "experiment", "kind"], message: "must match experiment.variable" });
  }
  if (experiment.kind === "scout-model") {
    if (experiment.models.length > params.limits.maxModels) {
      context.addIssue({ code: "custom", path: ["experiment", role, "experiment", "models"], message: "exceeds limits.maxModels" });
    }
    for (const model of experiment.models) {
      if (!params.limits.allowedProviders.includes(model.provider)) {
        context.addIssue({ code: "custom", path: ["experiment", role, "experiment", "models"], message: `${model.provider} is outside limits.allowedProviders` });
      }
    }
  }
}

function validateProviders(params: PipelineParamsInput, context: z.RefinementCtx): void {
  if (!params.limits.allowedProviders.includes("openrouter")) {
    context.addIssue({ code: "custom", path: ["limits", "allowedProviders"], message: "must include openrouter for the merger" });
  }
}

export const PipelineParamsSchema = PipelineParamsBaseSchema.superRefine((params, context) => {
  validateChangeSizeBands(params, context);
  validateExperiment(params, context);
  validateProviders(params, context);
});

export type PipelineParams = z.infer<typeof PipelineParamsSchema>;
export type PrimaryMetric = z.infer<typeof PrimaryMetricSchema>;

const HistoricalFindingSchema = z.object({
  finding: ReviewFindingSchema,
  outcome: FindingOutcomeRecordSchema.nullable(),
  outcomeSource: z.object({ key: z.string(), sha256: z.string() }).nullable(),
}).strict();

export const DatasetManifestSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-dataset"),
  datasetId: z.string().min(1),
  repository: z.string().min(1),
  sourceSummary: z.object({
    terminalRecords: z.number().int().nonnegative(),
    terminalWorkflowRuns: z.number().int().nonnegative(),
    terminalPullRequests: z.number().int().nonnegative(),
    replaySnapshots: z.number().int().nonnegative(),
    replayablePullRequests: z.number().int().nonnegative(),
    replaySnapshotCapturedAt: z.object({
      earliest: z.iso.datetime(),
      latest: z.iso.datetime(),
    }).strict(),
  }).strict(),
  entries: z.array(z.looseObject({
    corpusId: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotPath: z.string().min(1),
    pullRequestNumber: z.number().int().positive(),
    capturedAt: z.iso.datetime(),
    changedLines: z.number().int().nonnegative(),
    pullRequest: PullRequestMetadataSchema.optional(),
    coverage: PartialReviewCoverageSchema.nullable().optional(),
    strata: z.looseObject({
      risk: z.string(),
      riskSignals: z.array(z.string()),
      changeSize: ChangeSizeSchema,
      languages: z.array(z.string()),
      repositoryAreas: z.array(z.string()),
      outcomeAvailability: z.string(),
    }),
    historicalFindings: z.array(HistoricalFindingSchema),
  })),
});

export const FrozenCohortSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-cohort"),
  cohortId: z.string().min(1),
  datasetId: z.string().min(1),
  repository: z.string().min(1),
  sourceSummary: DatasetManifestSchema.shape.sourceSummary,
  selection: z.looseObject({
    method: z.enum(["explicit-pull-requests", "all-available-pull-requests"]),
    unit: z.literal("pull-request"),
    availablePullRequests: z.number().int().nonnegative(),
    selectedPullRequestCount: z.number().int().nonnegative(),
    selectedSnapshotCount: z.number().int().nonnegative(),
  }),
  entries: DatasetManifestSchema.shape.entries,
});

export const FrozenExperimentSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-experiment"),
  cohortId: z.string().min(1),
  experimentId: z.string().min(1),
  experiment: PipelineParamsSchema.shape.experiment,
  limits: PipelineLimitsSchema,
});

export const FrozenMatchingSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-matching-policy"),
  cohortId: z.string().min(1),
  matchingId: z.string().min(1),
  matching: MatchingPolicySchema,
});

export const FrozenDecisionSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-decision-policy"),
  cohortId: z.string().min(1),
  decisionId: z.string().min(1),
  decision: DecisionPolicySchema,
});

export const EvaluationReplayIndexSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-replay-index"),
  cohortId: z.string().min(1),
  experimentId: z.string().min(1),
  runnerDigest: z.string().min(1),
  mode: z.enum(["execute", "plan"]),
  records: z.array(z.string().min(1)),
});

export const ReplayOutputSchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.enum(["ai-review-replay-plan", "ai-review-replay-result"]),
  status: z.string().optional(),
  mergedFindings: z.array(ReviewFindingSchema).optional(),
  failures: z.array(z.string()).optional(),
  metrics: z.array(ModelMetricSchema).optional(),
  tokens: z.looseObject({ input: z.number(), output: z.number(), cachedInput: z.number() }).optional(),
  latencyMs: z.number().optional(),
  costUsd: z.number().nonnegative().optional(),
  coverage: PartialReviewCoverageSchema.optional(),
});

export const EvaluationReplaySchema = z.looseObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("ai-review-evaluation-replay"),
  cohortId: z.string().min(1),
  experimentId: z.string().min(1),
  datasetId: z.string().min(1),
  variant: z.looseObject({
    id: z.string().min(1),
    role: z.enum(["baseline", "candidate"]),
    model: z.string().min(1),
    provider: z.string().min(1),
  }),
  corpusId: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
  repetition: z.number().int().nonnegative(),
  replay: ReplayOutputSchema,
});

export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type DatasetEntry = DatasetManifest["entries"][number];
export type FrozenCohort = z.infer<typeof FrozenCohortSchema>;
export type FrozenExperiment = z.infer<typeof FrozenExperimentSchema>;
export type FrozenMatching = z.infer<typeof FrozenMatchingSchema>;
export type FrozenDecision = z.infer<typeof FrozenDecisionSchema>;
export type HistoricalFinding = z.infer<typeof HistoricalFindingSchema>;
export type Finding = z.infer<typeof ReviewFindingSchema>;
export type ReplayInputSnapshot = z.infer<typeof ReplayInputSnapshotSchema>;
export type ReviewTerminal = z.infer<typeof ReviewTerminalRecordSchema>;
export type FindingOutcome = z.infer<typeof FindingOutcomeRecordSchema>;
export type EvaluationReplay = z.infer<typeof EvaluationReplaySchema>;
export type EvaluationReplayIndex = z.infer<typeof EvaluationReplayIndexSchema>;
export type ReplayOutput = z.infer<typeof ReplayOutputSchema>;
export type MatchingPolicy = z.infer<typeof MatchingPolicySchema>;

export {
  FindingOutcomeRecordSchema as FindingOutcomeSchema,
  ReplayInputSnapshotSchema,
  ReviewTerminalRecordSchema as ReviewTerminalSchema,
};
