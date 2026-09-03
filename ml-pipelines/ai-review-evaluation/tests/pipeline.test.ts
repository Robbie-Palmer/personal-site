import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildScorecard } from "../src/build-scorecard";
import { changeSizeBand } from "../src/corpus-strata";
import { extractCorpus } from "../src/extract-corpus";
import { freezeCohort, stratifiedPullRequestSelection } from "../src/freeze-cohort";
import { buildObservations, matchFinding } from "../src/match-replays";
import { runReplays } from "../src/run-replays";
import { stableJson, writeJson } from "../src/artifact-files";
import {
  PipelineParamsSchema,
  type Finding,
  type FrozenCohort,
  type FrozenExperiment,
  type HistoricalFinding,
  type PipelineParams,
  type ReplayOutput,
} from "../src/schemas";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixtureParams(overrides: Partial<PipelineParams> = {}): PipelineParams {
  return PipelineParamsSchema.parse({
    source: { repository: "acme/widgets", exportPath: "unused" },
    cohort: {
      frozenAt: "2026-09-02T00:00:00Z",
      maxPullRequests: 1,
      changeSizeThresholds: { medium: 200, substantial: 1000, large: 2000, oversized: 5000 },
      pullRequestNumbers: [],
    },
    experiment: {
      variable: "scout-model",
      baseline: {
        id: "baseline",
        experiment: { kind: "scout-model", models: [{ model: "model/baseline", provider: "openrouter" }] },
      },
      candidate: {
        id: "candidate",
        experiment: { kind: "scout-model", models: [{ model: "model/candidate", provider: "openrouter" }] },
      },
      repetitions: 2,
    },
    limits: {
      maxModels: 1,
      allowedProviders: ["openrouter"],
      maxScoutTokens: 8000,
      maxMergerTokens: 6000,
      maxCostUsdPerReplay: 0.25,
      maxTotalCostUsd: 2,
      timeoutMs: 1000,
      requireZeroDataRetention: true,
    },
    matching: {
      methods: ["finding-id", "file-hunk", "file-line"],
      manualAdjudicationBelowConfidence: 0.9,
    },
    decision: {
      primaryMetrics: ["acceptedFindingsPerReplay", "noiseRate", "historicalCoverageRate"],
      sampleUnit: "adjudicated-findings",
      minimumSampleSize: 4,
      minimumRelativeImprovement: 0.1,
      minimumAbsoluteImprovementWhenBaselineZero: 0.1,
      rejectRelativeDecline: 0.1,
      maximumNoiseRateIncrease: 0.02,
      maximumCoverageRateDrop: 0.02,
      maximumProviderFailureRate: 0.05,
    },
    replay: { mode: "execute" },
    ...overrides,
  });
}

