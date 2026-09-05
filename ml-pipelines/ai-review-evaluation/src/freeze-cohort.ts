import fs from "node:fs";
import path from "node:path";
import { readJson, resetDirectory, sha256, stableJson, writeJson } from "./artifact-files";
import { parseArgs } from "./cli-arguments";
import {
  DatasetManifestSchema,
  EvaluationReadinessSchema,
  FrozenCohortSchema,
  FrozenDecisionSchema,
  FrozenExperimentSchema,
  FrozenMatchingSchema,
  PipelineParamsSchema,
  type DatasetEntry,
  type EvaluationReadiness,
  type FrozenCohort,
  type FrozenDecision,
  type FrozenExperiment,
  type FrozenMatching,
  type PipelineParams,
} from "./schemas";

interface PullRequestGroup {
  pullRequestNumber: number;
  entries: DatasetEntry[];
}

function groupByPullRequest(entries: DatasetEntry[]): PullRequestGroup[] {
  const grouped = new Map<number, DatasetEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.pullRequestNumber) ?? [];
    group.push(entry);
    grouped.set(entry.pullRequestNumber, group);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pullRequestNumber, groupEntries]) => ({
      pullRequestNumber,
      entries: groupEntries.toSorted((left, right) => left.capturedAt.localeCompare(right.capturedAt)
        || left.corpusId.localeCompare(right.corpusId)),
    }));
}

interface Predeclaration {
  schemaVersion: 1;
  recordType: "ai-review-evaluation-predeclaration";
  frozenAt: string;
  datasetId: string;
  cohortId: string;
  experimentId: string;
  matchingId: string;
  decisionId: string;
  readinessId: string;
  predeclarationId: string;
}

interface FrozenArtifacts {
  cohort: FrozenCohort;
  experiment: FrozenExperiment;
  matching: FrozenMatching;
  decision: FrozenDecision;
  readiness: EvaluationReadiness;
  predeclaration: Predeclaration;
}

function maximumAvailableSample(
  entries: DatasetEntry[],
  params: PipelineParams,
): number {
  switch (params.decision.sampleUnit) {
    case "pull-requests":
      return new Set(entries.map((entry) => entry.pullRequestNumber)).size;
    case "completed-replays":
      return entries.length * params.experiment.repetitions;
    case "adjudicated-findings": {
      const findings = new Set<string>();
      for (const entry of entries) {
        for (const historical of entry.historicalFindings) {
          if (["confirmed-fixed", "acknowledged", "rejected"].includes(historical.outcome?.outcome ?? "")) {
            findings.add(`${entry.pullRequestNumber}#${historical.finding.findingId}`);
          }
        }
      }
      return findings.size;
    }
  }
}

function countPresence(entries: DatasetEntry[], present: (entry: DatasetEntry) => boolean) {
  const count = entries.filter(present).length;
  return { present: count, missing: entries.length - count };
}

export function buildEvaluationReadiness(
  cohort: FrozenCohort,
  params: PipelineParams,
): EvaluationReadiness {
  const entries = cohort.entries;
  const maximum = maximumAvailableSample(entries, params);
  const minimum = params.decision.minimumSampleSize;
  const fields = {
    taskType: countPresence(entries, (entry) => entry.strata.taskType !== null),
    originatingAgent: countPresence(entries, (entry) => entry.strata.originatingAgent !== null),
    languages: countPresence(entries, (entry) => entry.strata.languages.length > 0),
    repositoryAreas: countPresence(entries, (entry) => entry.strata.repositoryAreas.length > 0),
    coverage: countPresence(entries, (entry) => entry.coverage?.totalHunks !== undefined),
  };
  const metadataComplete = Object.values(fields).every(({ missing }) => missing === 0);
  const availability: Record<string, number> = {};
  let adjudicatedFindings = 0;
  for (const entry of entries) {
    const outcomeAvailability = entry.strata.outcomeAvailability;
    availability[outcomeAvailability] = (availability[outcomeAvailability] ?? 0) + 1;
    adjudicatedFindings += entry.historicalFindings.filter(({ outcome }) =>
      ["confirmed-fixed", "acknowledged", "rejected"].includes(outcome?.outcome ?? "")).length;
  }
  const body = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-readiness",
    cohortId: cohort.cohortId,
    datasetId: cohort.datasetId,
    sample: {
      unit: params.decision.sampleUnit,
      minimum,
      maximumAvailable: maximum,
      deficit: Math.max(0, minimum - maximum),
      ready: maximum >= minimum,
    },
    metadata: {
      unit: "replay-snapshots",
      total: entries.length,
      complete: metadataComplete,
      fields,
    },
    outcomes: {
      unit: "replay-snapshots",
      adjudicatedFindings,
      availability: Object.fromEntries(Object.entries(availability).sort(([left], [right]) =>
        left.localeCompare(right))),
    },
    decisionReady: maximum >= minimum && metadataComplete && adjudicatedFindings > 0,
  } as const;
  return EvaluationReadinessSchema.parse({
    ...body,
    readinessId: sha256(stableJson(body)),
  });
}

