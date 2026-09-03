import path from "node:path";
import { readJson, resetDirectory, sha256, stableJson, writeJson } from "./artifact-files";
import { parseArgs } from "./cli-arguments";
import {
  DatasetManifestSchema,
  FrozenCohortSchema,
  FrozenDecisionSchema,
  FrozenExperimentSchema,
  FrozenMatchingSchema,
  PipelineParamsSchema,
  type DatasetEntry,
  type FrozenCohort,
  type FrozenDecision,
  type FrozenExperiment,
  type FrozenMatching,
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
  predeclarationId: string;
}

interface FrozenArtifacts {
  cohort: FrozenCohort;
  experiment: FrozenExperiment;
  matching: FrozenMatching;
  decision: FrozenDecision;
  predeclaration: Predeclaration;
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
  const predeclarationBody = {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-predeclaration",
    frozenAt: params.cohort.frozenAt,
    datasetId: dataset.datasetId,
    cohortId: cohort.cohortId,
    experimentId: experiment.experimentId,
    matchingId: matching.matchingId,
    decisionId: decision.decisionId,
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
  writeJson(path.join(outputRoot, "predeclaration.json"), predeclaration, true);
  return { cohort, experiment, matching, decision, predeclaration };
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
