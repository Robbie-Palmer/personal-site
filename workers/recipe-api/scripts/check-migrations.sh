#!/usr/bin/env bash
set -euo pipefail

# `drizzle-kit check` validates migration history consistency. Generating once
# more catches schema.ts changes whose migration and snapshot were not checked
# in; a developer can review and keep the generated migration after this fails.
pnpm exec drizzle-kit check

before=$(git status --porcelain --untracked-files=all -- drizzle)
pnpm exec drizzle-kit generate --name uncommitted_schema_change
after=$(git status --porcelain --untracked-files=all -- drizzle)

if [[ "$before" != "$after" ]]; then
  echo "Schema changes are missing a committed Drizzle migration." >&2
  echo "Review the generated migration, rename it if useful, and commit it." >&2
  exit 1
fi

pnpm exec tsx scripts/check-migration-manifest.ts
