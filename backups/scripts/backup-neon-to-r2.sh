#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"

  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env AGE_RECIPIENT
require_env CLOUDFLARE_ACCOUNT_ID
require_env NEON_DATABASE_URL_UNPOOLED
require_env R2_ACCESS_KEY_ID
require_env R2_DATABASE_BACKUPS_BUCKET_NAME
require_env R2_SECRET_ACCESS_KEY

require_command age
require_command aws
require_command docker
require_command sha256sum

if [[ "$NEON_DATABASE_URL_UNPOOLED" == *"-pooler."* ]]; then
  echo "NEON_DATABASE_URL_UNPOOLED points at a pooled Neon endpoint." >&2
  echo "Use the direct connection string for pg_dump." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_EC2_METADATA_DISABLED="true"
export PGAPPNAME="github-actions-database-backup"
export PGDATABASE="$NEON_DATABASE_URL_UNPOOLED"

endpoint="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
postgres_image="postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193"
timestamp=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
year=$(date -u +"%Y")
month=$(date -u +"%m")
day=$(date -u +"%d")
basename="recipes-${timestamp}.dump.age"
weekly_key="weekly/${year}/${month}/${basename}"

temp_dir=$(mktemp -d)
archive_path="${temp_dir}/${basename}"
checksum_path="${archive_path}.sha256"

cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

echo "Creating a PostgreSQL custom-format archive and encrypting it with age"
docker run \
    --rm \
    --env PGAPPNAME \
    --env PGDATABASE \
    "$postgres_image" \
    pg_dump \
    --format=custom \
    --compress=gzip:6 \
    --lock-wait-timeout=30s \
  | age \
      --recipient "$AGE_RECIPIENT" \
      --output "$archive_path"

(cd "$temp_dir" && sha256sum "$basename" > "${basename}.sha256")

echo "Uploading encrypted backup to s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${weekly_key}"
aws s3 cp \
  "$archive_path" \
  "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${weekly_key}" \
  --endpoint-url "$endpoint" \
  --no-progress \
  --only-show-errors

aws s3 cp \
  "$checksum_path" \
  "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${weekly_key}.sha256" \
  --content-type "text/plain" \
  --endpoint-url "$endpoint" \
  --no-progress \
  --only-show-errors

local_size=$(wc -c < "$archive_path" | tr -d ' ')
remote_size=$(aws s3api head-object \
  --bucket "$R2_DATABASE_BACKUPS_BUCKET_NAME" \
  --key "$weekly_key" \
  --endpoint-url "$endpoint" \
  --query "ContentLength" \
  --output text)

if [ "$local_size" != "$remote_size" ]; then
  echo "Uploaded backup size mismatch: local=$local_size remote=$remote_size" >&2
  exit 1
fi

# Preserve the first scheduled weekly backup of each month as a longer-lived
# monthly archive without reading Neon a second time.
if [ "$((10#$day))" -le 7 ]; then
  monthly_key="monthly/${year}/${month}/${basename}"
  echo "Copying first weekly backup of the month to s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${monthly_key}"

  aws s3 cp \
    "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${weekly_key}" \
    "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${monthly_key}" \
    --endpoint-url "$endpoint" \
    --no-progress \
    --only-show-errors

  aws s3 cp \
    "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${weekly_key}.sha256" \
    "s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${monthly_key}.sha256" \
    --endpoint-url "$endpoint" \
    --no-progress \
    --only-show-errors
fi

echo "Backup completed: ${weekly_key} (${remote_size} bytes)"
