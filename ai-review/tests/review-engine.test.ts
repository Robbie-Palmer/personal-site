import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";
import {
  STATEFUL_REVIEW_MARKER,
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
    await recordReview(
      env,
      params,
      "review-delivery-1",
      prepared,
      scouts,
      merged,
      publication,
      new Date("2026-07-28T12:00:00Z"),
    );

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
