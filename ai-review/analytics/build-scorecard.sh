#!/usr/bin/env bash
set -euo pipefail

INPUT_PREFIX="${AI_REVIEW_SCORECARD_INPUT:-${1:-}}"
OUTPUT_ROOT="${AI_REVIEW_SCORECARD_OUTPUT:-${2:-}}"
MART_VERSION="v1"

if [[ -z "$INPUT_PREFIX" || -z "$OUTPUT_ROOT" ]]; then
  echo "usage: AI_REVIEW_SCORECARD_INPUT=<directory> AI_REVIEW_SCORECARD_OUTPUT=<directory> $0" >&2
  exit 2
fi
if ! command -v duckdb >/dev/null 2>&1; then
  echo "duckdb is required (run through mise)" >&2
  exit 2
fi

input_files=()
while IFS= read -r file; do input_files+=("$file"); done < <(find "$INPUT_PREFIX" -type f -name '*.json' -print | LC_ALL=C sort)
if [[ ${#input_files[@]} -eq 0 ]]; then
  echo "no JSON objects found under $INPUT_PREFIX" >&2
  exit 1
fi

sql_list=""
for file in "${input_files[@]}"; do
  escaped=${file//\'/\'\'}
  [[ -n "$sql_list" ]] && sql_list+=","
  sql_list+="'$escaped'"
done

target="$OUTPUT_ROOT/$MART_VERSION"
mkdir -p "$target"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

sed "s|__INPUT_FILES__|$sql_list|" "$(dirname "$0")/scorecard.sql" > "$work/build.sql"
duckdb "$work/scorecard.duckdb" < "$work/build.sql" >/dev/null

for mart in finding_latest review_run_fact model_run_fact pull_request_fact; do
  duckdb "$work/scorecard.duckdb" \
    "COPY (SELECT * FROM $mart ORDER BY ALL) TO '$work/$mart.parquet' (FORMAT PARQUET, COMPRESSION uncompressed);"
done

# Replace outputs only after every validation and materialization succeeds.
for mart in finding_latest review_run_fact model_run_fact pull_request_fact; do
  mv "$work/$mart.parquet" "$target/$mart.parquet"
done

manifest_tmp="$work/manifest.json"
{
  printf '{\n  "schemaVersion": 1,\n  "martVersion": "%s",\n  "inputPrefix": "%s",\n  "marts": {\n' "$MART_VERSION" "$INPUT_PREFIX"
  for i in 0 1 2 3; do
    marts=(finding_latest review_run_fact model_run_fact pull_request_fact)
    mart=${marts[$i]}
    checksum=$(shasum -a 256 "$target/$mart.parquet" | awk '{print $1}')
    rows=$(duckdb -csv -noheader -c "SELECT count(*) FROM read_parquet('$target/$mart.parquet')")
    printf '    "%s": {"path": "%s.parquet", "rows": %s, "sha256": "%s"}' "$mart" "$mart" "$rows" "$checksum"
    [[ $i -lt 3 ]] && printf ','
    printf '\n'
  done
  printf '  }\n}\n'
} > "$manifest_tmp"
mv "$manifest_tmp" "$target/scorecard-manifest.json"
echo "Built scorecard marts in $target"
