import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../../.github/scripts/ai-review/ai-review";
import type {
  IdentifiedReviewArtifacts,
  MergedRun,
  ScoutRun,
} from "../src/review-engine";
import {
  executeControlledReplay,
  createProductionReplayAdapter,
  loadReplaySnapshot,
  runControlledReplay,
  planControlledReplay,
  type ReplayBoundaryAdapter,
  type ReplayInputSnapshot,
  type ReplayLimits,
  type ReplayCorpusStore,
} from "../src/replay-runner";

const finding: Finding = {
  severity: "high",
  file: "src/app.ts",
  line: 2,
  title: "Dropped error",
  evidence: "The catch block ignores the error.",
  recommendation: "Return the error.",
  confidence: 0.9,
};

const snapshot: ReplayInputSnapshot = {
  schemaVersion: 1,
  recordType: "ai-review-replay-input",
  repository: "acme/widgets",
  pullRequestNumber: 436,
  productionRunId: "production-run",
  git: { baseSha: "a".repeat(40), headSha: "b".repeat(40) },
  input: {
    fullDiff: "+throw error",
    reviewedDiff: "+throw error",
    boundedFileContext: "export function run() {}",
    repositoryGuidelines: "Review errors.",
    reviewThreads: "",
    priorOpenFindings: [],
    affectedOpenFindings: [],
  },
  decision: {
    paths: ["src/app.ts"],
    omittedPaths: [],
    coverage: {
      mode: "full",
      reason: "initial review",
      totalHunks: 1,
      reviewedHunkIds: ["h_1"],
      unchangedHunkIds: [],
      skippedHunkIds: [],
      affectedFindingIds: [],
      paths: ["src/app.ts"],
      skippedPaths: [],
    },
  },
  prompt: {
    version: "prompt-v1",
    scoutSystem: "Scout.",
    scoutSchema: {},
    mergerSystem: "Merge.",
    mergerSchema: {},
  },
  policy: { coverage: { version: "coverage-v1" } },
  modelRequest: {
    openRouterScouts: ["production/scout"],
    openCodeScouts: [],
    merger: "production/merger",
    requireZeroDataRetention: true,
    scoutMaxTokens: 8_000,
    mergerMaxTokens: 6_000,
  },
  provenance: {
    diffFingerprint: "diff-hash",
    configFingerprint: "config-hash",
    capturedAt: "2026-08-31T12:00:00Z",
  },
};

const limits: ReplayLimits = {
  maxModels: 4,
  maxScoutTokens: 8_000,
  maxMergerTokens: 6_000,
  maxCostUsd: 1,
  allowedProviders: ["openrouter"],
  requireZeroDataRetention: true,
  timeoutMs: 1_000,
  maxRepetitions: 3,
};

function scoutRun(overrides: Partial<ScoutRun> = {}): ScoutRun {
  return {
    models: ["experiment/scout"],
    candidates: { "experiment/scout": [finding] },
    failed: [],
    candidateCounts: { "experiment/scout": 1 },
    invalidCounts: { "experiment/scout": 0 },
    outOfScopeCounts: { "experiment/scout": 0 },
    costs: { "experiment/scout": 0.1 },
    metrics: [{
      model: "experiment/scout",
      provider: "openrouter",
      role: "scout",
      ok: true,
      latencyMs: 10,
      costUsd: 0.1,
      usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 5 },
    }],
    ...overrides,
  };
}

const merged: MergedRun = {
  result: { summary: "One finding.", findings: [] },
  cost: 0.05,
  metric: {
    model: "production/merger",
    provider: "openrouter",
    role: "merger",
    ok: true,
    latencyMs: 20,
    costUsd: 0.05,
    usage: { inputTokens: 50, outputTokens: 10, cachedInputTokens: 0 },
  },
};

const artifacts: IdentifiedReviewArtifacts = {
  hunks: [],
  candidates: {
    "experiment/scout": [{ ...finding, findingId: "f_1", hunkIds: [] }],
  },
  publishedFindings: [],
};

