import assert from "node:assert/strict";
import test from "node:test";

import {
  completionContent,
  ignored,
  markdownText,
  parseModelPayload,
  renderComment,
  validateFindings,
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
