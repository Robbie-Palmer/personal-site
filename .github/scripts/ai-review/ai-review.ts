import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_IGNORED_AUTHORS,
  DEFAULT_MERGER,
  DEFAULT_OPENROUTER_SCOUTS,
  MARKER,
  MAX_OPENCODE_SCOUTS,
  MAX_OPENROUTER_SCOUTS,
  MERGER_MAX_TOKENS,
  Reviewer,
  SCOUT_CONCURRENCY,
  csv,
  dataPrompt,
  duplicateScoutModels,
  isCreditExhaustion,
  isEligibleFreeScoutModelId,
  mergerSchema,
  mergerSystem,
  renderComment,
  scoutSystem,
  validateFindings,
  workflowStatusForCoverage,
  type Finding,
  type MergedFinding,
  type ModelResult,
  type Scout,
  type Settings,
} from "ai-review-domain/reviewer";

type JsonObject = Record<string, unknown>;
type WorkflowStatus = "success" | "credits" | "no_coverage" | "failure";

const MAX_GUIDELINES_CHARS = 20_000;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function settingsFromEnv(): Settings {
  const openRouterScouts = csv(
    process.env.AI_REVIEW_MODELS,
    DEFAULT_OPENROUTER_SCOUTS,
  );
  if (openRouterScouts.length > MAX_OPENROUTER_SCOUTS) {
    throw new Error(
      `AI_REVIEW_MODELS must contain at most ${MAX_OPENROUTER_SCOUTS} model IDs`,
    );
  }
  const openCodeScouts = csv(process.env.AI_REVIEW_OPENCODE_MODELS, []);
  if (openCodeScouts.length > MAX_OPENCODE_SCOUTS) {
    throw new Error(
      `AI_REVIEW_OPENCODE_MODELS must contain at most ${MAX_OPENCODE_SCOUTS} model IDs`,
    );
  }
  const rejectedScouts = openCodeScouts.filter(
    (model) => !isEligibleFreeScoutModelId(model),
  );
  if (rejectedScouts.length) {
    throw new Error(
      `AI_REVIEW_OPENCODE_MODELS only accepts enabled free OpenCode model IDs; rejected: ${rejectedScouts.join(", ")}`,
    );
  }
  return {
    githubToken: env("GITHUB_TOKEN"),
    openRouterKey: env("OPENROUTER_API_KEY"),
    openCodeKey: process.env.OPENCODE_API_KEY?.trim() || undefined,
    repository: env("GITHUB_REPOSITORY"),
    prNumber: Number.parseInt(env("PR_NUMBER"), 10),
    openRouterScouts,
    openCodeScouts,
    merger: process.env.AI_REVIEW_MERGER_MODEL?.trim() || DEFAULT_MERGER,
    ignoredAuthors: csv(
      process.env.AI_REVIEW_IGNORED_AUTHORS,
      DEFAULT_IGNORED_AUTHORS,
    ).map((author) => author.toLowerCase()),
    requireZdr: ["1", "true", "yes", "on"].includes(
      process.env.AI_REVIEW_ZDR?.trim().toLowerCase() ?? "",
    ),
  };
}