function writeSource(root: string): void {
  const snapshot = {
    schemaVersion: 1,
    recordType: "ai-review-replay-input",
    repository: "acme/widgets",
    pullRequestNumber: 7,
    productionRunId: "run-7",
    git: { baseSha: "a".repeat(40), headSha: "b".repeat(40) },
    input: {
      fullDiff: "diff --git a/src/app.ts b/src/app.ts\n@@ -1 +1 @@\n-old\n+new",
      reviewedDiff: "+new",
      boundedFileContext: "",
      repositoryGuidelines: "",
      reviewThreads: "",
      priorOpenFindings: [],
      affectedOpenFindings: [],
    },
    decision: {
      paths: ["src/app.ts"],
      omittedPaths: [],
      coverage: {
        mode: "full",
        reason: "fixture",
        totalHunks: 1,
        reviewedHunkIds: ["h1"],
        unchangedHunkIds: [],
        skippedHunkIds: [],
        affectedFindingIds: [],
        paths: ["src/app.ts"],
        skippedPaths: [],
      },
    },
    prompt: { version: "prompt-v1", scoutSystem: "Scout", scoutSchema: {}, mergerSystem: "Merge", mergerSchema: {} },
    policy: {},
    modelRequest: {
      openRouterScouts: ["model/baseline"], openCodeScouts: [], merger: "model/merger",
      requireZeroDataRetention: true, scoutMaxTokens: 8000, mergerMaxTokens: 6000,
    },
    provenance: { capturedAt: "2026-09-01T00:00:00Z", liveCredentialsIncluded: false },
  };
  const findings = [
    ["f1", "Confirmed bug", "confirmed-fixed"],
    ["f2", "False alarm", "rejected"],
    ["f3", "Acknowledged bug", "acknowledged"],
    ["f4", "Old bug", "superseded"],
  ];
  const terminal = {
    schemaVersion: 2,
    recordType: "review-run-terminal",
    status: "published",
    repository: "acme/widgets",
    pullRequestNumber: 7,
    headSha: snapshot.git.headSha,
    promptVersion: "prompt-v1",
    change: { additions: 20, deletions: 10, riskSignals: ["auth"], repositoryAreas: ["api"] },
    coverage: { totalHunks: 1, reviewedHunkIds: ["h1"] },
    findings: {
      published: findings.map(([findingId, title], index) => ({
        findingId, file: "src/app.ts", line: index + 1, hunkIds: [`h${index + 1}`], title,
      })),
    },
    workflow: { instanceId: "run-7", triggeredAt: "2026-09-01T00:00:00Z" },
  };
  const snapshotFile = path.join(root, "v2/acme/widgets/pr-7/head/run-7/replay/input-v1.json");
  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  fs.writeFileSync(snapshotFile, stableJson(snapshot));
  writeJson(path.join(root, "v2/acme/widgets/pr-7/head/run-7/published.json"), terminal, true);
  for (const [findingId, , outcome] of findings) {
    writeJson(path.join(root, `v2/acme/widgets/pr-7/findings/${findingId}/outcomes/v1.json`), {
      schemaVersion: 2,
      recordType: "finding-outcome",
      outcomeVersion: 1,
      repository: "acme/widgets",
      pullRequestNumber: 7,
      findingId,
      outcome,
      outcomeKind: outcome === "superseded" ? "censored" : "adjudicated",
      basis: "later-reviewed-head",
      confidence: 1,
      evaluatorVersion: "fixture-v1",
      manualOverride: null,
      sourceId: `fixture:${findingId}`,
      evidence: {},
      occurredAt: "2026-09-02T00:00:00Z",
      recordedAt: "2026-09-02T00:00:01Z",
    }, true);
  }
}

function finding(findingId: string, line: number, hunkId: string): Finding {
  return { findingId, file: "src/app.ts", line, hunkIds: [hunkId], title: findingId };
}

function replayResult(findings: Finding[]): ReplayOutput {
  return {
    schemaVersion: 1,
    recordType: "ai-review-replay-result",
    status: "completed",
    mergedFindings: findings,
    failures: [],
    metrics: [{
      model: "fixture", provider: "openrouter", role: "scout", ok: true,
      latencyMs: 100, costUsd: 0.1,
      usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 10 },
    }],
    tokens: { input: 100, output: 20, cachedInput: 10 },
    latencyMs: 100,
    costUsd: 0.1,
  };
}

function writeReplayIndex(root: string, cohort: FrozenCohort, experiment: FrozenExperiment): void {
  const records: string[] = [];
  const entry = cohort.entries[0];
  if (!entry) throw new Error("fixture cohort is empty");
  if (experiment.experiment.baseline.experiment.kind !== "scout-model" ||
      experiment.experiment.candidate.experiment.kind !== "scout-model") {
    throw new Error("fixture requires scout-model experiments");
  }
  const baselineModel = experiment.experiment.baseline.experiment.models[0];
  const candidateModel = experiment.experiment.candidate.experiment.models[0];
  if (!baselineModel || !candidateModel) throw new Error("fixture requires a model for each variant");
  const variants = [
    { role: "baseline" as const, variant: experiment.experiment.baseline, model: baselineModel, findings: [finding("f1", 1, "h1"), finding("f2", 2, "h2")] },
    { role: "candidate" as const, variant: experiment.experiment.candidate, model: candidateModel, findings: [finding("f1", 1, "h1"), finding("f3", 3, "h3"), finding("f4", 4, "h4")] },
  ];
  for (const { role, variant, model, findings } of variants) {
    for (let repetition = 0; repetition < 2; repetition += 1) {
      const relative = `records/${variant.id}/${entry.corpusId}/repetition-${repetition}.json`;
      writeJson(path.join(root, relative), {
        schemaVersion: 1,
        recordType: "ai-review-evaluation-replay",
        cohortId: cohort.cohortId,
        experimentId: experiment.experimentId,
        datasetId: cohort.datasetId,
        variant: {
          ...variant,
          role,
          model: model.model,
          provider: model.provider,
        },
        corpusId: entry.corpusId,
        pullRequestNumber: entry.pullRequestNumber,
        repetition,
        replay: replayResult(findings),
      }, true);
      records.push(relative);
    }
  }
  writeJson(path.join(root, "index.json"), {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-replay-index",
    cohortId: cohort.cohortId,
    experimentId: experiment.experimentId,
    runnerDigest: "fixture-runner",
    mode: "execute",
    spentUsd: 0.4,
    records,
  }, true);
}

