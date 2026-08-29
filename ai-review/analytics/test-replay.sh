#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

run_replay() {
  (cd "$here/.." && pnpm exec tsx analytics/replay.ts "$@")
}

executor="$work/executor.mjs"
cat > "$executor" <<'JS'
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  process.stdout.write(`${JSON.stringify({ costUsd: 0.04, findingCount: 2 })}\n`);
});
JS

failing_executor="$work/failing-executor.mjs"
cat > "$failing_executor" <<'JS'
process.exit(3);
JS

fixture_manifest="$here/fixtures/v2/acme/widgets/pr-7/replays/frozen-set-1.json"

plan_out="$work/plan"
run_replay --manifest "$fixture_manifest" --output "$plan_out" --executor "node $executor" --max-cost-usd 1 --models model-a
[[ -f "$plan_out/replay-plan.json" ]]
[[ ! -e "$plan_out/controlled-replay-result.json" ]]
jq -e '
  .schemaVersion == 1 and .recordType == "controlled-replay-plan" and
  .manifestId == "frozen-set-1" and .repository == "acme/widgets" and
  .frozen.pullRequests == [{pullRequestNumber: 7, headSha: "head-1", promptVersion: "prompt-2"}] and
  .execution.optIn == false
' "$plan_out/replay-plan.json" > /dev/null

if run_replay --manifest "$fixture_manifest" --output "$work/never" --yes >"$work/no-budget.log" 2>&1; then
  echo "execution without --max-cost-usd was not rejected" >&2
  exit 1
fi
if run_replay --manifest "$fixture_manifest" --output "$work/never" --yes --max-cost-usd 1 >"$work/no-models.log" 2>&1; then
  echo "execution without --models was not rejected" >&2
  exit 1
fi
if run_replay --manifest "$fixture_manifest" --output "$work/never" --yes --max-cost-usd 1 --models model-a >"$work/no-executor.log" 2>&1; then
  echo "execution without --executor was not rejected" >&2
  exit 1
fi
grep -q "must be a positive number" "$work/no-budget.log"
grep -q "\-\-models is required" "$work/no-models.log"
grep -q "\-\-executor is required" "$work/no-executor.log"

two_pr_manifest="$work/two-pr-manifest.json"
cat > "$two_pr_manifest" <<'JSON'
{
  "schemaVersion": 2,
  "recordType": "replay-manifest",
  "repository": "acme/widgets",
  "manifestId": "frozen-set-2",
  "createdAt": "2026-08-03T10:00:00Z",
  "pullRequests": [
    {"pullRequestNumber": 11, "headSha": "head-11", "promptVersion": "prompt-2"},
    {"pullRequestNumber": 12, "headSha": "head-12", "promptVersion": "prompt-2"}
  ]
}
JSON

result_out="$work/result"
run_replay --manifest "$two_pr_manifest" --output "$result_out" --yes --max-cost-usd 1 \
  --models model-a,model-b --executor "node $executor"
result_repeat="$work/result-repeat"
run_replay --manifest "$two_pr_manifest" --output "$result_repeat" --yes --max-cost-usd 1 \
  --models model-a,model-b --executor "node $executor"
cmp "$result_out/controlled-replay-result.json" "$result_repeat/controlled-replay-result.json"
cmp "$result_out/controlled-replay-result.md" "$result_repeat/controlled-replay-result.md"

jq -e '
  .recordType == "controlled-replay-result" and
  .manifestId == "frozen-set-2" and
  .frozen.models == ["model-a", "model-b"] and
  .budget == {capUsd: 1, spentUsd: 0.08, withinBudget: true} and
  .aborted == false and
  (.executions | length == 2) and
  (.executions[0] | .status == "executed" and .costUsd == 0.04 and
    .budgetRemainingUsd == 1 and .result.findingCount == 2) and
  (.executions[1] | .status == "executed" and .budgetRemainingUsd == 0.96)
' "$result_out/controlled-replay-result.json" > /dev/null
grep -q "within budget: true" "$result_out/controlled-replay-result.md"

exhausted_out="$work/exhausted"
three_pr_manifest="$work/three-pr-manifest.json"
jq '.manifestId = "frozen-set-3" | .pullRequests += [{pullRequestNumber: 13, headSha: "head-13", promptVersion: "prompt-2"}]' \
  "$two_pr_manifest" > "$three_pr_manifest"
if run_replay --manifest "$three_pr_manifest" --output "$exhausted_out" --yes --max-cost-usd 0.07 \
    --models model-a --executor "node $executor" >"$work/exhausted.log" 2>&1; then
  echo "budget breach did not fail the replay" >&2
  exit 1
fi
jq -e '
  .manifestId == "frozen-set-3" and
  .budget == {capUsd: 0.07, spentUsd: 0.08, withinBudget: false} and
  .aborted == true and .abortReason == "budget exceeded" and
  (.executions | length == 3) and
  (.executions[0] | .status == "executed") and
  (.executions[1] | .status == "executed" and .budgetRemainingUsd == 0.03) and
  (.executions[2] | .status == "skipped-budget-exhausted" and .costUsd == 0 and .result == null)
' "$exhausted_out/controlled-replay-result.json" > /dev/null

failed_out="$work/failed"
if run_replay --manifest "$two_pr_manifest" --output "$failed_out" --yes --max-cost-usd 1 \
    --models model-a --executor "node $failing_executor" >"$work/failed.log" 2>&1; then
  echo "failing executor was not reported" >&2
  exit 1
fi
jq -e '
  .aborted == true and
  (.executions | length == 1) and
  (.executions[0] | .status == "executor-failed" and .error != null and .result == null)
' "$failed_out/controlled-replay-result.json" > /dev/null

bad_manifest="$work/bad-manifest.json"
jq '.schemaVersion = 1' "$fixture_manifest" > "$bad_manifest"
if run_replay --manifest "$bad_manifest" --output "$work/never" >"$work/bad.log" 2>&1; then
  echo "invalid manifest schema version was not rejected" >&2
  exit 1
fi
grep -q "unsupported manifest schema version" "$work/bad.log"

duplicate_manifest="$work/duplicate-manifest.json"
jq '.pullRequests += [{pullRequestNumber: 7, headSha: "head-1", promptVersion: "prompt-2"}]' \
  "$fixture_manifest" > "$duplicate_manifest"
if run_replay --manifest "$duplicate_manifest" --output "$work/never" >"$work/duplicate.log" 2>&1; then
  echo "duplicate manifest pull request was not rejected" >&2
  exit 1
fi
grep -q "more than once" "$work/duplicate.log"

echo "Controlled replay fixture tests passed"