async function repositoryGuidelines(): Promise<string> {
  for (const path of [
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
  ]) {
    try {
      return (await readFile(path, "utf8")).slice(0, MAX_GUIDELINES_CHARS);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return "";
}

function findingCount(payload: JsonObject): number {
  return Array.isArray(payload.findings) ? payload.findings.length : 0;
}

function setWorkflowStatus(status: WorkflowStatus): void {
  const output = process.env.GITHUB_OUTPUT;
  if (output) appendFileSync(output, `status=${status}\n`, "utf8");
}

async function main(): Promise<"success" | "no_coverage"> {
  const settings = settingsFromEnv();
  if (!Number.isInteger(settings.prNumber) || settings.prNumber < 1) {
    throw new Error("PR_NUMBER must be positive");
  }
  const reviewer = new Reviewer(settings);
  const pr = await reviewer.getPr();
  if (pr.state !== "open") {
    console.log(`Skipping PR #${settings.prNumber} because it is ${pr.state}`);
    return "success";
  }
  const author = pr.user.login.toLowerCase();
  if (settings.ignoredAuthors.includes(author)) {
    console.log(
      `Skipping PR #${settings.prNumber} from ignored author ${author}`,
    );
    return "success";
  }
  const initialHead = pr.head.sha;
  const { diff, paths, omitted } = await reviewer.changedFiles();
  const existing = await reviewer.existingComment();
  if (!diff.trim()) {
    const state = JSON.stringify(existing.state);
    await reviewer.writeComment(
      existing.id,
      `${MARKER}\n<!-- ai-review-cost:${state} -->\n## AI code review\n\nNo reviewable text changes found.`,
    );
    return "success";
  }

  const source = dataPrompt(
    diff,
    await reviewer.fileContext(paths, initialHead),
    await repositoryGuidelines(),
  );
  const availability = await reviewer.openCodeScoutModels();
  const duplicateModels = duplicateScoutModels(settings.openRouterScouts, [
    ...availability.models,
    ...availability.unavailable,
  ]);
  if (duplicateModels.length) {
    throw new Error(
      `Scout model IDs must be unique across OpenRouter and OpenCode; duplicates: ${duplicateModels.join(", ")}`,
    );
  }
  const runnableScouts: Scout[] = [
    ...settings.openRouterScouts.map(
      (model): Scout => ({ model, provider: "openrouter" }),
    ),
    ...availability.models.map(
      (model): Scout => ({ model, provider: "opencode" }),
    ),
  ];
  const scouts = [
    ...runnableScouts.map(({ model }) => model),
    ...availability.unavailable,
  ];
  const settled: Array<{
    model: string;
    outcome: PromiseSettledResult<ModelResult>;
  }> = [];
  for (
    let offset = 0;
    offset < runnableScouts.length;
    offset += SCOUT_CONCURRENCY
  ) {
    const batch = runnableScouts.slice(offset, offset + SCOUT_CONCURRENCY);
    const outcomes = await Promise.allSettled(
      batch.map(({ model, provider }) =>
        provider === "openrouter"
          ? reviewer.callOpenRouterScout(model, scoutSystem, source)
          : reviewer.callOpenCodeScout(model, scoutSystem, source),
      ),
    );
    batch.forEach(({ model }, index) => {
      const outcome = outcomes[index];
      if (outcome) settled.push({ model, outcome });
    });
  }
  const candidates: Record<string, Finding[]> = {};
  const costs: Record<string, number> = {};
  const invalidCounts: Record<string, number> = {};
  const outOfScopeCounts: Record<string, number> = {};
  const candidateCounts: Record<string, number> = {};
  const failed = [...availability.unavailable];
  for (const model of availability.unavailable) {
    console.error(
      `::warning::Scout ${model} is no longer present in the OpenCode free-model catalogue`,
    );
  }
  const allowedFiles = new Set(paths);
  settled.forEach(({ model, outcome }) => {
    if (outcome.status === "rejected") {
      failed.push(model);
      console.error(`::warning::Scout ${model} failed: ${String(outcome.reason)}`);
      return;
    }
    costs[model] = outcome.value.cost;
    try {
      const raw = outcome.value.payload;
      const structurallyValid = validateFindings(raw, {
        merged: false,
      }) as Finding[];
      const accepted = structurallyValid.filter((finding) =>
        allowedFiles.has(finding.file),
      );
      invalidCounts[model] = findingCount(raw) - structurallyValid.length;
      outOfScopeCounts[model] = structurallyValid.length - accepted.length;
      candidateCounts[model] = accepted.length;
      candidates[model] = accepted;
    } catch (error) {
      failed.push(model);
      invalidCounts[model] = 1;
      outOfScopeCounts[model] = 0;
      candidateCounts[model] = 0;
      console.error(
        `::warning::Scout ${model} returned invalid payload: ${String(error)}`,
      );
    }
  });

  let merged: ModelResult;
  if (Object.keys(candidates).length) {
    const threads = await reviewer.reviewThreadContext();
    const mergerPrompt = `<DATA kind=scout-candidates>\n${JSON.stringify(candidates)}\n</DATA>
<DATA kind=github-review-threads>\n${threads}\n</DATA>`;
    merged = await reviewer.callMerger(
      settings.merger,
      mergerSystem,
      mergerPrompt,
      "merged_code_review",
      mergerSchema,
      MERGER_MAX_TOKENS,
    );
  } else {
    merged = {
      payload: {
        summary:
          "All scouts failed or were unavailable, so this run has no review coverage.",
        findings: [],
      },
      cost: 0,
    };
  }
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
          finding.source_models.filter((model) => scouts.includes(model)),
        ),
      ],
    }))
    .filter((finding) => finding.source_models.length > 0);

  const currentHead = (await reviewer.getPr()).head.sha;
  if (currentHead !== initialHead) {
    throw new Error(
      `PR head changed during review (${initialHead.slice(0, 12)} -> ${currentHead.slice(0, 12)}); refusing stale comment`,
    );
  }
  const runCost =
    Object.values(costs).reduce((total, cost) => total + cost, 0) + merged.cost;
  await reviewer.writeComment(
    existing.id,
    renderComment({
      result: merged.payload,
      headSha: initialHead,
      models: scouts,
      merger: settings.merger,
      failed,
      candidateCounts,
      invalidCounts,
      outOfScopeCounts,
      modelCosts: costs,
      mergerCost: merged.cost,
      omitted,
      runCost,
      previousState: existing.state,
    }),
  );
  console.log(
    `Reviewed PR #${settings.prNumber} at ${initialHead.slice(0, 12)}; cost $${runCost.toFixed(4)}`,
  );
  return workflowStatusForCoverage(Object.keys(candidates).length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((status) => {
      setWorkflowStatus(status);
    })
    .catch((error) => {
      if (isCreditExhaustion(error)) {
        console.log(
          "::notice::AI code review skipped because the OpenRouter API key is out of credits.",
        );
        setWorkflowStatus("credits");
        return;
      }
      console.error(
        `::error::${error instanceof Error ? error.message : String(error)}`,
      );
      setWorkflowStatus("failure");
      process.exitCode = 1;
    });
}