test("extracts, freezes, matches, and scores a versioned replay corpus", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ai-review-evaluation-"));
  const source = path.join(temporary, "source");
  const corpus = path.join(temporary, "corpus");
  const frozen = path.join(temporary, "frozen");
  const replays = path.join(temporary, "replays");
  const plannedReplays = path.join(temporary, "planned-replays");
  const evaluation = path.join(temporary, "evaluation");
  const paramsFile = path.join(temporary, "params.json");
  writeSource(source);
  writeJson(paramsFile, fixtureParams());

  const dataset = extractCorpus({ input: source, output: corpus, paramsFile });
  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.sourceSummary.terminalPullRequests, 1);
  assert.equal(dataset.sourceSummary.replayablePullRequests, 1);
  assert.equal(dataset.entries[0]?.strata.outcomeAvailability, "partial");
  assert.equal(dataset.entries[0]?.strata.languages[0], "typescript");
  const frozenResult = freezeCohort({ datasetFile: path.join(corpus, "manifest.json"), output: frozen, paramsFile });
  const { cohort, experiment } = frozenResult;
  assert.equal(cohort.selection.method, "deterministic-balanced-pr-stratification");
  assert.equal(cohort.selection.unit, "pull-request");
  assert.equal(cohort.selection.selectedPullRequestCount, 1);
  assert.equal(cohort.selection.selectedSnapshotCount, 1);
  assert.equal(frozenResult.predeclaration.cohortId, cohort.cohortId);

  const planParamsFile = path.join(temporary, "plan-params.json");
  writeJson(planParamsFile, fixtureParams({ replay: { mode: "plan" } }));
  const plan = runReplays({
    cohortFile: path.join(frozen, "cohort.json"),
    experimentFile: path.join(frozen, "experiment.json"),
    corpusRoot: corpus,
    output: plannedReplays,
    paramsFile: planParamsFile,
    aiReviewRoot: path.resolve(projectRoot, "../../ai-review"),
    cacheRoot: path.join(temporary, "cache"),
  });
  assert.equal(plan.mode, "plan");
  assert.equal(plan.records.length, 4);
  assert.ok(plan.records.every((file) =>
    JSON.parse(fs.readFileSync(path.join(plannedReplays, file), "utf8")).replay.recordType === "ai-review-replay-plan"));

  writeReplayIndex(replays, cohort, experiment);
  const matched = buildObservations({
    cohortFile: path.join(frozen, "cohort.json"),
    matchingFile: path.join(frozen, "matching.json"),
    replaysRoot: replays,
    outputRoot: evaluation,
  });
  assert.equal(matched.observations.length, 4);
  assert.equal(matched.observations.find((row) => row.variant_role === "candidate")?.censored_finding_count, 1);
  assert.equal(matched.observations.find((row) => row.variant_role === "candidate")?.rejected_finding_count, 0);

  const observationFile = path.join(evaluation, "observations.jsonl");
  const observations = fs.readFileSync(observationFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const secondPullRequest = observations.map((observation) => ({
    ...observation,
    corpus_id: `${observation.corpus_id}-second-pr`,
    pull_request_number: 8,
    accepted_finding_count: observation.accepted_finding_count + 4,
  }));
  const additionalFirstPullRequestSnapshot = observations.map((observation) => ({
    ...observation,
    corpus_id: `${observation.corpus_id}-second-snapshot`,
  }));
  fs.writeFileSync(
    observationFile,
    [...observations, ...secondPullRequest, ...additionalFirstPullRequestSnapshot].map(stableJson).join("\n") + "\n",
  );

  const result = buildScorecard({
    cohortFile: path.join(frozen, "cohort.json"),
    decisionFile: path.join(frozen, "decision.json"),
    observationsFile: observationFile,
    outputRoot: evaluation,
    sqlFile: path.join(projectRoot, "analytics/scorecard.sql"),
  });
  assert.equal(result.decision.recommendation, "adopt");
  assert.equal(result.summaries.find((summary) => summary.variant_role === "candidate")?.censored_findings, 6);
  assert.equal(result.summaries.find((summary) => summary.variant_role === "candidate")?.rejected_findings, 0);
  const candidateSummary = result.summaries.find((summary) => summary.variant_role === "candidate");
  assert.equal(candidateSummary?.completed_pull_requests, 2);
  assert.equal(candidateSummary?.accepted_findings_per_replay, 4);
  assert.equal(candidateSummary?.accepted_findings_repetition_stddev_mean, 0);
  assert.equal(candidateSummary?.corpus_items_with_accepted_findings_repetition_variance, 3);
  assert.ok((candidateSummary?.accepted_findings_between_pull_request_stddev ?? 0) > 0);
  assert.ok(fs.statSync(path.join(evaluation, "replay-scorecard.parquet")).size > 0);
  assert.equal(readDecision(path.join(evaluation, "decision.json")).productionConfigurationChanged, false);
});

