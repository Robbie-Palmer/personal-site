import {
  DEFAULT_IGNORED_AUTHORS,
  DEFAULT_MERGER,
  DEFAULT_OPENROUTER_SCOUTS,
  MAX_OPENCODE_SCOUTS,
  MAX_OPENROUTER_SCOUTS,
  MERGER_MAX_TOKENS,
  OPENROUTER_SCOUT_MAX_PRICES,
  Reviewer,
  SCOUT_CONCURRENCY,
  csv,
  dataPrompt,
  duplicateScoutModels,
  isEligibleFreeScoutModelId,
  mergerSchema,
  mergerSystem,
  renderComment,
  scoutSchema,
  scoutSystem,
  validateFindings,
  type Finding,
  type MergedFinding,
  type ModelResult,
  type ModelUsage,
  type ReviewState,
  type Scout,
  type Settings,
} from "../../.github/scripts/ai-review/ai-review.ts";
import {
  TRUSTED_AUTHOR_ASSOCIATIONS,
  type Env,
  type ReviewWorkflowParams,
} from "./env";
import { createInstallationToken } from "./github-app";

type JsonObject = Record<string, unknown>;

export const STATEFUL_REVIEW_MARKER = "<!-- stateful-ai-code-review -->";

export interface PreparedReview {
  skipReason?: string;
  headSha?: string;
  diffFingerprint?: string;
  configFingerprint?: string;
  diff?: string;
  paths: string[];
  omitted: string[];
  context?: string;
  guidelines?: string;
  threads?: string;
}

export interface ModelMetric {
  model: string;
  provider: "opencode" | "openrouter";
  role: "scout" | "merger";
  ok: boolean;
  latencyMs: number;
  costUsd: number;
  usage?: ModelUsage;
  error?: string;
}

export interface ScoutRun {
  models: string[];
  candidates: Record<string, Finding[]>;
  failed: string[];
  candidateCounts: Record<string, number>;
  invalidCounts: Record<string, number>;
  outOfScopeCounts: Record<string, number>;
  costs: Record<string, number>;
  metrics: ModelMetric[];
}

interface ScoutRunOptions {
  providers?: Array<Scout["provider"]>;
}

export interface MergedRun {
  result: JsonObject;
  cost: number;
  metric?: ModelMetric;
}

interface ClaimResponse {
  claimed: boolean;
  reason?: string;
  previousState: ReviewState;
}

function finiteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function modelSettings(
  env: Env,
  params: ReviewWorkflowParams,
  githubToken: string,
): Settings {
  const openRouterScouts = csv(
    env.AI_REVIEW_MODELS,
    DEFAULT_OPENROUTER_SCOUTS,
  );
  const openCodeScouts = csv(env.AI_REVIEW_OPENCODE_MODELS, []);
  if (openRouterScouts.length > MAX_OPENROUTER_SCOUTS) {
    throw new Error(
      `AI_REVIEW_MODELS must contain at most ${MAX_OPENROUTER_SCOUTS} model IDs`,
    );
  }
  if (openCodeScouts.length > MAX_OPENCODE_SCOUTS) {
    throw new Error(
      `AI_REVIEW_OPENCODE_MODELS must contain at most ${MAX_OPENCODE_SCOUTS} model IDs`,
    );
  }
  const rejectedScouts = openCodeScouts.filter(
    (model) => !isEligibleFreeScoutModelId(model),
  );
  if (rejectedScouts.length > 0) {
    throw new Error(
      `AI_REVIEW_OPENCODE_MODELS contains ineligible IDs: ${rejectedScouts.join(", ")}`,
    );
  }
  return {
    githubToken,
    openRouterKey: env.OPENROUTER_API_KEY,
    openCodeKey: env.OPENCODE_API_KEY,
    repository: params.repository,
    prNumber: params.pullRequestNumber,
    openRouterScouts,
    openCodeScouts,
    merger: env.AI_REVIEW_MERGER_MODEL?.trim() || DEFAULT_MERGER,
    ignoredAuthors: csv(
      env.AI_REVIEW_IGNORED_AUTHORS,
      DEFAULT_IGNORED_AUTHORS,
    ).map((author) => author.toLowerCase()),
    requireZdr: ["1", "true", "yes", "on"].includes(
      env.AI_REVIEW_ZDR?.trim().toLowerCase() ?? "",
    ),
  };
}

