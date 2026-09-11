import { z } from "zod";

import { FindingIdSchema, FindingSchema } from "writing-editor-domain/findings";
import {
  ContentHashSchema,
  ProducerSchema,
  SourceReferenceSchema,
} from "writing-editor-domain/suggestions";

export const ArtifactTypeSchema = z.enum(["adr", "project-page"]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const SplitSchema = z.enum(["train", "validation", "holdout"]);
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
  file: RepositoryPathSchema,
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
  validation: z.number().positive().lt(1),
  holdout: z.number().positive().lt(1),
}).strict().superRefine((ratios, context) => {
  const sum = ratios.train + ratios.validation + ratios.holdout;
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
  producers: z.object({
    vale: z.object({
      binaryVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    }).strict(),
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
      validation: ArtifactCountsSchema,
      holdout: ArtifactCountsSchema,
    }).strict(),
  }).strict(),
}).strict();
export type Readiness = z.infer<typeof ReadinessSchema>;

export const ValeSeveritySchema = z.enum(["error", "warning", "suggestion"]);
export type ValeSeverity = z.infer<typeof ValeSeveritySchema>;

export const ValeFindingRecordSchema = z.object({
  severity: ValeSeveritySchema,
  valeMatch: z.string().min(1),
  location: z.object({
    line: z.number().int().positive(),
    startColumn: z.number().int().positive(),
    endColumn: z.number().int().positive(),
  }).strict(),
  finding: FindingSchema,
}).strict();
export type ValeFindingRecord = z.infer<typeof ValeFindingRecordSchema>;

const ValeArtifactResultSchema = z.object({
  artifactId: ArtifactIdSchema,
  artifactType: ArtifactTypeSchema,
  split: SplitSchema,
  source: SourceReferenceSchema,
  findingIds: z.array(FindingIdSchema),
  findings: z.array(ValeFindingRecordSchema),
}).strict().superRefine((artifact, context) => {
  const expectedIds = artifact.findings.map(({ finding }) => finding.findingId);
  if (
    artifact.findingIds.length !== expectedIds.length ||
    artifact.findingIds.some((id, index) => id !== expectedIds[index])
  ) {
    context.addIssue({
      code: "custom",
      message: "findingIds must match findings in output order",
      path: ["findingIds"],
    });
  }
  if (new Set(expectedIds).size !== expectedIds.length) {
    context.addIssue({
      code: "custom",
      message: "an artifact cannot contain duplicate findings",
      path: ["findings"],
    });
  }
});

const FindingCountSchema = z.object({
  check: z.string().min(1),
  count: z.number().int().positive(),
}).strict();

export const ValeProducerRunSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("writing-editor-vale-producer-run"),
  runId: z.string().regex(/^producer-run:v1:[a-f0-9]{64}$/),
  cohortId: z.string().regex(/^cohort:v1:[a-f0-9]{64}$/),
  producer: ProducerSchema,
  vale: z.object({
    binaryVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    ruleSetHash: ContentHashSchema,
  }).strict(),
  artifacts: z.array(ValeArtifactResultSchema).min(1),
  summary: z.object({
    artifacts: z.number().int().positive(),
    artifactsWithFindings: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
    bySeverity: z.object({
      error: z.number().int().nonnegative(),
      warning: z.number().int().nonnegative(),
      suggestion: z.number().int().nonnegative(),
    }).strict(),
    byCheck: z.array(FindingCountSchema),
  }).strict(),
}).strict();
export type ValeProducerRun = z.infer<typeof ValeProducerRunSchema>;
