#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:-}" ]] &&
  [[ -n "${DATABASE_URL:-}" ]]; then
  export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL"
fi

# Run alongside recipe-api so its cross-script workflow binding resolves:
#   wrangler dev -c wrangler.toml -c ../recipe-api/wrangler.toml
exec wrangler dev "$@"
