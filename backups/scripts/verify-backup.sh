#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: AGE_IDENTITY_FILE=/path/to/key.txt $0 <backup.dump.age>" >&2
  exit 1
fi

if [ -z "${AGE_IDENTITY_FILE:-}" ]; then
  echo "Missing required environment variable: AGE_IDENTITY_FILE" >&2
  exit 1
fi

encrypted_backup="$1"
postgres_image="postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193"

age \
  --decrypt \
  --identity "$AGE_IDENTITY_FILE" \
  "$encrypted_backup" \
| docker run --rm --interactive "$postgres_image" pg_restore --list >/dev/null

echo "Encryption and PostgreSQL archive structure verified: $encrypted_backup"