async function installationToken(env: Env): Promise<string> {
  return createInstallationToken({
    appId: env.AI_REVIEW_APP_ID,
    installationId: env.AI_REVIEW_APP_INSTALLATION_ID,
    privateKey: env.AI_REVIEW_APP_PRIVATE_KEY,
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function coordinatorStub(env: Env, params: ReviewWorkflowParams) {
  const name = `${params.repository}#${params.pullRequestNumber}`;
  return env.PR_STATE.get(env.PR_STATE.idFromName(name));
}

async function coordinatorRequest<T>(
  env: Env,
  params: ReviewWorkflowParams,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await coordinatorStub(env, params).fetch(
    `https://coordinator.internal${path}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Coordinator ${path} failed (${response.status})`);
  }
  return response.json<T>();
}

export async function prepareReview(
  env: Env,
  params: ReviewWorkflowParams,
): Promise<PreparedReview> {
  const settings = modelSettings(env, params, await installationToken(env));
  const reviewer = new Reviewer(settings);
  const pr = await reviewer.getPr();
  if (pr.state !== "open") {
    return { skipReason: `pull request is ${pr.state}`, paths: [], omitted: [] };
  }
  if (pr.draft && !params.force) {
    return { skipReason: "pull request is draft", paths: [], omitted: [] };
  }
  if (
    !params.force &&
    (!pr.author_association ||
      !TRUSTED_AUTHOR_ASSOCIATIONS.has(pr.author_association) ||
      pr.head.repo?.full_name !== params.repository)
  ) {
    return {
      skipReason: "automatic review is not eligible for this author or fork",
      paths: [],
      omitted: [],
    };
  }
  if (settings.ignoredAuthors.includes(pr.user.login.toLowerCase())) {
    return {
      skipReason: `ignored author ${pr.user.login}`,
      paths: [],
      omitted: [],
    };
  }

  const headSha = pr.head.sha;
  const { diff, paths, omitted } = await reviewer.changedFiles();
  const config = JSON.stringify({
    promptVersion: env.AI_REVIEW_PROMPT_VERSION,
    openRouterScouts: settings.openRouterScouts,
    openCodeScouts: settings.openCodeScouts,
    openRouterScoutMaxPrices: OPENROUTER_SCOUT_MAX_PRICES,
    merger: settings.merger,
    requireZdr: settings.requireZdr,
    scoutSystem,
    scoutSchema,
    mergerSystem,
    mergerSchema,
  });
  return {
    headSha,
    diffFingerprint: await sha256(diff),
    configFingerprint: await sha256(config),
    diff,
    paths,
    omitted,
    context: diff.trim() ? await reviewer.fileContext(paths, headSha) : "",
    guidelines: diff.trim() ? await reviewer.headGuidelines(headSha) : "",
    threads: diff.trim() ? await reviewer.reviewThreadContext() : "",
  };
}

export async function claimReview(
  env: Env,
  params: ReviewWorkflowParams,
  instanceId: string,
  prepared: PreparedReview,
): Promise<ClaimResponse> {
  if (
    !prepared.headSha ||
    !prepared.diffFingerprint ||
    !prepared.configFingerprint
  ) {
    throw new Error("Cannot claim an unprepared review");
  }
  return coordinatorRequest<ClaimResponse>(env, params, "/reviews/claim", {
    runId: instanceId,
    headSha: prepared.headSha,
    diffFingerprint: prepared.diffFingerprint,
    configFingerprint: prepared.configFingerprint,
    force: params.force,
    maxRuns: finiteNumber(env.AI_REVIEW_MAX_RUNS_PER_PR, 20),
    maxCostUsd: finiteNumber(env.AI_REVIEW_MAX_PR_COST_USD, 5),
  });
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function validateScoutPayload(
  payload: JsonObject,
  allowedFiles: Set<string>,
): {
  accepted: Finding[];
  invalidCount: number;
  outOfScopeCount: number;
} {
  const structurallyValid = validateFindings(payload, {
    merged: false,
  }) as Finding[];
  const accepted = structurallyValid.filter((finding) =>
    allowedFiles.has(finding.file),
  );
  const rawCount = Array.isArray(payload.findings)
    ? payload.findings.length
    : 0;
  return {
    accepted,
    invalidCount: rawCount - structurallyValid.length,
    outOfScopeCount: structurallyValid.length - accepted.length,
  };
}

export async function runScouts(
  env: Env,
  params: ReviewWorkflowParams,
  prepared: PreparedReview,
  options: ScoutRunOptions = {},
): Promise<ScoutRun> {
  if (!prepared.diff || !prepared.headSha) {
    throw new Error("Cannot run scouts without a prepared diff");
  }
  const settings = modelSettings(env, params, "not-used-for-model-calls");
  const reviewer = new Reviewer(settings);
  const providers = new Set(
    options.providers ?? (["openrouter", "opencode"] as const),
  );
  const availability = providers.has("opencode")
    ? await reviewer.openCodeScoutModels()
    : { models: [], unavailable: [] };
  const duplicateModels = duplicateScoutModels(
    settings.openRouterScouts,
    [...availability.models, ...availability.unavailable],
  );
  if (duplicateModels.length > 0) {
    throw new Error(
      `Scout model IDs must be unique across providers: ${duplicateModels.join(", ")}`,
    );
  }
  const runnableScouts: Scout[] = [
    ...(providers.has("openrouter")
      ? settings.openRouterScouts.map(
          (model): Scout => ({ model, provider: "openrouter" }),
        )
      : []),
    ...(providers.has("opencode")
      ? availability.models.map(
          (model): Scout => ({ model, provider: "opencode" }),
        )
      : []),
  ];
  const models = [
    ...runnableScouts.map(({ model }) => model),
    ...availability.unavailable,
  ];
  const source = dataPrompt(
    prepared.diff,
    prepared.context ?? "",
    prepared.guidelines ?? "",
  );
  const settled: Array<{
    scout: Scout;
    latencyMs: number;
    outcome: PromiseSettledResult<ModelResult>;
  }> = [];
  for (let offset = 0; offset < runnableScouts.length; offset += SCOUT_CONCURRENCY) {
    const batch = runnableScouts.slice(offset, offset + SCOUT_CONCURRENCY);
    const started = batch.map(() => Date.now());
    const outcomes = await Promise.allSettled(
      batch.map(({ model, provider }) =>
        provider === "openrouter"
          ? reviewer.callOpenRouterScout(model, scoutSystem, source)
          : reviewer.callOpenCodeScout(model, scoutSystem, source),
      ),
    );
    batch.forEach((scout, index) => {
      const outcome = outcomes[index];
      if (outcome) {
        settled.push({
          scout,
          latencyMs: Date.now() - (started[index] ?? Date.now()),
          outcome,
        });
      }
    });
  }

  const candidates: Record<string, Finding[]> = {};
  const costs: Record<string, number> = {};
  const invalidCounts: Record<string, number> = {};
  const outOfScopeCounts: Record<string, number> = {};
  const candidateCounts: Record<string, number> = {};
  const failed = [...availability.unavailable];
  const metrics: ModelMetric[] = availability.unavailable.map((model) => ({
    model,
    provider: "opencode",
    role: "scout",
    ok: false,
    latencyMs: 0,
    costUsd: 0,
    error: "model is unavailable in the live OpenCode catalogue",
  }));
  const allowedFiles = new Set(prepared.paths);
  for (const { scout, latencyMs, outcome } of settled) {
    if (outcome.status === "rejected") {
      failed.push(scout.model);
      metrics.push({
        ...scout,
        role: "scout",
        ok: false,
        latencyMs,
        costUsd: 0,
        error: errorMessage(outcome.reason),
      });
      continue;
    }
    costs[scout.model] = outcome.value.cost;
    metrics.push({
      ...scout,
      role: "scout",
      ok: true,
      latencyMs,
      costUsd: outcome.value.cost,
      usage: outcome.value.usage,
    });
    try {
      const { accepted, invalidCount, outOfScopeCount } = validateScoutPayload(
        outcome.value.payload,
        allowedFiles,
      );
      invalidCounts[scout.model] = invalidCount;
      outOfScopeCounts[scout.model] = outOfScopeCount;
      candidateCounts[scout.model] = accepted.length;
      candidates[scout.model] = accepted;
    } catch (error) {
      failed.push(scout.model);
      invalidCounts[scout.model] = 1;
      outOfScopeCounts[scout.model] = 0;
      candidateCounts[scout.model] = 0;
      const metric = metrics.at(-1);
      if (metric) {
        metric.ok = false;
        metric.error = errorMessage(error);
      }
    }
  }
  return {
    models,
    candidates,
    failed,
    candidateCounts,
    invalidCounts,
    outOfScopeCounts,
    costs,
    metrics,
  };
}

export function combineScoutRuns(...runs: ScoutRun[]): ScoutRun {
  return {
    models: runs.flatMap(({ models }) => models),
    candidates: Object.assign({}, ...runs.map(({ candidates }) => candidates)),
    failed: runs.flatMap(({ failed }) => failed),
    candidateCounts: Object.assign(
      {},
      ...runs.map(({ candidateCounts }) => candidateCounts),
    ),
    invalidCounts: Object.assign(
      {},
      ...runs.map(({ invalidCounts }) => invalidCounts),
    ),
    outOfScopeCounts: Object.assign(
      {},
      ...runs.map(({ outOfScopeCounts }) => outOfScopeCounts),
    ),
    costs: Object.assign({}, ...runs.map(({ costs }) => costs)),
    metrics: runs.flatMap(({ metrics }) => metrics),
  };
}

export async function mergeFindings(
  env: Env,
  params: ReviewWorkflowParams,
  prepared: PreparedReview,
  scouts: ScoutRun,
): Promise<MergedRun> {
  if (Object.keys(scouts.candidates).length === 0) {
    return {
      result: {
        summary:
          "All scouts failed or were unavailable, so this run has no review coverage.",
        findings: [],
      },
      cost: 0,
    };
  }
  const settings = modelSettings(env, params, "not-used-for-model-calls");
  const reviewer = new Reviewer(settings);
  const prompt = `<DATA kind=scout-candidates>
${JSON.stringify(scouts.candidates)}
</DATA>
<DATA kind=github-review-threads>
${prepared.threads ?? ""}
</DATA>`;
  const started = Date.now();
  const merged = await reviewer.callMerger(
    settings.merger,
    mergerSystem,
    prompt,
    "merged_code_review",
    mergerSchema,
    MERGER_MAX_TOKENS,
  );
  const allowedFiles = new Set(prepared.paths);
  merged.payload.findings = (
    validateFindings(merged.payload, {
      merged: true,
      allowedFiles,
    }) as MergedFinding[]
  )
    .map((finding) => ({
      ...finding,
      source_models: [
        ...new Set(
          finding.source_models.filter((model) =>
            scouts.models.includes(model),
          ),
        ),
      ],
    }))
    .filter((finding) => finding.source_models.length > 0);
  return {
    result: merged.payload,
    cost: merged.cost,
    metric: {
      model: settings.merger,
      provider: "openrouter",
      role: "merger",
      ok: true,
      latencyMs: Date.now() - started,
      costUsd: merged.cost,
      usage: merged.usage,
    },
  };
}

export async function publishReview(
  env: Env,
  params: ReviewWorkflowParams,
  prepared: PreparedReview,
  scouts: ScoutRun,
  merged: MergedRun,
  previousState: ReviewState,
): Promise<{ commentId?: number; runCostUsd: number }> {
  if (!prepared.headSha) throw new Error("Cannot publish an unprepared review");
  const settings = modelSettings(env, params, await installationToken(env));
  const reviewer = new Reviewer(settings);
  const currentHead = (await reviewer.getPr()).head.sha;
  if (currentHead !== prepared.headSha) {
    throw new Error(
      `PR head changed during review (${prepared.headSha.slice(0, 12)} -> ${currentHead.slice(0, 12)}); refusing stale comment`,
    );
  }
  const existing = await reviewer.existingComment(
    STATEFUL_REVIEW_MARKER,
    new Set([env.AI_REVIEW_APP_BOT_LOGIN]),
  );
  const runCostUsd =
    Object.values(scouts.costs).reduce((total, cost) => total + cost, 0) +
    merged.cost;
  const body = renderComment({
    result: merged.result,
    headSha: prepared.headSha,
    models: scouts.models,
    merger: settings.merger,
    failed: scouts.failed,
    candidateCounts: scouts.candidateCounts,
    invalidCounts: scouts.invalidCounts,
    outOfScopeCounts: scouts.outOfScopeCounts,
    modelCosts: scouts.costs,
    mergerCost: merged.cost,
    omitted: prepared.omitted,
    runCost: runCostUsd,
    previousState:
      existing.id !== undefined ? existing.state : previousState,
    marker: STATEFUL_REVIEW_MARKER,
    heading: "## Stateful AI code review",
  });
  return {
    commentId: await reviewer.writeComment(existing.id, body),
    runCostUsd,
  };
}

export async function recordReview(options: {
  env: Env;
  params: ReviewWorkflowParams;
  instanceId: string;
  prepared: PreparedReview;
  scouts: ScoutRun;
  merged: MergedRun;
  publication: { commentId?: number; runCostUsd: number };
  timestamp: Date;
}): Promise<void> {
  const {
    env,
    params,
    instanceId,
    prepared,
    scouts,
    merged,
    publication,
    timestamp,
  } = options;
  if (!prepared.headSha) throw new Error("Cannot record an unprepared review");
  const key = [
    "v1",
    params.repository,
    `pr-${params.pullRequestNumber}`,
    prepared.headSha,
    `${instanceId}.json`,
  ].join("/");
  await env.REVIEW_DATA.put(
    key,
    JSON.stringify({
      schemaVersion: 1,
      status: "published",
      repository: params.repository,
      pullRequestNumber: params.pullRequestNumber,
      headSha: prepared.headSha,
      diffFingerprint: prepared.diffFingerprint,
      configFingerprint: prepared.configFingerprint,
      promptVersion: env.AI_REVIEW_PROMPT_VERSION,
      trigger: {
        eventName: params.eventName,
        action: params.action,
        force: params.force,
      },
      coverage: {
        paths: prepared.paths,
        omitted: prepared.omitted,
      },
      findings: merged.result,
      models: [...scouts.metrics, ...(merged.metric ? [merged.metric] : [])],
      runCostUsd: publication.runCostUsd,
      commentId: publication.commentId,
      workflow: {
        instanceId,
        timestamp: timestamp.toISOString(),
      },
    }),
    { httpMetadata: { contentType: "application/json" } },
  );
}

export async function completeReview(
  env: Env,
  params: ReviewWorkflowParams,
  instanceId: string,
  prepared: PreparedReview,
  merged: MergedRun,
  publication: { commentId?: number; runCostUsd: number },
): Promise<void> {
  await coordinatorRequest(env, params, "/reviews/complete", {
    runId: instanceId,
    headSha: prepared.headSha,
    costUsd: publication.runCostUsd,
    commentId: publication.commentId,
    findings: merged.result.findings ?? [],
  });
}

export async function failReview(
  env: Env,
  params: ReviewWorkflowParams,
  instanceId: string,
  error: unknown,
  costUsd = 0,
): Promise<void> {
  await coordinatorRequest(env, params, "/reviews/fail", {
    runId: instanceId,
    error: errorMessage(error),
    costUsd,
  });
}
