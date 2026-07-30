import assert from "node:assert/strict";
import test from "node:test";

import {
  completionContent,
  duplicateScoutModels,
  ignored,
  isCreditExhaustion,
  markdownText,
  parseModelPayload,
  renderComment,
  Reviewer,
  selectFreeScoutModels,
  validateFindings,
  workflowStatusForCoverage,
} from "./ai-review.ts";

const finding = {
  severity: "high",
  file: "app.ts",
  line: 3,
  title: "Bug",
  evidence: "Evidence",
  recommendation: "Fix it",
  confidence: 0.8,
};

test("ignore patterns match paths and basenames", () => {
  assert.equal(ignored("pnpm-lock.yaml"), true);
  assert.equal(ignored("ml-pipelines/wsi-analysis/uv.lock"), true);
  assert.equal(ignored("workers/api/.terraform.lock.hcl"), true);
  assert.equal(ignored("flake.lock"), true);
  assert.equal(ignored("ui/public/image.png"), true);
  assert.equal(ignored("ui/public/font.WOFF2"), true);
  assert.equal(ignored("models/checkpoint.safetensors"), true);
  assert.equal(ignored("artifacts/results.parquet"), true);
  assert.equal(ignored("ui/node_modules/a.js"), true);
  assert.equal(ignored("dist/server.js"), true);
  assert.equal(ignored("ui/.next/server/app.js"), true);
  assert.equal(ignored("generated/client.generated.ts"), true);
  assert.equal(ignored(".env.production"), true);
  assert.equal(ignored("ui/components/card.tsx"), false);
  assert.equal(ignored("workers/recipe-api/src/db/schema.ts"), false);
});

test("finding validation rejects incomplete and out-of-diff findings", () => {
  const valid = validateFindings({ findings: [{ ...finding, confidence: 4 }, { severity: "low" }] }, { merged: false });
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.confidence, 1);
  assert.deepEqual(
    validateFindings({ findings: [finding] }, { merged: false, allowedFiles: new Set(["other.ts"]) }),
    [],
  );
});

test("finding validation enforces confidence bounds at runtime", () => {
  assert.equal(validateFindings({ findings: [{ ...finding, confidence: -2 }] }, { merged: false })[0]?.confidence, 0);
  assert.equal(validateFindings({ findings: [{ ...finding, confidence: 4 }] }, { merged: false })[0]?.confidence, 1);
});

test("completion accepts a null finish reason but rejects truncation", () => {
  assert.equal(completionContent({ finish_reason: null, message: { content: "{}" } }, "model"), "{}");
  assert.throws(
    () => completionContent({ finish_reason: "length", message: { content: "{}" } }, "model"),
    /stopped with length/,
  );
});

test("credit exhaustion only matches payment and key-limit failures", () => {
  assert.equal(
    isCreditExhaustion(
      new Error(
        'POST /chat/completions failed (403): {"error":{"message":"Key limit exceeded (monthly limit)"}}',
      ),
    ),
    true,
  );
  assert.equal(
    isCreditExhaustion(
      new Error('POST /chat/completions failed (402): {"error":{"message":"Insufficient credits"}}'),
    ),
    true,
  );
  assert.equal(
    isCreditExhaustion(
      new Error('POST /chat/completions failed (403): {"error":{"message":"Guardrail blocked request"}}'),
    ),
    false,
  );
  assert.equal(isCreditExhaustion(new Error("All scout models failed")), false);
});

test("OpenCode model discovery keeps live supplementary scouts and excludes failed ones", () => {
  assert.deepEqual(
    selectFreeScoutModels({
      data: [
        { id: "paid-model" },
        { id: "deepseek-v4-flash-free" },
        { id: "big-pickle" },
        { id: "deepseek-v4-flash-free" },
        { id: "mimo-v2.5-free" },
        { id: "nemotron-3-ultra-free" },
        { id: "laguna-s-2.1-free" },
        { id: "ling-3.0-flash-free" },
        { id: "north-mini-code-free" },
      ],
    }),
    ["big-pickle", "nemotron-3-ultra-free"],
  );
  assert.deepEqual(selectFreeScoutModels({ data: [] }), []);
  assert.throws(() => selectFreeScoutModels({ models: [] }), /no data array/);
});

test("paid OpenRouter completions are never retried by the HTTP client", async (context) => {
  let attempts = 0;
  context.mock.method(globalThis, "fetch", async () => {
    attempts += 1;
    return new Response("temporary upstream failure", { status: 503 });
  });
  const reviewer = new Reviewer({
    githubToken: "github-token",
    openRouterKey: "openrouter-key",
    repository: "Robbie-Palmer/personal-site",
    prNumber: 837,
    openRouterScouts: ["model-a"],
    openCodeScouts: [],
    merger: "model-b",
    ignoredAuthors: [],
    requireZdr: false,
  });

  await assert.rejects(
    reviewer.callOpenRouterScout("model-a", "system", "user"),
    /failed \(503\)/,
  );
  assert.equal(attempts, 1);
});

