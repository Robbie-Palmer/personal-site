#!/usr/bin/env bash
set -euo pipefail

output_file=$(mktemp)
trap 'rm -f "$output_file"' EXIT

# drizzle-kit 0.31 catches some push failures internally and exits zero. Keep
# the complete output visible while also checking for the swallowed error so a
# preview cannot deploy a Worker against an unchanged schema.
set +e
pnpm exec drizzle-kit push 2>&1 | tee "$output_file"
push_status=${PIPESTATUS[0]}
set -e

if (( push_status != 0 )); then
  exit "$push_status"
fi

if grep -q '^Error:' "$output_file"; then
  echo "Schema push reported an error despite exiting successfully." >&2
  exit 1
fi
