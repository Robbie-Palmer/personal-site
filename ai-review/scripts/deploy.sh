#!/usr/bin/env bash
set -euo pipefail
umask 077

if (($# > 0)); then
  echo "AI review deploy does not accept passthrough arguments." >&2
  exit 1
fi

required_values=(
  AI_REVIEW_APP_ID
  AI_REVIEW_APP_INSTALLATION_ID
  AI_REVIEW_APP_PRIVATE_KEY
  AI_REVIEW_WEBHOOK_SECRET
  OPENROUTER_API_KEY
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
)

missing_values=()
for name in "${required_values[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing_values+=("$name")
  fi
done

if ((${#missing_values[@]} > 0)); then
  if [[ "${CI:-}" == "true" || "${AI_REVIEW_DOPPLER_WRAPPED:-}" == "1" ]]; then
    echo "Cannot deploy AI review: missing required values: ${missing_values[*]}" >&2
    exit 1
  fi
  if ! command -v doppler >/dev/null 2>&1; then
    echo "Cannot deploy AI review: required values are missing and Doppler is unavailable." >&2
    exit 1
  fi

  export AI_REVIEW_DOPPLER_WRAPPED=1
  exec doppler run \
    --project "${AI_REVIEW_DOPPLER_PROJECT:-ai-review}" \
    --config "${AI_REVIEW_DOPPLER_CONFIG:-prd}" \
    --preserve-env=AI_REVIEW_DOPPLER_WRAPPED \
    -- bash "$0"
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Cannot deploy AI review: jq is required to construct the Worker secrets payload." >&2
  exit 1
fi

secrets_root="${TMPDIR:-/tmp}"
if [[ -d /dev/shm && -w /dev/shm ]]; then
  secrets_root="/dev/shm"
fi
secrets_dir="$(mktemp -d "${secrets_root%/}/ai-review-secrets.XXXXXX")"
secrets_file="${secrets_dir}/worker-secrets.json"
chmod 700 "$secrets_dir"

cleanup() {
  if [[ -f "$secrets_file" ]]; then
    unlink "$secrets_file"
  fi
  rmdir "$secrets_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

jq -n '
  env
  | {
      AI_REVIEW_APP_ID,
      AI_REVIEW_APP_INSTALLATION_ID,
      AI_REVIEW_APP_PRIVATE_KEY,
      AI_REVIEW_WEBHOOK_SECRET,
      OPENROUTER_API_KEY
    }
  | if env.OPENCODE_API_KEY // "" | length > 0
    then . + {OPENCODE_API_KEY: env.OPENCODE_API_KEY}
    else .
    end
' > "$secrets_file"
chmod 600 "$secrets_file"

pnpm exec wrangler deploy --secrets-file "$secrets_file"
