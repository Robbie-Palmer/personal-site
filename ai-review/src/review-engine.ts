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

export interface ReviewHunk {
  hunkId: string;
  fingerprint: string;
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface ChangeProfile {
  diffCharacters: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewableFiles: number;
  omittedFiles: number;
  hunks: number;
  languages: string[];
  repositoryAreas: string[];
  riskSignals: string[];
}

export interface PullRequestMetadata {
  author: string;
  authorAssociation?: string;
  title?: string;
  labels: string[];
  headRef?: string;
  taskType?: "bug" | "dependency" | "documentation" | "feature";
  originatingAgent?: "claude" | "codex" | "opencode";
}

export interface PreparedReview {
  skipReason?: string;
  headSha?: string;
  diffFingerprint?: string;
  configFingerprint?: string;
  diff?: string;
  paths: string[];
  omitted: string[];
  hunks?: ReviewHunk[];
  changeProfile?: ChangeProfile;
  pullRequest?: PullRequestMetadata;
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

export interface IdentifiedFinding extends Finding {
  findingId: string;
  hunkIds: string[];
}

export interface IdentifiedMergedFinding extends MergedFinding {
  findingId: string;
  hunkIds: string[];
}

export interface IdentifiedReviewArtifacts {
  hunks: ReviewHunk[];
  candidates: Record<string, IdentifiedFinding[]>;
  publishedFindings: IdentifiedMergedFinding[];
}

export type ReviewRecordStatus = "denied" | "failed" | "published" | "skipped";

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

const EXTENSION_LANGUAGE: Record<string, string> = {
  css: "CSS",
  go: "Go",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsx: "JavaScript",
  md: "Markdown",
  mdx: "MDX",
  py: "Python",
  rs: "Rust",
  sh: "Shell",
  sql: "SQL",
  tf: "Terraform",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TypeScript",
  yaml: "YAML",
  yml: "YAML",
};

function countPatchLines(diff: string, prefix: "+" | "-"): number {
  return diff
    .split("\n")
    .filter(
      (line) =>
        line.startsWith(prefix) &&
        !line.startsWith(prefix === "+" ? "+++" : "---"),
    ).length;
}

function taskType(labels: string[]): PullRequestMetadata["taskType"] {
  const normalized = new Set(labels.map((label) => label.toLowerCase()));
  if (["bug", "fix"].some((label) => normalized.has(label))) return "bug";
  if (["dependencies", "dependency"].some((label) => normalized.has(label))) {
    return "dependency";
  }
  if (["documentation", "docs"].some((label) => normalized.has(label))) {
    return "documentation";
  }
  if (["enhancement", "feature"].some((label) => normalized.has(label))) {
    return "feature";
  }
  return undefined;
}

function originatingAgent(
  title: string | undefined,
  headRef: string | undefined,
): PullRequestMetadata["originatingAgent"] {
  const source = `${title ?? ""} ${headRef ?? ""}`.toLowerCase();
  if (/(^|[^a-z])claude([^a-z]|$)/.test(source)) return "claude";
  if (/(^|[^a-z])codex([^a-z]|$)/.test(source)) return "codex";
  if (/(^|[^a-z])opencode([^a-z]|$)/.test(source)) return "opencode";
  return undefined;
}

function summarizeChange(
  diff: string,
  paths: string[],
  omitted: string[],
  hunks: ReviewHunk[],
): ChangeProfile {
  const allPaths = [...new Set([...paths, ...omitted])];
  const languages = [
    ...new Set(
      allPaths
        .map((path) => path.split(".").at(-1)?.toLowerCase())
        .map((extension) => (extension ? EXTENSION_LANGUAGE[extension] : undefined))
        .filter((language): language is string => language !== undefined),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const repositoryAreas = [
    ...new Set(
      allPaths.map((path) => {
        const [first] = path.split("/");
        return path.includes("/") && first ? first : "root";
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const riskSignals = [
    allPaths.some((path) => /(^|\/)(auth|security|secrets?)(\/|\.|$)/i.test(path))
      ? "authentication-or-secrets"
      : undefined,
    allPaths.some((path) => /(^|\/)(drizzle|migrations?|schema)(\/|\.|$)/i.test(path))
      ? "database-schema"
      : undefined,
    allPaths.some((path) => /(^|\/)(infra|infra-bootstrap)(\/|$)/i.test(path))
      ? "infrastructure"
      : undefined,
    allPaths.some((path) => path.startsWith(".github/workflows/"))
      ? "ci-or-deployment"
      : undefined,
  ].filter((signal): signal is string => signal !== undefined);
  return {
    diffCharacters: diff.length,
    additions: countPatchLines(diff, "+"),
    deletions: countPatchLines(diff, "-"),
    changedFiles: allPaths.length,
    reviewableFiles: paths.length,
    omittedFiles: omitted.length,
    hunks: hunks.length,
    languages,
    repositoryAreas,
    riskSignals,
  };
}

function parseHunkHeader(line: string): {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
} | null {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    oldLines: Number(match[2] ?? 1),
    newStart: Number(match[3]),
    newLines: Number(match[4] ?? 1),
  };
}

export async function identifyDiffHunks(diff: string): Promise<ReviewHunk[]> {
  const pending: Array<{
    file: string;
    body: string[];
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
  }> = [];
  let file: string | undefined;
  let current: (typeof pending)[number] | undefined;
  for (const line of diff.split("\n")) {
    const fileMatch = /^diff --git a\/.* b\/(.+)$/.exec(line);
    if (fileMatch) {
      file = fileMatch[1];
      current = undefined;
      continue;
    }
    const header = parseHunkHeader(line);
    if (header && file) {
      current = { file, body: [], ...header };
      pending.push(current);
      continue;
    }
    if (current && line !== String.raw`\ No newline at end of file`) {
      current.body.push(line);
    }
  }

  const occurrences = new Map<string, number>();
  return Promise.all(
    pending.map(async ({ file: path, body, ...coordinates }) => {
      const canonical = `${path}\n${body.join("\n")}`;
      const occurrence = (occurrences.get(canonical) ?? 0) + 1;
      occurrences.set(canonical, occurrence);
      const fingerprint = await sha256(canonical);
      const identity = await sha256(`${canonical}\noccurrence:${occurrence}`);
      return {
        hunkId: `h_${identity.slice(0, 24)}`,
        fingerprint,
        file: path,
        ...coordinates,
      };
    }),
  );
}

function normalizedFindingTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hunkIdsForFinding(
  finding: Pick<Finding, "file" | "line">,
  hunks: ReviewHunk[],
): string[] {
  const sameFile = hunks.filter((hunk) => hunk.file === finding.file);
  if (finding.line === null) return sameFile.map(({ hunkId }) => hunkId);
  const containing = sameFile.filter(
    (hunk) =>
      finding.line !== null &&
      finding.line >= hunk.newStart &&
      finding.line < hunk.newStart + Math.max(hunk.newLines, 1),
  );
  if (containing.length > 0) return containing.map(({ hunkId }) => hunkId);
  const nearest = [...sameFile].sort(
    (left, right) =>
      Math.abs(left.newStart - (finding.line ?? 0)) -
      Math.abs(right.newStart - (finding.line ?? 0)),
  )[0];
  return nearest ? [nearest.hunkId] : [];
}

async function findingIdentity(finding: Pick<Finding, "file" | "title">) {
  const digest = await sha256(
    `${finding.file.toLowerCase()}\n${normalizedFindingTitle(finding.title)}`,
  );
  return `f_${digest.slice(0, 24)}`;
}

function findingSimilarity(left: Finding, right: Finding): number {
  if (left.file !== right.file) return Number.NEGATIVE_INFINITY;
  const leftTokens = new Set(normalizedFindingTitle(left.title).split(" "));
  const rightTokens = new Set(normalizedFindingTitle(right.title).split(" "));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const lineDistance =
    left.line === null || right.line === null ? 0 : Math.abs(left.line - right.line);
  return overlap / union - Math.min(lineDistance, 100) / 1_000;
}

export async function identifyReviewArtifacts(
  prepared: PreparedReview,
  scouts: ScoutRun,
  merged: MergedRun,
): Promise<IdentifiedReviewArtifacts> {
  const hunks = prepared.hunks ?? [];
  const candidates: Record<string, IdentifiedFinding[]> = {};
  for (const [model, findings] of Object.entries(scouts.candidates)) {
    candidates[model] = await Promise.all(
      findings.map(async (finding) => ({
        ...finding,
        findingId: await findingIdentity(finding),
        hunkIds: hunkIdsForFinding(finding, hunks),
      })),
    );
  }
  const mergedFindings = Array.isArray(merged.result.findings)
    ? (merged.result.findings as MergedFinding[])
    : [];
  const publishedFindings = await Promise.all(
    mergedFindings.map(async (finding): Promise<IdentifiedMergedFinding> => {
      const sourceCandidates = finding.source_models.flatMap(
        (model) => candidates[model] ?? [],
      );
      const closest = [...sourceCandidates].sort(
        (left, right) =>
          findingSimilarity(finding, right) - findingSimilarity(finding, left),
      )[0];
      const sufficientlySimilar =
        closest && findingSimilarity(finding, closest) >= 0.25;
      return {
        ...finding,
        findingId: sufficientlySimilar
          ? closest.findingId
          : await findingIdentity(finding),
        hunkIds: sufficientlySimilar
          ? closest.hunkIds
          : hunkIdsForFinding(finding, hunks),
      };
    }),
  );
  return { hunks, candidates, publishedFindings };
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
  const hunks = await identifyDiffHunks(diff);
  const labels = (pr.labels ?? [])
    .map(({ name }) => name?.trim())
    .filter((name): name is string => Boolean(name));
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
    hunks,
    changeProfile: summarizeChange(diff, paths, omitted, hunks),
    pullRequest: {
      author: pr.user.login,
      authorAssociation: pr.author_association,
      title: pr.title,
      labels,
      headRef: pr.head.ref,
      taskType: taskType(labels),
      originatingAgent: originatingAgent(pr.title, pr.head.ref),
    },
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
  artifacts: IdentifiedReviewArtifacts;
  publication: { commentId?: number; runCostUsd: number };
  timestamp: Date;
}): Promise<void> {
  if (!options.prepared.headSha) {
    throw new Error("Cannot record an unprepared review");
  }
  await recordReviewTerminal({ ...options, status: "published" });
}

export async function recordReviewTerminal(options: {
  env: Env;
  params: ReviewWorkflowParams;
  instanceId: string;
  status: ReviewRecordStatus;
  timestamp: Date;
  prepared?: PreparedReview;
  scouts?: ScoutRun;
  merged?: MergedRun;
  artifacts?: IdentifiedReviewArtifacts;
  publication?: { commentId?: number; runCostUsd: number };
  reason?: string;
  error?: string;
  failedPhase?: string;
  incurredCostUsd?: number;
}): Promise<void> {
  const {
    env,
    params,
    instanceId,
    status,
    timestamp,
    prepared,
    scouts,
    merged,
    artifacts,
    publication,
  } = options;
  const headSha = prepared?.headSha ?? params.headSha ?? "unknown-head";
  const key = [
    "v2",
    params.repository,
    `pr-${params.pullRequestNumber}`,
    headSha,
    instanceId,
    `${status}.json`,
  ].join("/");
  const summary =
    merged && typeof merged.result.summary === "string"
      ? merged.result.summary
      : undefined;
  await env.REVIEW_DATA.put(
    key,
    JSON.stringify({
      schemaVersion: 2,
      recordType: "review-run-terminal",
      status,
      repository: params.repository,
      pullRequestNumber: params.pullRequestNumber,
      headSha,
      diffFingerprint: prepared?.diffFingerprint,
      configFingerprint: prepared?.configFingerprint,
      promptVersion: env.AI_REVIEW_PROMPT_VERSION,
      reviewerConfiguration: {
        openRouterScouts: csv(env.AI_REVIEW_MODELS, DEFAULT_OPENROUTER_SCOUTS),
        openCodeScouts: csv(env.AI_REVIEW_OPENCODE_MODELS, []),
        merger: env.AI_REVIEW_MERGER_MODEL?.trim() || DEFAULT_MERGER,
        requireZeroDataRetention: ["1", "true", "yes", "on"].includes(
          env.AI_REVIEW_ZDR?.trim().toLowerCase() ?? "",
        ),
      },
      trigger: {
        deliveryId: params.deliveryId,
        eventName: params.eventName,
        action: params.action,
        force: params.force,
        webhookHeadSha: params.headSha,
      },
      pullRequest: prepared?.pullRequest,
      change: prepared?.changeProfile,
      coverage: prepared
        ? {
            paths: prepared.paths,
            omitted: prepared.omitted,
          }
        : undefined,
      hunks: artifacts?.hunks ?? prepared?.hunks ?? [],
      candidates: artifacts?.candidates ?? {},
      findings:
        summary !== undefined || artifacts
          ? {
              summary,
              published: artifacts?.publishedFindings ?? [],
            }
          : undefined,
      models: scouts
        ? [...scouts.metrics, ...(merged?.metric ? [merged.metric] : [])]
        : [],
      runCostUsd: publication?.runCostUsd ?? options.incurredCostUsd ?? 0,
      commentId: publication?.commentId,
      terminal: {
        reason: options.reason,
        error: options.error,
        failedPhase: options.failedPhase,
      },
      workflow: {
        instanceId,
        triggeredAt: timestamp.toISOString(),
        recordedAt: new Date().toISOString(),
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
  artifacts: IdentifiedReviewArtifacts,
  publication: { commentId?: number; runCostUsd: number },
): Promise<void> {
  await coordinatorRequest(env, params, "/reviews/complete", {
    runId: instanceId,
    headSha: prepared.headSha,
    costUsd: publication.runCostUsd,
    commentId: publication.commentId,
    hunks: artifacts.hunks,
    findings: artifacts.publishedFindings,
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
