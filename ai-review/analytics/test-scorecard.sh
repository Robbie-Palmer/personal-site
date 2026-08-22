#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
output=$(mktemp -d)
second=$(mktemp -d)
bad=$(mktemp -d)
special=$(mktemp -d)
duplicate=$(mktemp -d)
concurrent=$(mktemp -d)
invalid_outcome=$(mktemp -d)
trap 'rm -rf "$output" "$second" "$bad" "$special" "$duplicate" "$concurrent" "$invalid_outcome"' EXIT

"$here/build-scorecard.sh" "$here/fixtures" "$output"
"$here/build-scorecard.sh" "$here/fixtures" "$second"
"$here/build-scorecard.sh" "$here/fixtures" "$output"

[[ -L "$output/v1" ]]

for file in finding_latest.parquet review_run_fact.parquet model_run_fact.parquet pull_request_fact.parquet scorecard-manifest.json; do
  cmp "$output/v1/$file" "$second/v1/$file"
done

duckdb -csv -noheader <<SQL | diff -u - <(printf '0.5,0.3333333333333333,0.3333333333333333,0.3,0.75\n')
SELECT acceptance_rate, fix_through_rate, noise_rate, cost_per_accepted_finding, coverage_rate
FROM read_parquet('$output/v1/review_run_fact.parquet') WHERE run_id = 'run-1';
SQL

duckdb -csv -noheader <<SQL | diff -u - <(printf 'published,1\n')
SELECT status, count(*)
FROM read_parquet('$output/v1/review_run_fact.parquet')
WHERE run_id = 'run-1'
GROUP BY status;
SQL

duckdb -csv -noheader <<SQL | diff -u - <(printf '3.0,3\n')
SELECT published_finding_count, count(*)
FROM read_parquet('$output/v1/finding_latest.parquet')
CROSS JOIN read_parquet('$output/v1/pull_request_fact.parquet')
GROUP BY published_finding_count;
SQL

duckdb -csv -noheader <<SQL | diff -u - <(printf '2,true,true,1,1\n')
SELECT array_length(prompt_versions), list_contains(prompt_versions, 'prompt-2'),
       list_contains(prompt_versions, 'prompt-3'), array_length(task_types),
       array_length(originating_agents)
FROM read_parquet('$output/v1/pull_request_fact.parquet');
SQL

"$here/build-scorecard.sh" "$here/fixtures" "$concurrent/output" >"$concurrent/first.log" 2>&1 &
first_pid=$!
"$here/build-scorecard.sh" "$here/fixtures" "$concurrent/output" >"$concurrent/second.log" 2>&1 &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
[[ $(find "$concurrent/output/.scorecard-releases" -mindepth 1 -maxdepth 1 -type d | wc -l) -eq 1 ]]
if find "$concurrent/output/.scorecard-releases" -mindepth 2 -maxdepth 2 -type d -name v1 | grep -q .; then
  echo "concurrent builder nested a release inside the winning release" >&2
  exit 1
fi

special_input="$special/"$'input\'\'&pipe|"\\\nline'
mkdir "$special_input"
cp -R "$here/fixtures/." "$special_input/"
"$here/build-scorecard.sh" "$special_input" "$special/output" >/dev/null
jq -e . "$special/output/v1/scorecard-manifest.json" >/dev/null

cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$bad/good.json"
printf '{"schemaVersion":99,"recordType":"review-run-terminal"}\n' > "$bad/unknown.json"
if schema_error=$("$here/build-scorecard.sh" "$bad" "$bad/output" 2>&1); then
  echo "unknown schema version was not rejected" >&2
  exit 1
fi
if [[ "$schema_error" != *"Unknown schema version"* ]]; then
  echo "unknown schema version failed for the wrong reason: $schema_error" >&2
  exit 1
fi

mkdir -p "$duplicate/a" "$duplicate/b"
cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$duplicate/a/published.json"
cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$duplicate/b/published.json"
if duplicate_error=$("$here/build-scorecard.sh" "$duplicate" "$duplicate/output" 2>&1); then
  echo "duplicate terminal status was not rejected" >&2
  exit 1
fi
if [[ "$duplicate_error" != *"conflicting or duplicate terminal records"* ]]; then
  echo "duplicate terminal status failed for the wrong reason: $duplicate_error" >&2
  exit 1
fi

mkdir -p "$invalid_outcome/null" "$invalid_outcome/unknown" "$invalid_outcome/basis-mismatch"
cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$invalid_outcome/null/published.json"
cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$invalid_outcome/unknown/published.json"
cp "$here/fixtures/v2/acme/widgets/pr-7/head-1/run-1/published.json" "$invalid_outcome/basis-mismatch/published.json"
jq '.outcome = null' "$here/fixtures/v2/acme/widgets/pr-7/findings/f_fixed/outcomes/v1.json" > "$invalid_outcome/null/outcome.json"
jq '.outcome = "invented"' "$here/fixtures/v2/acme/widgets/pr-7/findings/f_fixed/outcomes/v1.json" > "$invalid_outcome/unknown/outcome.json"
jq '.outcome = "superseded" | .outcomeKind = "censored" | .basis = "outcome-window"' "$here/fixtures/v2/acme/widgets/pr-7/findings/f_fixed/outcomes/v1.json" > "$invalid_outcome/basis-mismatch/outcome.json"
for invalid in null unknown basis-mismatch; do
  if outcome_error=$("$here/build-scorecard.sh" "$invalid_outcome/$invalid" "$invalid_outcome/$invalid-output" 2>&1); then
    echo "$invalid outcome was not rejected" >&2
    exit 1
  fi
  if [[ "$outcome_error" != *"Outcome revisions have missing or invalid required fields"* ]]; then
    echo "$invalid outcome failed for the wrong reason: $outcome_error" >&2
    exit 1
  fi
done

echo "Scorecard fixture tests passed"
