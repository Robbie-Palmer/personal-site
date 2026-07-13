#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: AGE_IDENTITY_FILE=/path/to/key.txt $0 <backup.dump.age> <output.dump>" >&2
  exit 1
fi

if [ -z "${AGE_IDENTITY_FILE:-}" ]; then
  echo "Missing required environment variable: AGE_IDENTITY_FILE" >&2
  exit 1
fi

encrypted_backup="$1"
output_dump="$2"

if [ -e "$output_dump" ]; then
  echo "Refusing to overwrite existing output: $output_dump" >&2
  exit 1
fi

age \
  --decrypt \
  --identity "$AGE_IDENTITY_FILE" \
  --output "$output_dump" \
  "$encrypted_backup"

echo "Decrypted PostgreSQL archive: $output_dump"