function fixture(options: { scouts?: ScoutRun; scoutError?: Error } = {}) {
  const records = new Map<string, string>();
  const store: ReplayCorpusStore = {
    get: vi.fn(async (key) => records.get(key) ?? null),
    claim: vi.fn(async () => true),
    put: vi.fn(async (key, value) => { records.set(key, value); }),
    loadSnapshot: vi.fn(async (corpusId) =>
      corpusId === "corpus-434" ? JSON.stringify(snapshot) : null),
  };
  const adapter: ReplayBoundaryAdapter = {
    runScouts: vi.fn(async () => {
      if (options.scoutError) throw options.scoutError;
      return options.scouts ?? scoutRun();
    }),
    estimateMergerCostUsd: vi.fn(() => 0.05),
    mergeFindings: vi.fn(async () => merged),
    identifyFindings: vi.fn(async () => artifacts),
  };
  return { adapter, store };
}

const request = {
  corpusId: "corpus-434",
  snapshot,
  experiment: {
    kind: "scout-model" as const,
    models: [{ model: "experiment/scout", provider: "openrouter" as const }],
  },
  limits,
};

describe("controlled replay runner", () => {
  it("plans without invoking any model or publication boundary", async () => {
    const { adapter, store } = fixture();
    const plan = await executeControlledReplay(request, adapter, store);

    expect(plan).toMatchObject({
      recordType: "ai-review-replay-plan",
      paidInferenceAllowed: false,
      differences: [{ variable: "scout-model" }],
    });
    expect(adapter.runScouts).not.toHaveBeenCalled();
    expect(adapter.mergeFindings).not.toHaveBeenCalled();
    expect(adapter.identifyFindings).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
    expect("publishReview" in adapter).toBe(false);
  });

  it("loads the immutable snapshot by corpus ID", async () => {
    const { adapter, store } = fixture();
    const plan = await runControlledReplay(
      {
        corpusId: request.corpusId,
        experiment: request.experiment,
        limits,
      },
      adapter,
      store,
    );

    expect(plan).toMatchObject({ corpusId: "corpus-434", paidInferenceAllowed: false });
    expect(store.loadSnapshot).toHaveBeenCalledWith("corpus-434");
  });

  it("records partial ensemble coverage, metrics, tokens, cost, and provenance", async () => {
    const partial = scoutRun({ failed: ["failed/scout"] });
    const { adapter, store } = fixture({ scouts: partial });
    const result = await executeControlledReplay(
      { ...request, dryRun: false },
      adapter,
      store,
    );

    expect(result).toMatchObject({
      status: "completed",
      partialCoverage: true,
      failures: ["failed/scout"],
      costUsd: 0.15,
      tokens: { input: 150, output: 30, cachedInput: 5 },
      corpusProvenance: { diffFingerprint: "diff-hash" },
    });
    expect(store.put).toHaveBeenCalledOnce();
  });

  it("returns the stored result for an identical corpus and configuration", async () => {
    const { adapter, store } = fixture();
    const first = await executeControlledReplay({ ...request, dryRun: false }, adapter, store);
    const second = await executeControlledReplay({ ...request, dryRun: false }, adapter, store);

    expect(second).toEqual(first);
    expect(adapter.runScouts).toHaveBeenCalledOnce();
    expect(adapter.mergeFindings).toHaveBeenCalledOnce();
  });

  it("records model failures without attempting later boundaries", async () => {
    const { adapter, store } = fixture({ scoutError: new Error("provider unavailable") });
    const result = await executeControlledReplay({ ...request, dryRun: false }, adapter, store);

    expect(result).toMatchObject({ status: "failed", error: "provider unavailable" });
    expect(adapter.mergeFindings).not.toHaveBeenCalled();
    expect(adapter.identifyFindings).not.toHaveBeenCalled();
  });

  it("denies the merger when scouts exhaust the declared budget", async () => {
    const { adapter, store } = fixture({
      scouts: scoutRun({ costs: { "experiment/scout": 0.5 } }),
    });
    const result = await executeControlledReplay(
      { ...request, dryRun: false, limits: { ...limits, maxCostUsd: 0.5 } },
      adapter,
      store,
    );

    expect(result).toMatchObject({ status: "budget-denied", costUsd: 0.5 });
    expect(adapter.mergeFindings).not.toHaveBeenCalled();
  });

  it("rejects undeclared configuration changes and out-of-range repetitions", async () => {
    await expect(planControlledReplay({
      ...request,
      experiment: {
        ...request.experiment,
        merger: "another/change",
      } as typeof request.experiment,
    })).rejects.toThrow("exactly one experimental variable");
    await expect(planControlledReplay({
      ...request,
      repetition: 3,
    })).rejects.toThrow("repetition must be between 0 and 2");
  });

  it("uses a new result key but the same configuration ID for an explicit repetition", async () => {
    const first = await planControlledReplay(request);
    const repeated = await planControlledReplay({ ...request, repetition: 1 });

    expect(repeated.configurationId).toBe(first.configurationId);
    expect(repeated.resultKey).not.toBe(first.resultKey);
    expect(repeated.resultKey).toContain("repetition-1.json");
  });

  it.each([
    ["merger-model", { kind: "merger-model", model: "experiment/merger" }],
    ["prompt-version", {
      kind: "prompt-version",
      prompt: { version: "prompt-v2", scoutSystem: "Scout v2.", mergerSystem: "Merge v2." },
    }],
    ["coverage-policy", {
      kind: "coverage-policy",
      policy: { version: "coverage-v2", mode: "full" },
    }],
  ] as const)("plans the %s experiment against its production value", async (_kind, experiment) => {
    const plan = await planControlledReplay({ ...request, experiment });
    expect(plan.differences).toEqual([expect.objectContaining({
      variable: experiment.kind,
      replay: experiment.kind === "merger-model"
        ? experiment.model
        : experiment.kind === "prompt-version"
          ? experiment.prompt
          : experiment.policy,
    })]);
  });

  it("uses the frozen full diff for a full-coverage experiment", async () => {
    const fullSnapshot = {
      ...snapshot,
      input: {
        ...snapshot.input,
        fullDiff: "diff --git a/src/one.ts b/src/one.ts\n@@ -0,0 +1 @@\n+one\n" +
          "diff --git a/src/two.ts b/src/two.ts\n@@ -0,0 +1 @@\n+two",
      },
    };
    const { adapter, store } = fixture();
    await executeControlledReplay({
      ...request,
      snapshot: fullSnapshot,
      dryRun: false,
      experiment: {
        kind: "coverage-policy",
        policy: { version: "coverage-v2", mode: "full" },
      },
    }, adapter, store);

    expect(adapter.runScouts).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: fullSnapshot.input.fullDiff,
        paths: ["src/one.ts", "src/two.ts"],
        hunks: [
          expect.objectContaining({ file: "src/one.ts" }),
          expect.objectContaining({ file: "src/two.ts" }),
        ],
        coverage: expect.objectContaining({ mode: "full", paths: ["src/one.ts", "src/two.ts"] }),
      }),
      limits.allowedProviders,
      expect.objectContaining({ kind: "coverage-policy" }),
    );
  });

  it("records a completed merge that crosses the total cost limit", async () => {
    const { adapter, store } = fixture({ scouts: scoutRun({ costs: { "experiment/scout": 0.8 } }) });
    vi.mocked(adapter.estimateMergerCostUsd).mockReturnValue(0);
    const result = await executeControlledReplay({
      ...request,
      dryRun: false,
      limits: { ...limits, maxCostUsd: 0.84 },
    }, adapter, store);
    expect(result).toMatchObject({ status: "budget-exceeded", costUsd: 0.85 });
  });

  it("reserves the merger cost ceiling before starting paid inference", async () => {
    const { adapter, store } = fixture({ scouts: scoutRun({ costs: { "experiment/scout": 0.8 } }) });
    vi.mocked(adapter.estimateMergerCostUsd).mockReturnValue(0.25);
    const result = await executeControlledReplay({ ...request, dryRun: false }, adapter, store);
    expect(result).toMatchObject({
      status: "budget-denied",
      costUsd: 0.8,
      mergerCostCeilingUsd: 0.25,
    });
    expect(adapter.mergeFindings).not.toHaveBeenCalled();
  });

  it("atomically claims a replay key before model execution", async () => {
    const { adapter, store } = fixture();
    vi.mocked(store.claim).mockResolvedValue(false);
    const result = await executeControlledReplay({ ...request, dryRun: false }, adapter, store);
    expect(result).toMatchObject({ status: "in-progress" });
    expect(adapter.runScouts).not.toHaveBeenCalled();
  });

  it("validates replay limits, providers, privacy, and experiment contents", async () => {
    const cases: Array<[Partial<ReplayLimits>, typeof request.experiment, RegExp]> = [
      [{ maxModels: 0 }, request.experiment, /maxModels/],
      [{ maxCostUsd: 0 }, request.experiment, /maxCostUsd/],
      [{ allowedProviders: [] }, request.experiment, /allowedProviders/],
      [{ allowedProviders: ["opencode"] }, request.experiment, /openrouter/],
      [{ maxScoutTokens: 1 }, request.experiment, /scout token/],
      [{ maxMergerTokens: 1 }, request.experiment, /merger token/],
      [{}, { kind: "scout-model", models: [] }, /model count/],
      [{}, { kind: "scout-model", models: [{ model: " ", provider: "openrouter" }] }, /model IDs/],
    ];
    for (const [limitChanges, experiment, message] of cases) {
      await expect(planControlledReplay({
        ...request,
        limits: { ...limits, ...limitChanges },
        experiment,
      })).rejects.toThrow(message);
    }
    await expect(planControlledReplay({
      ...request,
      snapshot: {
        ...snapshot,
        modelRequest: { ...snapshot.modelRequest, requireZeroDataRetention: false },
      },
    })).rejects.toThrow(/zero data retention/);
  });

  it("reports missing and malformed corpus entries", async () => {
    const { store } = fixture();
    await expect(loadReplaySnapshot("missing", store)).rejects.toThrow("not found");
    vi.mocked(store.loadSnapshot).mockResolvedValueOnce("not-json");
    await expect(loadReplaySnapshot("broken", store)).rejects.toThrow("not valid JSON");
  });

  it("estimates a conservative production merger cost before inference", async () => {
    const adapter = createProductionReplayAdapter({
      env: {
        AI_REVIEW_MERGER_MODEL: "google/gemini-3.7-flash",
        AI_REVIEW_MODELS: "production/scout",
        OPENROUTER_API_KEY: "unused",
      } as never,
      params: {
        deliveryId: "replay",
        eventName: "replay",
        action: "run",
        repository: snapshot.repository,
        pullRequestNumber: snapshot.pullRequestNumber,
        force: false,
      },
      limits,
    });
    const ceiling = await adapter.estimateMergerCostUsd(
      {
        baseSha: snapshot.git.baseSha,
        headSha: snapshot.git.headSha,
        diff: snapshot.input.reviewedDiff,
        context: snapshot.input.boundedFileContext,
        threads: "",
        paths: snapshot.decision.paths,
        omitted: [],
      },
      scoutRun(),
      {
        kind: "prompt-version",
        prompt: { version: "v2", scoutSystem: "Scout v2.", mergerSystem: "Merge v2." },
      },
    );
    expect(ceiling).toBeGreaterThan(0.02);
    expect(ceiling).toBeLessThan(limits.maxCostUsd);
  });

  it("denies unknown merger pricing conservatively", async () => {
    const adapter = createProductionReplayAdapter({
      env: {
        AI_REVIEW_MERGER_MODEL: "unknown/merger",
        AI_REVIEW_MODELS: "production/scout",
        OPENROUTER_API_KEY: "unused",
      } as never,
      params: {
        deliveryId: "replay",
        eventName: "replay",
        action: "run",
        repository: snapshot.repository,
        pullRequestNumber: snapshot.pullRequestNumber,
        force: false,
      },
      limits,
    });
    expect(await adapter.estimateMergerCostUsd(
      { paths: [], omitted: [] },
      scoutRun(),
      { kind: "merger-model", model: "unknown/merger" },
    )).toBe(limits.maxCostUsd);
  });
});
