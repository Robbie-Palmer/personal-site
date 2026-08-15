#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
output=$(mktemp -d)
second=$(mktemp -d)
bad=$(mktemp -d)
special=$(mktemp -d)
trap 'rm -rf "$output" "$second" "$bad" "$special"' EXIT

"$here/build-scorecard.sh" "$here/fixtures" "$output"
"$here/build-scorecard.sh" "$here/fixtures" "$second"
"$here/build-scorecard.sh" "$here/fixtures" "$output"

test -L "$output/v1"

for file in finding_latest.parquet review_run_fact.parquet model_run_fact.parquet pull_request_fact.parquet scorecard-manifest.json; do
  cmp "$output/v1/$file" "$second/v1/$file"
done

duckdb -csv -noheader <<SQL | diff -u - <(printf '0.5,0.3333333333333333,0.3333333333333333,0.3,0.75\n')
SELECT acceptance_rate, fix_through_rate, noise_rate, cost_per_accepted_finding, coverage_rate
FROM read_parquet('$output/v1/review_run_fact.parquet') WHERE run_id = 'run-1';
SQL

duckdb -csv -noheader <<SQL | diff -u - <(printf '3.0,3\n')
SELECT published_finding_count, count(*)
FROM read_parquet('$output/v1/finding_latest.parquet')
CROSS JOIN read_parquet('$output/v1/pull_request_fact.parquet')
GROUP BY published_finding_count;
SQL

mkdir "$special/input''&pipe|"
cp -R "$here/fixtures/." "$special/input''&pipe|/"
"$here/build-scorecard.sh" "$special/input''&pipe|" "$special/output" >/dev/null

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

echo "Scorecard fixture tests passed"