test("default OpenRouter scouts enforce their model-specific price ceiling", async (context) => {
  context.mock.method(globalThis, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      provider?: { max_price?: { prompt?: number; completion?: number } };
    };
    assert.deepEqual(body.provider?.max_price, { prompt: 0.7, completion: 2.2 });
    return Response.json({
      choices: [{ finish_reason: "stop", message: { content: '{"findings":[]}' } }],
      usage: { cost: 0 },
    });
  });
  const reviewer = new Reviewer({
    githubToken: "github-token",
    openRouterKey: "openrouter-key",
    repository: "Robbie-Palmer/personal-site",
    prNumber: 837,
    openRouterScouts: ["z-ai/glm-5.2"],
    openCodeScouts: [],
    merger: "model-b",
    ignoredAuthors: [],
    requireZdr: false,
  });

  await reviewer.callOpenRouterScout("z-ai/glm-5.2", "system", "user");
});

test("duplicate scout model IDs are detected across providers", () => {
  assert.deepEqual(
    duplicateScoutModels(["provider/model-a", "big-pickle"], ["big-pickle", "free-model"]),
    ["big-pickle"],
  );
  assert.deepEqual(duplicateScoutModels(["provider/model-a"], ["free-model"]), []);
});

test("workflow skips its stable check when no scout provides coverage", () => {
  assert.equal(workflowStatusForCoverage(0), "no_coverage");
  assert.equal(workflowStatusForCoverage(1), "success");
});

test("model payload accepts a single JSON fence but rejects prose", () => {
  assert.deepEqual(parseModelPayload('```json\n{"findings":[]}\n```'), { findings: [] });
  assert.deepEqual(parseModelPayload('```json\n{"findings":[]}```'), { findings: [] });
  assert.deepEqual(parseModelPayload('{"findings":[]}'), { findings: [] });
  assert.throws(() => parseModelPayload("```json\n```"));
  assert.throws(() => parseModelPayload('Result: {"findings":[]}'), /Unexpected token|Unexpected character/);
});

test("model text cannot inject HTML, mentions, or markdown links", () => {
  const output = markdownText("<SCRIPT>@owner [click](https://example.com)</SCRIPT>");
  assert.doesNotMatch(output, /<script>|@owner|\[click\]\(/i);
});

test("rendered comment preserves provenance and cumulative cost", () => {
  const body = renderComment({
    result: {
      summary: "Summary",
      findings: [
        {
          ...finding,
          title: "<details>Injected</details>",
          source_models: ["model-a"],
          status: "open",
          resolution_note: "",
        },
      ],
    },
    headSha: "a".repeat(40),
    models: ["model-a"],
    merger: "model-b",
    failed: [],
    candidateCounts: { "model-a": 1 },
    invalidCounts: {},
    outOfScopeCounts: {},
    modelCosts: { "model-a": 0.1 },
    mergerCost: 0.15,
    omitted: [],
    runCost: 0.25,
    previousState: { runs: 1, total_usd: 0.5 },
  });
  assert.match(body, /Reported by: `model-a`/);
  assert.match(body, /&lt;details&gt;/);
  assert.match(body, /<!-- ai-review-cost:{"runs":2,"total_usd":0.75,"models":/);
  assert.match(body, /\| model-a \| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \| \$0.1000 \|/);
});

test("historical scorecard schema drift cannot produce NaN", () => {
  const body = renderComment({
    result: { summary: "Summary", findings: [] },
    headSha: "a".repeat(40),
    models: ["model-a"],
    merger: "model-b",
    failed: [],
    candidateCounts: { "model-a": 0 },
    invalidCounts: {},
    outOfScopeCounts: {},
    modelCosts: {},
    mergerCost: 0,
    omitted: [],
    runCost: 0,
    previousState: {
      runs: 1,
      total_usd: 0.5,
      models: { "model-a": {} as never },
    },
  });
  assert.doesNotMatch(body, /NaN/);
});

test("rendered comment makes total scout failure explicit", () => {
  const body = renderComment({
    result: { summary: "No coverage", findings: [] },
    headSha: "a".repeat(40),
    models: ["free-a", "free-b"],
    merger: "paid-merger",
    failed: ["free-a", "free-b"],
    candidateCounts: {},
    invalidCounts: {},
    outOfScopeCounts: {},
    modelCosts: {},
    mergerCost: 0,
    omitted: [],
    runCost: 0,
    previousState: { runs: 0, total_usd: 0 },
  });
  assert.match(body, /No findings were evaluated because every scout failed/);
  assert.doesNotMatch(body, /No open findings reported/);
});
