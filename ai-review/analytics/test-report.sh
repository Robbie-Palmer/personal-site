#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

marts="$work/marts"
"$here/build-scorecard.sh" "$here/fixtures" "$marts"

report="$work/report"
report_repeat="$work/report-repeat"
report_mixed="$work/report-mixed"
report_json_only="$work/report-json-only"

run_report() {
  (cd "$here/.." && pnpm exec tsx analytics/report.ts "$@")
}

run_report --marts "$marts/v1" --output "$report"
run_report --marts "$marts/v1" --output "$report_repeat"
cmp "$report/scorecard-report.json" "$report_repeat/scorecard-report.json"
cmp "$report/scorecard-report.md" "$report_repeat/scorecard-report.md"
[[ -f "$report/scorecard-report.json" && -f "$report/scorecard-report.md" ]]

run_report --marts "$marts/v1" --output "$report_json_only" --format json
[[ -f "$report_json_only/scorecard-report.json" && ! -e "$report_json_only/scorecard-report.md" ]]

jq -e '
  .schemaVersion == 1 and
  .reportType == "ai-review-scorecard-report" and
  .source.recordSchemaVersions == [1, 2] and
  .sampleSizes == {
    reviewRuns: 3, pullRequests: 2, modelCalls: 2,
    publishedFindings: 4, adjudicatedFindings: 2, legacyPublishedFindings: 1
  } and
  .censoredOutcomes == {superseded: 1, incompleteOutcomes: 1, legacyFindingsWithoutIdentity: 1} and
  .metrics.acceptanceRate.value == 0.5 and
  .metrics.acceptanceRate.sampleSize == 2 and
  .metrics.fixThroughRate.value == 0.25 and
  .metrics.noiseRate.value == 0.25 and
  .metrics.noResponseShare.value == 0.25 and
  .metrics.costPerAcceptedFindingUsd.value == 0.31 and
  .metrics.tokenEfficiency.acceptedFindingsPerMillionUncachedTokens.value == 1250 and
  .metrics.tokenEfficiency.cacheHitRate.value == 0.2 and
  .metrics.reviewEfficiency.modelCallsPerPullRequest.value == 1 and
  .metrics.reviewEfficiency.uncachedInputTokensPerPullRequest.value == 800 and
  .metrics.reviewEfficiency.baseline == null and
  .metrics.timeToUsefulFinding.basis == "first-review-trigger" and
  .metrics.timeToUsefulFinding.medianMs.value == 86400000 and
  .metrics.timeToUsefulFinding.pullRequestsWithAcceptedFinding == 1 and
  .compatibility.uniformByDefault == true and
  (.modelComparison.entries | length == 3) and
  (.modelComparison.entries[0] | .model == "model-a" and .promptVersion == "prompt-1" and
    .publicationPolicyVersion == null and .outcomeAttribution == "unavailable") and
  (.modelComparison.entries[1] | .model == "model-a" and .role == "scout" and .promptVersion == "prompt-2" and
    .publicationPolicyVersion == "deterministic-publication-v1" and .outcomeAttribution == "available" and
    .metrics.acceptanceRate.value == 0.5) and
  (.modelComparison.entries[2] | .model == "model-a" and .promptVersion == "prompt-3" and
    .publicationPolicyVersion == "deterministic-publication-v1" and
    .sampleSizes.publishedFindings == 1) and
  (.modelComparison.mixedCompatibilityEntries | length == 0) and
  ([.slices[].dimension] | sort == ["change-size", "model", "originating-agent", "prompt", "repository-area", "risk", "task-type"])
' "$report/scorecard-report.json" > /dev/null

task_slice=$(jq -c '.slices[] | select(.dimension == "task-type")' "$report/scorecard-report.json")
echo "$task_slice" | jq -e '.values[0] | .key == "bug" and .sampleSizes.reviewRuns == 1 and .metrics.acceptanceRate.value == 0.5' > /dev/null
echo "$task_slice" | jq -e '.values[1] | .key == "(unknown)" and .sampleSizes.reviewRuns == 2 and .sampleSizes.legacyPublishedFindings == 1' > /dev/null

model_slice=$(jq -c '.slices[] | select(.dimension == "model")' "$report/scorecard-report.json")
echo "$model_slice" | jq -e '.values[0].mixedCompatibility == true and .values[0].metrics == null' > /dev/null

run_report --marts "$marts/v1" --output "$report_mixed" --allow-mixed-compatibility
jq -e '
  .compatibility.mixedCompatibilityAllowed == true and
  ([.slices[] | select(.dimension == "model")][0].values[0] |
    .metrics != null and .mixedCompatibility == true) and
  (.modelComparison.mixedCompatibilityEntries | length == 1) and
  (.modelComparison.mixedCompatibilityEntries[0] | .model == "model-a" and
    .sampleSizes.publishedFindings == 4)
' "$report_mixed/scorecard-report.json" > /dev/null
grep -q "Mixed-compatibility aggregates (opt-in)" "$report_mixed/scorecard-report.md"

capped="$work/report-capped"
run_report --marts "$marts/v1" --output "$capped" --min-sample-size 3
jq -e '
  .metrics.acceptanceRate.value == null and .metrics.acceptanceRate.insufficientSampleSize == true and
  .metrics.acceptanceRate.sampleSize == 2 and
  .metrics.fixThroughRate.value == 0.25 and .metrics.fixThroughRate.sampleSize == 4 and
  .metrics.reviewEfficiency.modelCallsPerPullRequest.value == null
' "$capped/scorecard-report.json" > /dev/null

baseline_file="$work/baseline.json"
cat > "$baseline_file" <<'JSON'
{"modelCallsPerPullRequest": 4, "uncachedInputTokensPerPullRequest": 3200}
JSON
baseline_out="$work/report-baseline"
run_report --marts "$marts/v1" --output "$baseline_out" --baseline "$baseline_file"
jq -e '
  .metrics.reviewEfficiency.baseline.modelCallsPerPullRequest.value == 4 and
  .metrics.reviewEfficiency.baseline.modelCallsPerPullRequest.ratio == 0.25 and
  .metrics.reviewEfficiency.baseline.uncachedInputTokensPerPullRequest.ratio == 0.25
' "$baseline_out/scorecard-report.json" > /dev/null

baseline_capped="$work/report-baseline-capped"
run_report --marts "$marts/v1" --output "$baseline_capped" --baseline "$baseline_file" --min-sample-size 3
jq -e '.metrics.reviewEfficiency.baseline == null' "$baseline_capped/scorecard-report.json" > /dev/null

if run_report --marts "$work/does-not-exist" --output "$work/never" >"$work/error.log" 2>&1; then
  echo "missing marts directory was not rejected" >&2
  exit 1
fi
grep -q "marts directory not found" "$work/error.log"

echo "Scorecard report fixture tests passed"
