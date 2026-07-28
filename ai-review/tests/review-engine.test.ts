import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENROUTER_SCOUTS,
  Reviewer,
} from "../../.github/scripts/ai-review/ai-review";
import type { Env, ReviewWorkflowParams } from "../src/env";
import {
  STATEFUL_REVIEW_MARKER,
  claimReview,
  completeReview,
  failReview,
  mergeFindings,
  prepareReview,
  publishReview,
  recordReview,
  runScouts,
} from "../src/review-engine";

const params: ReviewWorkflowParams = {
  deliveryId: "delivery-1",
  eventName: "pull_request",
  action: "synchronize",
  repository: "Robbie-Palmer/personal-site",
  pullRequestNumber: 42,
  headSha: "a".repeat(40),
  force: false,
};

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

function environment(put = vi.fn()): Env {
  return {
    AI_REVIEW_MODELS:
      "moonshotai/kimi-k2.6,deepseek/deepseek-v4-pro",
    AI_REVIEW_OPENCODE_MODELS: "",
    AI_REVIEW_MERGER_MODEL: "anthropic/claude-sonnet-4.6",
    AI_REVIEW_IGNORED_AUTHORS: "renovate[bot],dependabot[bot]",
    AI_REVIEW_ZDR: "false",
    AI_REVIEW_APP_BOT_LOGIN: "robbie-palmer-ai-review[bot]",
    AI_REVIEW_MAX_PR_COST_USD: "5",
    AI_REVIEW_MAX_RUNS_PER_PR: "20",
    AI_REVIEW_PROMPT_VERSION: "stateless-parity-v1",
    AI_REVIEW_APP_ID: "123",
    AI_REVIEW_APP_INSTALLATION_ID: "456",
    AI_REVIEW_APP_PRIVATE_KEY: privateKey,
    OPENROUTER_API_KEY: "openrouter-key",
    REVIEW_DATA: { put },
  } as unknown as Env;
}