function readDecision(file: string): { productionConfigurationChanged: boolean } {
  return z.object({ productionConfigurationChanged: z.boolean() })
    .parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

test("ambiguous hunk matches require manual adjudication", () => {
  const labels: HistoricalFinding[] = ["a", "b"].map((findingId) => ({
    finding: { findingId, file: "src/app.ts", hunkIds: ["h1"] },
    outcome: {
      schemaVersion: 2,
      recordType: "finding-outcome",
      repository: "acme/widgets",
      pullRequestNumber: 7,
      findingId,
      outcomeVersion: 1,
      outcome: "confirmed-fixed",
      outcomeKind: "adjudicated",
      basis: "later-reviewed-head",
      confidence: 1,
      evaluatorVersion: "fixture-v1",
      manualOverride: null,
      sourceId: `fixture:${findingId}`,
      evidence: {},
      occurredAt: "2026-09-02T00:00:00Z",
      recordedAt: "2026-09-02T00:00:01Z",
    },
    outcomeSource: null,
  }));
  const result = matchFinding(
    { findingId: "new", file: "src/app.ts", hunkIds: ["h1"] },
    labels,
    { methods: ["file-hunk"], manualAdjudicationBelowConfidence: 0.9 },
  );
  assert.equal(result.status, "manual-adjudication-required");
  assert.deepEqual(result.historicalFindingIds, ["a", "b"]);
});

test("execute mode is the default and needs no second opt-in", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ai-review-execution-mode-"));
  const cohortRoot = path.join(temporary, "frozen");
  fs.mkdirSync(cohortRoot, { recursive: true });
  writeJson(path.join(cohortRoot, "cohort.json"), {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-cohort",
    cohortId: "fixed",
    datasetId: "dataset",
    repository: "acme/widgets",
    sourceSummary: {
      terminalRecords: 0,
      terminalWorkflowRuns: 0,
      terminalPullRequests: 0,
      replaySnapshots: 0,
      replayablePullRequests: 0,
      replaySnapshotCapturedAt: {
        earliest: "2026-09-01T00:00:00Z",
        latest: "2026-09-01T00:00:00Z",
      },
    },
    selection: {
      method: "deterministic-balanced-pr-stratification",
      unit: "pull-request",
      availablePullRequests: 0,
      selectedPullRequestCount: 0,
      selectedSnapshotCount: 0,
    },
    entries: [],
  });
  writeJson(path.join(cohortRoot, "experiment.json"), {
    schemaVersion: 1,
    recordType: "ai-review-evaluation-experiment",
    cohortId: "fixed",
    experimentId: "experiment",
    experiment: fixtureParams().experiment,
    limits: fixtureParams().limits,
  });
  const paramsFile = path.join(temporary, "params.json");
  writeJson(paramsFile, fixtureParams());
  const fakeRepositoryRoot = path.join(temporary, "repository");
  const fakeAiReviewRoot = path.join(fakeRepositoryRoot, "ai-review");
  for (const relative of [
    "analytics/corpus-replay.ts",
    "analytics/replay-claim.ts",
    "src/env.ts",
    "src/finding-lifecycle.ts",
    "src/github-app.ts",
    "src/guardrails.ts",
    "src/replay-input.ts",
    "src/replay-runner.ts",
    "src/review-engine.ts",
    "../.github/scripts/ai-review/ai-review.ts",
    "../packages/ai-review-domain/src/records.ts",
    "../packages/ai-review-domain/src/replay.ts",
  ]) {
    const file = path.resolve(fakeAiReviewRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, relative);
  }
  const result = runReplays({
    cohortFile: path.join(cohortRoot, "cohort.json"),
    experimentFile: path.join(cohortRoot, "experiment.json"),
    corpusRoot: temporary,
    output: path.join(temporary, "output"),
    paramsFile,
    aiReviewRoot: fakeAiReviewRoot,
    cacheRoot: path.join(temporary, "cache"),
  });
  assert.equal(result.mode, "execute");
});

