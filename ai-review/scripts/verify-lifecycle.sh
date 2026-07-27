#!/usr/bin/env bash
set -euo pipefail

lifecycle_output="$(
  pnpm exec wrangler r2 bucket lifecycle list ai-review-data
)"

required_fragments=(
  "name:     expire-review-records"
  "action:   Expire objects after 365 days"
  "Abort incomplete multipart uploads after 7 days"
)

for fragment in "${required_fragments[@]}"; do
  if ! grep -Fq -- "$fragment" <<<"$lifecycle_output"; then
    echo "AI review R2 lifecycle policy is missing: $fragment" >&2
    exit 1
  fi
done

echo "AI review R2 lifecycle policy is configured."
