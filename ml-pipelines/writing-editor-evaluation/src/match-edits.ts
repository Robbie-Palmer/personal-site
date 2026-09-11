import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { diffChars } from "diff";
import { canonicalJson } from "writing-editor-domain/canonical-json";
import { verifyFindingSource, type Finding } from "writing-editor-domain/findings";
import { sha256, sourceReference } from "writing-editor-domain/suggestions";
import { z } from "zod";

import { readJson, writeJson } from "./files";
import {
  EditHunkSchema,
  EditMatchRunSchema,
  FrozenCohortSchema,
  PipelineParamsSchema,
  ValeProducerRunSchema,
  type EditHunk,
  type EditMatchRun,
  type FindingEditMatch,
} from "./schemas";

const require = createRequire(import.meta.url);
const DiffPackageSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
}).passthrough();
const JSDIFF_VERSION = DiffPackageSchema.parse(require("diff/package.json")).version;
const MATCHER_REVISION = 1;
const ALGORITHM_VERSION = `jsdiff@${JSDIFF_VERSION}+matcher.${MATCHER_REVISION}`;

const MatchEditsCliOptionsSchema = z.object({
  cohort: z.string().trim().min(1),
  corpus: z.string().trim().min(1),
  findings: z.string().trim().min(1),
  params: z.string().trim().min(1),
  output: z.string().trim().min(1),
}).strict();

export interface MatchEditsOptions {
  cohortFile: string;
  corpusRoot: string;
  findingsFile: string;
  paramsFile: string;
  outputFile: string;
}

interface MutableHunk {
  sourceStartByte: number;
  sourceEndByte: number;
  sourceText: string;
  publishedStartByte: number;
  publishedEndByte: number;
  publishedText: string;
}

function hunkId(
  sourceHash: string,
  publishedHash: string,
  hunk: MutableHunk,
): string {
  const digest = sha256(canonicalJson({
    algorithmVersion: ALGORITHM_VERSION,
    sourceHash,
    publishedHash,
    source: {
      startByte: hunk.sourceStartByte,
      endByte: hunk.sourceEndByte,
    },
    published: {
      startByte: hunk.publishedStartByte,
      endByte: hunk.publishedEndByte,
    },
  })).slice("sha256:".length);
  return `edit-hunk:v1:${digest}`;
}

/**
 * Turn a Unicode code-point diff into ordered half-open UTF-8 byte ranges.
 * Consecutive removed and added chunks belong to one replacement hunk.
 */
export function buildEditHunks(
  source: string,
  published: string,
  maxEditLength: number,
): EditHunk[] {
  const changes = diffChars(source, published, { maxEditLength });
  if (changes === undefined) {
    throw new Error(`character diff exceeded maxEditLength ${maxEditLength}`);
  }

  const sourceHash = sha256(source);
  const publishedHash = sha256(published);
  const hunks: EditHunk[] = [];
  let sourceByte = 0;
  let publishedByte = 0;
  let current: MutableHunk | undefined;

  const finishHunk = (): void => {
    if (!current) return;
    const finished = current;
    hunks.push(EditHunkSchema.parse({
      hunkId: hunkId(sourceHash, publishedHash, finished),
      source: {
        startByte: finished.sourceStartByte,
        endByte: finished.sourceEndByte,
        text: finished.sourceText,
      },
      published: {
        startByte: finished.publishedStartByte,
        endByte: finished.publishedEndByte,
        text: finished.publishedText,
      },
    }));
    current = undefined;
  };

  for (const change of changes) {
    const bytes = Buffer.byteLength(change.value, "utf8");
    if (!change.added && !change.removed) {
      finishHunk();
      sourceByte += bytes;
      publishedByte += bytes;
      continue;
    }

    current ??= {
      sourceStartByte: sourceByte,
      sourceEndByte: sourceByte,
      sourceText: "",
      publishedStartByte: publishedByte,
      publishedEndByte: publishedByte,
      publishedText: "",
    };
    if (change.removed) {
      current.sourceEndByte += bytes;
      current.sourceText += change.value;
      sourceByte += bytes;
    } else {
      current.publishedEndByte += bytes;
      current.publishedText += change.value;
      publishedByte += bytes;
    }
  }
  finishHunk();

  if (sourceByte !== Buffer.byteLength(source, "utf8")) {
    throw new Error("character diff did not consume the complete source text");
  }
  if (publishedByte !== Buffer.byteLength(published, "utf8")) {
    throw new Error("character diff did not consume the complete published text");
  }
  return hunks;
}