function json(payload: unknown): Response {
  return Response.json(payload);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stateful review engine", () => {
  it("does not automatically spend on fork pull requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: "installation-token" }))
        .mockResolvedValueOnce(
          json({
            state: "open",
            draft: false,
            author_association: "CONTRIBUTOR",
            user: { login: "outside-contributor" },
            head: {
              sha: params.headSha,
              repo: { full_name: "outside-contributor/personal-site" },
            },
          }),
        ),
    );

    await expect(prepareReview(environment(), params)).resolves.toMatchObject({
      skipReason: "automatic review is not eligible for this author or fork",
    });
  });

  it("skips drafts and ignored authors but permits a forced draft review", async () => {
    const draft = {
      state: "open",
      draft: true,
      author_association: "OWNER",
      user: { login: "robbie" },
      head: {
        sha: params.headSha,
        repo: { full_name: params.repository },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: "installation-token" }))
        .mockResolvedValueOnce(json(draft)),
    );
    await expect(prepareReview(environment(), params)).resolves.toMatchObject({
      skipReason: "pull request is draft",
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: "installation-token" }))
        .mockResolvedValueOnce(
          json({
            ...draft,
            draft: false,
            user: { login: "renovate[bot]" },
          }),
        ),
    );
    await expect(prepareReview(environment(), params)).resolves.toMatchObject({
      skipReason: "ignored author renovate[bot]",
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: "installation-token" }))
        .mockResolvedValueOnce(json(draft))
        .mockResolvedValueOnce(json([])),
    );
    await expect(
      prepareReview(environment(), { ...params, force: true }),
    ).resolves.toMatchObject({
      headSha: params.headSha,
      diff: "",
      context: "",
      guidelines: "",
      threads: "",
    });
  });

  it("rejects invalid model configuration before making model calls", async () => {
    const prepared = {
      headSha: params.headSha,
      diff: "diff",
      paths: ["app.ts"],
      omitted: [],
    };

    const tooManyPaid = environment();
    tooManyPaid.AI_REVIEW_MODELS = Array.from(
      { length: 7 },
      (_, index) => `provider/model-${index}`,
    ).join(",");
    await expect(runScouts(tooManyPaid, params, prepared)).rejects.toThrow(
      "AI_REVIEW_MODELS must contain at most 6",
    );

    const tooManyFree = environment();
    tooManyFree.AI_REVIEW_OPENCODE_MODELS = Array.from(
      { length: 7 },
      (_, index) => `model-${index}-free`,
    ).join(",");
    await expect(runScouts(tooManyFree, params, prepared)).rejects.toThrow(
      "AI_REVIEW_OPENCODE_MODELS must contain at most 6",
    );

    const ineligible = environment();
    ineligible.AI_REVIEW_OPENCODE_MODELS = "paid-model";
    await expect(runScouts(ineligible, params, prepared)).rejects.toThrow(
      "contains ineligible IDs",
    );
    await expect(
      runScouts(environment(), params, {
        paths: [],
        omitted: [],
      }),
    ).rejects.toThrow("without a prepared diff");
  });

  it("uses reviewer defaults when optional model settings are absent", async () => {
    const env = environment();
    env.AI_REVIEW_MODELS = undefined;
    env.AI_REVIEW_OPENCODE_MODELS = undefined;
    env.AI_REVIEW_MERGER_MODEL = undefined;
    env.AI_REVIEW_IGNORED_AUTHORS = undefined;
    env.AI_REVIEW_ZDR = undefined;
    vi.spyOn(Reviewer.prototype, "openCodeScoutModels").mockResolvedValue({
      models: [],
      unavailable: [],
    });
    vi.spyOn(Reviewer.prototype, "callOpenRouterScout").mockRejectedValue(
      new Error("provider unavailable"),
    );

    const result = await runScouts(env, params, {
      headSha: params.headSha,
      diff: "diff",
      paths: ["app.ts"],
      omitted: [],
    });

    expect(result.models).toEqual(DEFAULT_OPENROUTER_SCOUTS);
  });

  it("records unavailable, rejected, and invalid scout outcomes", async () => {
    vi.spyOn(Reviewer.prototype, "openCodeScoutModels").mockResolvedValue({
      models: [],
      unavailable: ["unavailable-free"],
    });
    vi.spyOn(Reviewer.prototype, "callOpenRouterScout")
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({
        payload: { unexpected: [] },
        cost: 0.1,
      });

    const result = await runScouts(environment(), params, {
      headSha: params.headSha,
      diff: "diff",
      paths: ["app.ts"],
      omitted: [],
    });

    expect(result.failed).toEqual([
      "unavailable-free",
      "moonshotai/kimi-k2.6",
      "deepseek/deepseek-v4-pro",
    ]);
    expect(result.invalidCounts["deepseek/deepseek-v4-pro"]).toBe(1);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: "unavailable-free",
          ok: false,
        }),
        expect.objectContaining({
          model: "moonshotai/kimi-k2.6",
          error: "provider unavailable",
        }),
        expect.objectContaining({
          model: "deepseek/deepseek-v4-pro",
          ok: false,
        }),
      ]),
    );
  });

  it("rejects duplicate providers and skips merging without candidates", async () => {
    vi.spyOn(Reviewer.prototype, "openCodeScoutModels").mockResolvedValue({
      models: ["moonshotai/kimi-k2.6"],
      unavailable: [],
    });
    await expect(
      runScouts(environment(), params, {
        headSha: params.headSha,
        diff: "diff",
        paths: ["app.ts"],
        omitted: [],
      }),
    ).rejects.toThrow("must be unique across providers");

    await expect(
      mergeFindings(
        environment(),
        params,
        { paths: [], omitted: [] },
        {
          models: [],
          candidates: {},
          failed: [],
          candidateCounts: {},
          invalidCounts: {},
          outOfScopeCounts: {},
          costs: {},
          metrics: [],
        },
      ),
    ).resolves.toEqual({
      result: {
        summary:
          "All scouts failed or were unavailable, so this run has no review coverage.",
        findings: [],
      },
      cost: 0,
    });
  });

  it("uses durable claims and records completion and failure state", async () => {
    const coordinatorFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/reviews/claim") {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ maxRuns: 20, maxCostUsd: 5 });
        return json({
          claimed: true,
          previousState: { runs: 0, total_usd: 0 },
        });
      }
      return json(path === "/reviews/complete" ? { completed: true } : { failed: true });
    });
    const env = environment();
    env.AI_REVIEW_MAX_RUNS_PER_PR = "-1";
    env.AI_REVIEW_MAX_PR_COST_USD = "not-a-number";
    Object.assign(env, {
      PR_STATE: {
        idFromName: vi.fn(() => "coordinator-id"),
        get: vi.fn(() => ({ fetch: coordinatorFetch })),
      },
    });
    const prepared = {
      headSha: params.headSha,
      diffFingerprint: "diff-fingerprint",
      configFingerprint: "config-fingerprint",
      paths: [],
      omitted: [],
    };

    await expect(
      claimReview(env, params, "review-1", prepared),
    ).resolves.toMatchObject({ claimed: true });
    await completeReview(
      env,
      params,
      "review-1",
      prepared,
      { result: { findings: [] }, cost: 0 },
      { commentId: 42, runCostUsd: 0.25 },
    );
    await failReview(env, params, "review-1", "failed");
    expect(coordinatorFetch).toHaveBeenCalledTimes(3);

    coordinatorFetch.mockResolvedValueOnce(
      new Response("unavailable", { status: 503 }),
    );
    await expect(
      claimReview(env, params, "review-2", prepared),
    ).rejects.toThrow("Coordinator /reviews/claim failed (503)");
    await expect(
      claimReview(env, params, "review-3", { paths: [], omitted: [] }),
    ).rejects.toThrow("Cannot claim an unprepared review");
  });

  it("refuses unprepared or stale publication and records only prepared runs", async () => {
    const env = environment();
    const emptyScouts = {
      models: [],
      candidates: {},
      failed: [],
      candidateCounts: {},
      invalidCounts: {},
      outOfScopeCounts: {},
      costs: {},
      metrics: [],
    };
    const emptyMerged = {
      result: { summary: "Clean.", findings: [] },
      cost: 0,
    };
    await expect(
      publishReview(
        env,
        params,
        { paths: [], omitted: [] },
        emptyScouts,
        emptyMerged,
        { runs: 0, total_usd: 0 },
      ),
    ).rejects.toThrow("Cannot publish an unprepared review");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: "installation-token" }))
        .mockResolvedValueOnce(
          json({
            head: { sha: "b".repeat(40) },
          }),
        ),
    );
    await expect(
      publishReview(
        env,
        params,
        {
          headSha: params.headSha,
          paths: [],
          omitted: [],
        },
        emptyScouts,
        emptyMerged,
        { runs: 0, total_usd: 0 },
      ),
    ).rejects.toThrow("refusing stale comment");

    await expect(
      recordReview({
        env,
        params,
        instanceId: "review-1",
        prepared: { paths: [], omitted: [] },
        scouts: emptyScouts,
        merged: emptyMerged,
        publication: { runCostUsd: 0 },
        timestamp: new Date(),
      }),
    ).rejects.toThrow("Cannot record an unprepared review");
  });

  it("runs and visibly publishes the same OpenRouter plus OpenCode ensemble", async () => {
    const publishedBodies: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/app/installations/456/access_tokens") {
        return json({ token: "installation-token" });
      }
      if (url.pathname === "/repos/Robbie-Palmer/personal-site/pulls/42") {
        return json({
          state: "open",
          draft: false,
          author_association: "OWNER",
          user: { login: "robbie" },
          head: {
            sha: params.headSha,
            repo: { full_name: params.repository },
          },
        });
      }
      if (url.pathname.endsWith("/pulls/42/files")) {
        return json([
          {
            filename: "app.ts",
            status: "modified",
            patch: "@@ -1 +1 @@\n-return false\n+return true",
          },
        ]);
      }
      if (url.pathname.endsWith("/contents/app.ts")) {
        return json({
          encoding: "base64",
          size: 18,
          content: Buffer.from("export default true").toString("base64"),
        });
      }
      if (url.pathname.endsWith("/contents/AGENTS.md")) {
        return json({
          encoding: "base64",
          size: 20,
          content: Buffer.from("Review correctness.").toString("base64"),
        });
      }
      if (
        url.pathname.endsWith("/contents/CLAUDE.md") ||
        url.pathname.endsWith("/contents/.github%2Fcopilot-instructions.md")
      ) {
        return new Response("missing", { status: 404 });
      }
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              pullRequest: { reviewThreads: { nodes: [] } },
            },
          },
        });
      }
      if (url.hostname === "opencode.ai" && url.pathname.endsWith("/models")) {
        return json({
          data: [
            { id: "big-pickle" },
            { id: "nemotron-3-ultra-free" },
            { id: "deepseek-v4-flash-free" },
          ],
        });
      }
      if (url.pathname.endsWith("/chat/completions")) {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          provider?: { allow_fallbacks?: boolean };
        };
        if (url.hostname === "openrouter.ai") {
          expect(body.provider?.allow_fallbacks).toBe(true);
        }
        const isMerger = body.model === "anthropic/claude-sonnet-4.6";
        const content = isMerger
          ? {
              summary: "One concrete issue.",
              findings: [
                {
                  severity: "high",
                  file: "app.ts",
                  line: 1,
                  title: "Incorrect return value",
                  evidence: "The changed return value violates the contract.",
                  recommendation: "Restore the expected value.",
                  confidence: 0.9,
                  source_models: ["moonshotai/kimi-k2.6"],
                  status: "open",
                  resolution_note: "",
                },
              ],
            }
          : {
              findings:
                body.model === "moonshotai/kimi-k2.6"
                  ? [
                      {
                        severity: "high",
                        file: "app.ts",
                        line: 1,
                        title: "Incorrect return value",
                        evidence:
                          "The changed return value violates the contract.",
                        recommendation: "Restore the expected value.",
                        confidence: 0.9,
                      },
                    ]
                  : [],
            };
        return json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(content) },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            prompt_tokens_details: { cached_tokens: 10 },
            cost: isMerger ? 0.02 : 0.01,
          },
        });
      }
      if (url.pathname.endsWith("/issues/42/comments") && init?.method === "GET") {
        return json([]);
      }
      if (url.pathname.endsWith("/issues/42/comments") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { body: string };
        publishedBodies.push(body.body);
        return json({ id: 987 });
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const put = vi.fn();
    const env = environment(put);
    const prepared = await prepareReview(env, params);
    const scouts = await runScouts(env, params, prepared);
    const merged = await mergeFindings(env, params, prepared, scouts);
    const publication = await publishReview(
      env,
      params,
      prepared,
      scouts,
      merged,
      { runs: 0, total_usd: 0 },
    );
    await recordReview({
      env,
      params,
      instanceId: "review-delivery-1",
      prepared,
      scouts,
      merged,
      publication,
      timestamp: new Date("2026-07-28T12:00:00Z"),
    });

    expect(scouts.models).toEqual([
      "moonshotai/kimi-k2.6",
      "deepseek/deepseek-v4-pro",
      "big-pickle",
      "nemotron-3-ultra-free",
    ]);
    expect(merged.result.findings).toHaveLength(1);
    expect(publication).toEqual({ commentId: 987, runCostUsd: 0.06 });
    expect(publishedBodies[0]).toContain(STATEFUL_REVIEW_MARKER);
    expect(publishedBodies[0]).toContain("## Stateful AI code review");
    expect(publishedBodies[0]).toContain("Reported by: `moonshotai/kimi-k2.6`");
    expect(put).toHaveBeenCalledOnce();
    const record = JSON.parse(String(put.mock.calls[0]?.[1])) as {
      status: string;
      models: Array<{
        provider: string;
        usage?: { cachedInputTokens: number };
      }>;
    };
    expect(record.status).toBe("published");
    expect(record.models.map(({ provider }) => provider)).toContain("opencode");
    expect(record.models.at(-1)?.usage?.cachedInputTokens).toBe(10);
  });
});
