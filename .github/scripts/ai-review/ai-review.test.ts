import assert from "node:assert/strict";
import test from "node:test";

import { ignored, markdownText, renderComment, validateFindings } from "./ai-review.ts";

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

test("model text cannot inject HTML, mentions, or markdown links", () => {
  const output = markdownText("<script>@owner [click](https://example.com)</script>");
  assert.doesNotMatch(output, /<script>|@owner|\[click\]\(/);
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
    modelCosts: { "model-a": 0.1 },
    mergerCost: 0.15,
    omitted: [],
    runCost: 0.25,
    previousState: { runs: 1, total_usd: 0.5 },
  });
  assert.match(body, /Reported by: `model-a`/);
  assert.match(body, /&lt;details&gt;/);
  assert.match(body, /<!-- ai-review-cost:{"runs":2,"total_usd":0.75,"models":/);
  assert.match(body, /\| model-a \| 1 \| 1 \| 1 \| 0 \| 0 \| \$0.1000 \|/);
});