test("change-size thresholds reflect agent-era pull requests", () => {
  const thresholds = fixtureParams().cohort.changeSizeThresholds;
  assert.equal(changeSizeBand(199, thresholds), "small");
  assert.equal(changeSizeBand(200, thresholds), "medium");
  assert.equal(changeSizeBand(999, thresholds), "medium");
  assert.equal(changeSizeBand(1000, thresholds), "substantial");
  assert.equal(changeSizeBand(1999, thresholds), "substantial");
  assert.equal(changeSizeBand(2000, thresholds), "large");
  assert.equal(changeSizeBand(4999, thresholds), "large");
  assert.equal(changeSizeBand(5000, thresholds), "oversized");
});

test("stratification selects pull requests, retains their snapshots, and balances marginal features", () => {
  const base = {
    corpusId: "a".repeat(64),
    snapshotPath: "entries/a.json",
    pullRequestNumber: 7,
    capturedAt: "2026-09-01T00:00:00Z",
    changedLines: 300,
    strata: {
      risk: "standard",
      riskSignals: [],
      changeSize: "medium" as const,
      languages: ["typescript"],
      repositoryAreas: ["api"],
      outcomeAvailability: "complete",
    },
    historicalFindings: [],
  };
  const selected = stratifiedPullRequestSelection([
    base,
    { ...base, corpusId: "b".repeat(64), capturedAt: "2026-09-02T00:00:00Z" },
    { ...base, corpusId: "c".repeat(64), pullRequestNumber: 8, capturedAt: "2026-09-01T00:00:00Z" },
    {
      ...base,
      corpusId: "d".repeat(64),
      pullRequestNumber: 9,
      capturedAt: "2026-09-01T00:00:00Z",
      changedLines: 2500,
      strata: {
        risk: "elevated",
        riskSignals: ["authentication"],
        changeSize: "large",
        languages: ["python", "terraform"],
        repositoryAreas: ["infra"],
        outcomeAvailability: "missing",
      },
    },
  ], 2);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((entry) => entry.pullRequestNumber)).size, 2);
  assert.deepEqual(
    selected.filter((entry) => entry.pullRequestNumber === 7).map((entry) => entry.corpusId),
    ["a".repeat(64), "b".repeat(64)],
  );
  assert.ok(selected.some((entry) => entry.pullRequestNumber === 9));
});

test("runtime configuration rejects providers outside the typed schema", () => {
  const params = fixtureParams();
  const result = PipelineParamsSchema.safeParse({
    ...params,
    limits: { ...params.limits, allowedProviders: ["untyped-provider"] },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["limits", "allowedProviders", 0]);
  }
});

test("matching and decision changes preserve the frozen inference identity", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ai-review-predeclaration-"));
  const source = path.join(temporary, "source");
  const corpus = path.join(temporary, "corpus");
  const baseParamsFile = path.join(temporary, "base-params.json");
  const changedParamsFile = path.join(temporary, "changed-params.json");
  const baseParams = fixtureParams();
  writeSource(source);
  writeJson(baseParamsFile, baseParams);
  const dataset = extractCorpus({ input: source, output: corpus, paramsFile: baseParamsFile });
  const baseline = freezeCohort({
    datasetFile: path.join(corpus, "manifest.json"),
    output: path.join(temporary, "base"),
    paramsFile: baseParamsFile,
  });
  writeJson(changedParamsFile, fixtureParams({
    matching: { ...baseParams.matching, manualAdjudicationBelowConfidence: 0.95 },
    decision: { ...baseParams.decision, minimumSampleSize: baseParams.decision.minimumSampleSize + 1 },
  }));
  const changed = freezeCohort({
    datasetFile: path.join(corpus, "manifest.json"),
    output: path.join(temporary, "changed"),
    paramsFile: changedParamsFile,
  });

  assert.equal(dataset.datasetId, baseline.cohort.datasetId);
  assert.equal(changed.cohort.cohortId, baseline.cohort.cohortId);
  assert.equal(changed.experiment.experimentId, baseline.experiment.experimentId);
  assert.notEqual(changed.matching.matchingId, baseline.matching.matchingId);
  assert.notEqual(changed.decision.decisionId, baseline.decision.decisionId);
});