function sourceRangeOverlapsFinding(hunk: EditHunk, finding: Finding): boolean {
  const { startByte, endByte } = hunk.source;
  const findingStart = finding.span.startByte;
  const findingEnd = finding.span.endByte;
  if (startByte === endByte) {
    return startByte >= findingStart && startByte <= findingEnd;
  }
  return startByte < findingEnd && endByte > findingStart;
}

function ambiguityReason(
  hunk: EditHunk,
  finding: Finding,
): FindingEditMatch["reason"] {
  const { startByte, endByte } = hunk.source;
  const findingStart = finding.span.startByte;
  const findingEnd = finding.span.endByte;
  if (
    startByte === endByte &&
    (startByte === findingStart || startByte === findingEnd)
  ) {
    return "edit-touches-finding-boundary";
  }
  if (startByte < findingStart || endByte > findingEnd) {
    return "edit-crosses-finding-boundary";
  }
  return null;
}

function mapSourceBoundary(position: number, hunks: EditHunk[]): number {
  let byteDelta = 0;
  for (const hunk of hunks) {
    if (position < hunk.source.startByte) return position + byteDelta;
    if (hunk.source.startByte === hunk.source.endByte) {
      if (position === hunk.source.startByte) {
        throw new Error(`cannot map source boundary ${position} across an insertion`);
      }
    } else {
      if (position === hunk.source.startByte) return hunk.published.startByte;
      if (position < hunk.source.endByte) {
        throw new Error(`cannot map source boundary ${position} inside an edit hunk`);
      }
      if (position === hunk.source.endByte) return hunk.published.endByte;
    }
    byteDelta = hunk.published.endByte - hunk.source.endByte;
  }
  return position + byteDelta;
}

function utf8Slice(value: string, startByte: number, endByte: number): string {
  return Buffer.from(value, "utf8").subarray(startByte, endByte).toString("utf8");
}

export function matchFindingToEdits(
  finding: Finding,
  hunks: EditHunk[],
  published: string,
): FindingEditMatch {
  const relevant = hunks.filter((hunk) => sourceRangeOverlapsFinding(hunk, finding));
  const reasons = relevant.map((hunk) => ambiguityReason(hunk, finding));
  const reason = reasons.includes("edit-crosses-finding-boundary")
    ? "edit-crosses-finding-boundary"
    : reasons.includes("edit-touches-finding-boundary")
      ? "edit-touches-finding-boundary"
      : null;

  if (reason !== null) {
    return {
      findingId: finding.findingId,
      status: "manual-adjudication-required",
      hunkIds: relevant.map(({ hunkId: id }) => id),
      publishedSpan: null,
      reason,
    };
  }

  const startByte = mapSourceBoundary(finding.span.startByte, hunks);
  const endByte = mapSourceBoundary(finding.span.endByte, hunks);
  return {
    findingId: finding.findingId,
    status: relevant.length === 0 ? "unchanged" : "changed",
    hunkIds: relevant.map(({ hunkId: id }) => id),
    publishedSpan: {
      startByte,
      endByte,
      text: utf8Slice(published, startByte, endByte),
    },
    reason: null,
  };
}

function assertReference(
  label: string,
  actual: { documentId: string; revision: string; contentHash: string },
  expected: { documentId: string; revision: string; contentHash: string },
): void {
  for (const field of ["documentId", "revision", "contentHash"] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        `${label} ${field} mismatch: expected ${expected[field]}, got ${actual[field]}`,
      );
    }
  }
}

function summarize(artifacts: EditMatchRun["artifacts"]): EditMatchRun["summary"] {
  const matches = artifacts.flatMap(({ matches: artifactMatches }) => artifactMatches);
  const byStatus: EditMatchRun["summary"]["byStatus"] = {
    changed: 0,
    unchanged: 0,
    "manual-adjudication-required": 0,
  };
  for (const match of matches) byStatus[match.status] += 1;
  return {
    artifacts: artifacts.length,
    findings: matches.length,
    editHunks: artifacts.reduce((total, artifact) => total + artifact.hunks.length, 0),
    byStatus,
  };
}

