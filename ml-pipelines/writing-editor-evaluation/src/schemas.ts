import { z } from "zod";

import { ContentHashSchema } from "writing-editor-domain/suggestions";

export const ArtifactTypeSchema = z.enum(["adr", "project-page"]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const SplitSchema = z.enum(["train", "development", "holdout"]);
export type Split = z.infer<typeof SplitSchema>;

const ArtifactIdSchema = z.string().regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "must be a lowercase path-safe ID",
);
const GitCommitSchema = z.string().regex(/^[a-f0-9]{40}$/, "must be a full Git commit hash");
const RepositoryPathSchema = z.string().min(1).superRefine((value, context) => {
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    context.addIssue({ code: "custom", message: "must be a safe repository-relative path" });
  }
});

const SourceEntrySchema = z.object({
  artifactId: ArtifactIdSchema,
  artifactType: ArtifactTypeSchema,
  path: RepositoryPathSchema,
  sourceRevision: GitCommitSchema,
  publishedRevision: GitCommitSchema,
  outcomeStatus: z.literal("unrecorded"),
}).strict().superRefine((entry, context) => {
  if (entry.sourceRevision === entry.publishedRevision) {
    context.addIssue({
      code: "custom",
      message: "sourceRevision and publishedRevision must differ",
      path: ["publishedRevision"],
    });
  }
});

export const CorpusSourceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("writing-editor-corpus-source-manifest"),
  entries: z.array(SourceEntrySchema).min(1),
}).strict().superRefine((manifest, context) => {
  const ids = manifest.entries.map(({ artifactId }) => artifactId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "artifact IDs must be unique", path: ["entries"] });
  }
});
export type CorpusSourceManifest = z.infer<typeof CorpusSourceManifestSchema>;

export const ExtractedRevisionSchema = z.object({
  revision: GitCommitSchema,
  committedAt: z.iso.datetime({ offset: true }),
  contentHash: ContentHashSchema,
  bytes: z.number().int().nonnegative(),
  file: z.string().min(1),
}).strict();

export const DatasetEntrySchema = z.object({
  artifactId: ArtifactIdSchema,
  artifactType: ArtifactTypeSchema,
  path: RepositoryPathSchema,
  outcomeStatus: z.literal("unrecorded"),
  source: ExtractedRevisionSchema,
  published: ExtractedRevisionSchema,
}).strict();
export type DatasetEntry = z.infer<typeof DatasetEntrySchema>;

export const DatasetManifestSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("writing-editor-dataset"),
  datasetId: z.string().regex(/^dataset:v1:[a-f0-9]{64}$/),
  sourceManifestHash: ContentHashSchema,
  entries: z.array(DatasetEntrySchema).min(1),
}).strict();
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;

const SplitRatiosSchema = z.object({
  train: z.number().positive().lt(1),
  development: z.number().positive().lt(1),
  holdout: z.number().positive().lt(1),
}).strict().superRefine((ratios, context) => {
  const sum = ratios.train + ratios.development + ratios.holdout;
  if (Math.abs(sum - 1) > Number.EPSILON * 10) {
    context.addIssue({ code: "custom", message: "split ratios must sum to 1" });
  }
});

export const PipelineParamsSchema = z.object({
  cohort: z.object({
    frozenAt: z.iso.datetime(),
    seed: z.string().trim().min(1),
    split: SplitRatiosSchema,
    requiredArtifactTypes: z.array(ArtifactTypeSchema).min(1).refine(
      (types) => new Set(types).size === types.length,
      "required artifact types must be unique",
    ),
  }).strict(),
}).strict();
export type PipelineParams = z.infer<typeof PipelineParamsSchema>;

export const FrozenEntrySchema = DatasetEntrySchema.extend({
  split: SplitSchema,
}).strict();
export type FrozenEntry = z.infer<typeof FrozenEntrySchema>;

export const FrozenCohortSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("writing-editor-frozen-cohort"),
  cohortId: z.string().regex(/^cohort:v1:[a-f0-9]{64}$/),
  datasetId: z.string().regex(/^dataset:v1:[a-f0-9]{64}$/),
  frozenAt: z.iso.datetime(),
  seed: z.string().min(1),
  splitRatios: SplitRatiosSchema,
  entries: z.array(FrozenEntrySchema).min(1),
}).strict();
export type FrozenCohort = z.infer<typeof FrozenCohortSchema>;

const ArtifactCountsSchema = z.object({
  adr: z.number().int().nonnegative(),
  "project-page": z.number().int().nonnegative(),
}).strict();

export const ReadinessSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("writing-editor-cohort-readiness"),
  cohortId: z.string().regex(/^cohort:v1:[a-f0-9]{64}$/),
  ready: z.boolean(),
  revisions: z.object({
    complete: z.boolean(),
    extractedPairs: z.number().int().nonnegative(),
    missingArtifactIds: z.array(ArtifactIdSchema),
  }).strict(),
  outcomes: z.object({
    complete: z.boolean(),
    recorded: z.number().int().nonnegative(),
    missingArtifactIds: z.array(ArtifactIdSchema),
  }).strict(),
  coverage: z.object({
    total: z.number().int().nonnegative(),
    requiredArtifactTypesPresent: z.boolean(),
    byArtifactType: ArtifactCountsSchema,
    bySplit: z.object({
      train: ArtifactCountsSchema,
      development: ArtifactCountsSchema,
      holdout: ArtifactCountsSchema,
    }).strict(),
  }).strict(),
}).strict();
export type Readiness = z.infer<typeof ReadinessSchema>;
