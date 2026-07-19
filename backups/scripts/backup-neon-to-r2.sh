#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

file_size() {
  wc -c < "$1" | tr -d '[:space:]'
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

secure_transport=0
if [[ "$NEON_DATABASE_URL_UNPOOLED" =~ [\?\&]sslmode=verify-full([\&]|$) ]]; then
  secure_transport=1
elif [[ "$NEON_DATABASE_URL_UNPOOLED" =~ [\?\&]sslmode=require([\&]|$) ]] \
  && [[ "$NEON_DATABASE_URL_UNPOOLED" =~ [\?\&]channel_binding=require([\&]|$) ]]; then
  secure_transport=1
fi

if (( secure_transport == 0 )); then
  echo "NEON_DATABASE_URL_UNPOOLED does not enforce authenticated TLS." >&2
  echo "Use sslmode=verify-full, or sslmode=require with channel_binding=require." >&2
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
basename="recipes-${timestamp}.dump.age"
weekly_key="weekly/${year}/${month}/${basename}"

temp_dir=$(mktemp -d)
archive_path="${temp_dir}/${basename}"
checksum_path="${archive_path}.sha256"

cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

verify_uploaded_size() {
  local local_path="$1"
  local object_key="$2"
  local local_size
  local remote_size

  local_size=$(file_size "$local_path")
  if [[ "$local_size" == "0" ]]; then
    echo "Refusing to verify empty local file: $local_path" >&2
    return 1
  fi

  if ! remote_size=$(aws s3api head-object \
    --bucket "$R2_DATABASE_BACKUPS_BUCKET_NAME" \
    --key "$object_key" \
    --endpoint-url "$endpoint" \
    --query "ContentLength" \
    --output text); then
    echo "Failed to read uploaded object metadata: $object_key" >&2
    return 1
  fi

  if [[ ! "$remote_size" =~ ^[0-9]+$ ]]; then
    echo "Uploaded object returned an invalid size: key=$object_key size=$remote_size" >&2
    return 1
  fi

  if [[ "$local_size" != "$remote_size" ]]; then
    echo "Uploaded object size mismatch: key=$object_key local=$local_size remote=$remote_size" >&2
    return 1
  fi
}

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
    --no-password \
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

verify_uploaded_size "$archive_path" "$weekly_key"
verify_uploaded_size "$checksum_path" "${weekly_key}.sha256"

monthly_prefix="monthly/${year}/${month}/"
monthly_object_count=$(aws s3api list-objects-v2 \
  --bucket "$R2_DATABASE_BACKUPS_BUCKET_NAME" \
  --prefix "$monthly_prefix" \
  --max-keys 1 \
  --endpoint-url "$endpoint" \
  --query "KeyCount" \
  --output text)

if [[ ! "$monthly_object_count" =~ ^[0-9]+$ ]]; then
  echo "Monthly prefix returned an invalid object count: $monthly_object_count" >&2
  exit 1
fi

# Preserve the first successful backup of each month as a longer-lived archive.
# The workflow concurrency group makes the prefix check and copy effectively
# serial, while allowing a manual run to fill a month whose scheduled run failed.
if (( monthly_object_count == 0 )); then
  monthly_key="${monthly_prefix}${basename}"
  echo "Copying first successful backup of the month to s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${monthly_key}"

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
else
  echo "Monthly archive already exists under s3://${R2_DATABASE_BACKUPS_BUCKET_NAME}/${monthly_prefix}; skipping promotion"
fi

archive_size=$(file_size "$archive_path")
echo "Backup completed: ${weekly_key} (${archive_size} bytes)"
