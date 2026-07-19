#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${AWS_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID:-}}" || -z "${AWS_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY:-}}" ]]; then
  if [[ "${RECIPE_DATASET_DOPPLER_INJECTED:-}" == "1" ]]; then
    echo "Cannot push recipe dataset: dev_personal does not provide both R2 credentials." >&2
    exit 1
  fi
  if ! command -v doppler >/dev/null 2>&1; then
    echo "Cannot push recipe dataset: Doppler is required when R2 credentials are not already set." >&2
    exit 1
  fi
  export RECIPE_DATASET_DOPPLER_INJECTED=1
  exec doppler run --project personal-site --config dev_personal -- bash "$0"
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY}}"

if [[ -x .venv/bin/dvc ]]; then
  exec .venv/bin/dvc push
fi
exec dvc push