export function matchPublishedEdits(options: MatchEditsOptions): EditMatchRun {
  const cohort = FrozenCohortSchema.parse(readJson(options.cohortFile));
  const producerRun = ValeProducerRunSchema.parse(readJson(options.findingsFile));
  const params = PipelineParamsSchema.parse(readJson(options.paramsFile));
  if (producerRun.cohortId !== cohort.cohortId) {
    throw new Error(
      `producer cohort mismatch: expected ${cohort.cohortId}, got ${producerRun.cohortId}`,
    );
  }

  const producerArtifacts = new Map(
    producerRun.artifacts.map((artifact) => [artifact.artifactId, artifact]),
  );
  if (producerArtifacts.size !== cohort.entries.length) {
    throw new Error("producer output must contain each frozen artifact exactly once");
  }

  const maxEditLength = params.matching.characterDiff.maxEditLength;
  const artifacts = cohort.entries.map((entry) => {
    const producerArtifact = producerArtifacts.get(entry.artifactId);
    if (!producerArtifact) {
      throw new Error(`producer output is missing artifact ${entry.artifactId}`);
    }
    if (
      producerArtifact.artifactType !== entry.artifactType ||
      producerArtifact.split !== entry.split
    ) {
      throw new Error(`producer metadata mismatch for ${entry.artifactId}`);
    }

    const source = fs.readFileSync(path.resolve(options.corpusRoot, entry.source.file), "utf8");
    const published = fs.readFileSync(
      path.resolve(options.corpusRoot, entry.published.file),
      "utf8",
    );
    const sourceRef = sourceReference(entry.path, entry.source.revision, source);
    const publishedRef = sourceReference(entry.path, entry.published.revision, published);
    assertReference(`${entry.artifactId} source`, sourceRef, {
      documentId: entry.path,
      revision: entry.source.revision,
      contentHash: entry.source.contentHash,
    });
    assertReference(`${entry.artifactId} published`, publishedRef, {
      documentId: entry.path,
      revision: entry.published.revision,
      contentHash: entry.published.contentHash,
    });
    assertReference(`${entry.artifactId} producer source`, producerArtifact.source, sourceRef);

    const hunks = buildEditHunks(source, published, maxEditLength);
    const matches = producerArtifact.findings.map(({ finding }) => {
      const verification = verifyFindingSource(finding, source);
      if (!verification.ok) {
        throw new Error(
          `invalid finding source ${finding.findingId}: ${JSON.stringify(verification.conflicts)}`,
        );
      }
      return matchFindingToEdits(finding, hunks, published);
    });
    return {
      artifactId: entry.artifactId,
      artifactType: entry.artifactType,
      split: entry.split,
      source: sourceRef,
      published: publishedRef,
      hunkIds: hunks.map(({ hunkId: id }) => id),
      hunks,
      findingIds: matches.map(({ findingId }) => findingId),
      matches,
    };
  });

  const algorithm = {
    id: "jsdiff-character-overlap" as const,
    version: ALGORITHM_VERSION,
    maxEditLength,
  };
  const digest = sha256(canonicalJson({
    cohortId: cohort.cohortId,
    producerRunId: producerRun.runId,
    algorithm,
    artifacts: artifacts.map(({ artifactId, hunkIds, matches }) => ({
      artifactId,
      hunkIds,
      matches,
    })),
  })).slice("sha256:".length);
  const result = EditMatchRunSchema.parse({
    schemaVersion: 1,
    recordType: "writing-editor-edit-match-run",
    runId: `edit-match-run:v1:${digest}`,
    cohortId: cohort.cohortId,
    producerRunId: producerRun.runId,
    algorithm,
    artifacts,
    summary: summarize(artifacts),
  });
  writeJson(options.outputFile, result);
  return result;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      cohort: { type: "string" },
      corpus: { type: "string" },
      findings: { type: "string" },
      params: { type: "string" },
      output: { type: "string" },
    },
  });
  const args = MatchEditsCliOptionsSchema.parse(values);
  const run = matchPublishedEdits({
    cohortFile: args.cohort,
    corpusRoot: args.corpus,
    findingsFile: args.findings,
    paramsFile: args.params,
    outputFile: args.output,
  });
  console.log(
    `Matched ${run.summary.findings} findings: ${run.summary.byStatus.changed} changed, ${run.summary.byStatus.unchanged} unchanged, ${run.summary.byStatus["manual-adjudication-required"]} need manual adjudication`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