function readinessMarkdown(readiness: EvaluationReadiness): string {
  const lines = [
    "# AI review evaluation readiness",
    "",
    `Decision ready: **${readiness.decisionReady ? "yes" : "no"}**`,
    "",
    `Maximum available ${readiness.sample.unit}: ${readiness.sample.maximumAvailable} of ${readiness.sample.minimum} required.`,
    "",
    "## Metadata",
    "",
    "| Field | Present | Missing |",
    "| --- | ---: | ---: |",
  ];
  for (const [field, count] of Object.entries(readiness.metadata.fields)) {
    lines.push(`| ${field} | ${count.present} | ${count.missing} |`);
  }
  lines.push(
    "",
    "## Historical outcomes",
    "",
    `Adjudicated findings across snapshots: ${readiness.outcomes.adjudicatedFindings}`,
    "",
    "| Availability | Snapshots |",
    "| --- | ---: |",
  );
  for (const [availability, count] of Object.entries(readiness.outcomes.availability)) {
    lines.push(`| ${availability} | ${count} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function freezeCohort({
  datasetFile,
  output,
  paramsFile,
}: {
  datasetFile: string;
  output: string;
  paramsFile: string;
}): FrozenArtifacts {
  const dataset = DatasetManifestSchema.parse(readJson(datasetFile));
  const params = PipelineParamsSchema.parse(readJson(paramsFile));
  const explicitPullRequests = params.cohort.pullRequestNumbers;
  const groups = groupByPullRequest(dataset.entries);
  const availablePullRequests = groups.length;
  let entries: DatasetEntry[];
  if (explicitPullRequests.length > 0) {
    const byPullRequest = new Map(groups.map((group) => [group.pullRequestNumber, group]));
    entries = explicitPullRequests.flatMap((pullRequestNumber) => {
      const group = byPullRequest.get(pullRequestNumber);
      if (!group) throw new Error(`fixed pull request is absent from dataset: ${pullRequestNumber}`);
      return group.entries;
    });
  } else {
    entries = groups.flatMap((group) => group.entries);
  }
  if (entries.length === 0) throw new Error("the fixed cohort is empty");
  const selectedPullRequestCount = new Set(entries.map((entry) => entry.pullRequestNumber)).size;

  const cohortBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-cohort",
    frozenAt: params.cohort.frozenAt,
    datasetId: dataset.datasetId,
    repository: dataset.repository,
    sourceSummary: dataset.sourceSummary,
    selection: {
      method: explicitPullRequests.length > 0 ? "explicit-pull-requests" : "all-available-pull-requests",
      unit: "pull-request",
      snapshotPolicy: "all-captured-snapshots",
      availablePullRequests,
      changeSizeBands: params.cohort.changeSizeBands,
      selectedPullRequestCount,
      selectedSnapshotCount: entries.length,
    },
    entries,
  };
  const cohort = FrozenCohortSchema.parse({ ...cohortBody, cohortId: sha256(stableJson(cohortBody)) });
  const experimentBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-experiment",
    cohortId: cohort.cohortId,
    experiment: params.experiment,
    limits: params.limits,
  };
  const experiment = FrozenExperimentSchema.parse({ ...experimentBody, experimentId: sha256(stableJson(experimentBody)) });
  const matchingBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-matching-policy",
    cohortId: cohort.cohortId,
    matching: params.matching,
  };
  const matching = FrozenMatchingSchema.parse({ ...matchingBody, matchingId: sha256(stableJson(matchingBody)) });
  const decisionBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-decision-policy",
    cohortId: cohort.cohortId,
    decision: params.decision,
  };
  const decision = FrozenDecisionSchema.parse({ ...decisionBody, decisionId: sha256(stableJson(decisionBody)) });
  const readiness = buildEvaluationReadiness(cohort, params);
  const predeclarationBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-predeclaration",
    frozenAt: params.cohort.frozenAt,
    datasetId: dataset.datasetId,
    cohortId: cohort.cohortId,
    experimentId: experiment.experimentId,
    matchingId: matching.matchingId,
    decisionId: decision.decisionId,
    readinessId: readiness.readinessId,
  } as const;
  const predeclaration: Predeclaration = {
    ...predeclarationBody,
    predeclarationId: sha256(stableJson(predeclarationBody)),
  };
  const outputRoot = path.resolve(output);
  resetDirectory(outputRoot);
  writeJson(path.join(outputRoot, "cohort.json"), cohort, true);
  writeJson(path.join(outputRoot, "experiment.json"), experiment, true);
  writeJson(path.join(outputRoot, "matching.json"), matching, true);
  writeJson(path.join(outputRoot, "decision.json"), decision, true);
  writeJson(path.join(outputRoot, "readiness.json"), readiness, true);
  fs.writeFileSync(path.join(outputRoot, "readiness.md"), readinessMarkdown(readiness));
  writeJson(path.join(outputRoot, "predeclaration.json"), predeclaration, true);
  return { cohort, experiment, matching, decision, readiness, predeclaration };
}

function main() {
  const args = parseArgs(process.argv.slice(2), ["dataset", "output", "params"]);
  const result = freezeCohort({ datasetFile: args.dataset, output: args.output, paramsFile: args.params });
  process.stdout.write(
    `Froze ${result.cohort.selection.selectedPullRequestCount} pull requests with `
    + `${result.cohort.selection.selectedSnapshotCount} replay snapshots as ${result.cohort.cohortId}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
