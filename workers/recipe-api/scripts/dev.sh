#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:-}" ] &&
  [ -n "${DATABASE_URL:-}" ]; then
  export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL"
fi

exec wrangler dev \
  --env-file .env.doppler \
  --var BETTER_AUTH_URL:http://localhost:3000 \
  "$@"
