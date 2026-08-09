#!/usr/bin/env bash
set -euo pipefail

BASE_REVISION="${1:?Pass the base Git revision to compare against}"
SPEC_PATH="workers/recipe-api/openapi.json"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CURRENT_SPEC="${SCRIPT_DIR}/../openapi.json"

if ! git cat-file -e "${BASE_REVISION}:${SPEC_PATH}" 2>/dev/null; then
  echo "No OpenAPI contract exists at ${BASE_REVISION}; skipping the initial baseline diff."
  exit 0
fi

BASE_SPEC=$(mktemp "${TMPDIR:-/tmp}/recipe-api-openapi-base.XXXXXX.json")
trap 'rm -f "$BASE_SPEC"' EXIT
git show "${BASE_REVISION}:${SPEC_PATH}" > "$BASE_SPEC"

oasdiff breaking --fail-on ERR "$BASE_SPEC" "$CURRENT_SPEC"
