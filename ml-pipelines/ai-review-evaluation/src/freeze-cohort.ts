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

const STRATIFICATION_DIMENSIONS = [
  "risk-signal",
  "change-size",
  "language",
  "repository-area",
  "outcome-availability",
] as const;
const STRATIFICATION_TIE_TOLERANCE = 1e-12;
const CHANGE_SIZE_ORDER = ["small", "medium", "substantial", "large", "oversized"] as const;

type StratificationDimension = typeof STRATIFICATION_DIMENSIONS[number];
type Marginals = Record<StratificationDimension, Map<string, number>>;

interface PullRequestGroup {
  pullRequestNumber: number;
  entries: DatasetEntry[];
}

function featureValues(group: PullRequestGroup, dimension: StratificationDimension): string[] {
  const entries = group.entries;
  switch (dimension) {
    case "risk-signal": {
      const values = [...new Set(entries.flatMap((entry) => entry.strata.riskSignals))]
        .sort((left, right) => left.localeCompare(right));
      return values.length > 0 ? values : ["standard"];
    }
    case "change-size": return [...new Set(entries.map((entry) => entry.strata.changeSize))]
      .sort((left, right) => CHANGE_SIZE_ORDER.indexOf(left) - CHANGE_SIZE_ORDER.indexOf(right));
    case "language": {
      const values = [...new Set(entries.flatMap((entry) => entry.strata.languages))]
        .sort((left, right) => left.localeCompare(right));
      return values.length > 0 ? values : ["unknown"];
    }
    case "repository-area": {
      const values = [...new Set(entries.flatMap((entry) => entry.strata.repositoryAreas))]
        .sort((left, right) => left.localeCompare(right));
      return values.length > 0 ? values : ["unknown"];
    }
    case "outcome-availability": return [...new Set(entries.map((entry) => entry.strata.outcomeAvailability))]
      .sort((left, right) => left.localeCompare(right));
  }
}

function emptyMarginals(): Marginals {
  return Object.fromEntries(STRATIFICATION_DIMENSIONS.map((dimension) => [dimension, new Map()])) as Marginals;
}

function addToMarginals(marginals: Marginals, group: PullRequestGroup): void {
  for (const dimension of STRATIFICATION_DIMENSIONS) {
    const values = featureValues(group, dimension);
    const weight = 1 / values.length;
    for (const value of values) {
      const counts = marginals[dimension];
      counts.set(value, (counts.get(value) ?? 0) + weight);
    }
  }
}

function targetMarginals(groups: PullRequestGroup[]): Marginals {
  const target = emptyMarginals();
  for (const group of groups) addToMarginals(target, group);
  for (const dimension of STRATIFICATION_DIMENSIONS) {
    for (const [value, total] of target[dimension]) {
      target[dimension].set(value, total / groups.length);
    }
  }
  return target;
}

function marginalError(
  selected: Marginals,
  candidate: PullRequestGroup,
  selectedCount: number,
  target: Marginals,
): number {
  let error = 0;
  for (const dimension of STRATIFICATION_DIMENSIONS) {
    const candidateValues = featureValues(candidate, dimension);
    const candidateWeight = 1 / candidateValues.length;
    const categories = target[dimension];
    let dimensionError = 0;
    for (const [value, targetShare] of categories) {
      const contribution = candidateValues.includes(value) ? candidateWeight : 0;
      const projectedShare = ((selected[dimension].get(value) ?? 0) + contribution) / (selectedCount + 1);
      dimensionError += (projectedShare - targetShare) ** 2;
    }
    error += dimensionError / categories.size;
  }
  return error;
}

function noveltyScore(selected: Marginals, candidate: PullRequestGroup): number {
  return STRATIFICATION_DIMENSIONS.reduce((score, dimension) => {
    const values = featureValues(candidate, dimension);
    const unseenShare = values.filter((value) => !selected[dimension].has(value)).length / values.length;
    return score + unseenShare;
  }, 0);
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

export function stratifiedPullRequestSelection(entries: DatasetEntry[], maximum: number): DatasetEntry[] {
  const candidates = groupByPullRequest(entries);
  const target = targetMarginals(candidates);
  const selectedMarginals = emptyMarginals();
  const selected: PullRequestGroup[] = [];
  const remaining = new Set(candidates);
  while (selected.length < maximum && remaining.size > 0) {
    const next = [...remaining].sort((left, right) => {
      const errorDifference = marginalError(selectedMarginals, left, selected.length, target)
        - marginalError(selectedMarginals, right, selected.length, target);
      if (Math.abs(errorDifference) > STRATIFICATION_TIE_TOLERANCE) return errorDifference;
      const noveltyDifference = noveltyScore(selectedMarginals, right) - noveltyScore(selectedMarginals, left);
      return noveltyDifference || left.pullRequestNumber - right.pullRequestNumber;
    })[0];
    if (!next) break;
    selected.push(next);
    addToMarginals(selectedMarginals, next);
    remaining.delete(next);
  }
  return selected.flatMap((group) => group.entries);
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
    entries = stratifiedPullRequestSelection(dataset.entries, params.cohort.maxPullRequests);
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
      method: explicitPullRequests.length > 0 ? "explicit-pull-requests" : "deterministic-balanced-pr-stratification",
      unit: "pull-request",
      snapshotPolicy: "all-captured-snapshots",
      dimensions: STRATIFICATION_DIMENSIONS,
      availablePullRequests,
      requestedMaximumPullRequests: params.cohort.maxPullRequests,
      changeSizeThresholds: params.cohort.changeSizeThresholds,
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
