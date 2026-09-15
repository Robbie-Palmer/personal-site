#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

required_values=(
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  DOPPLER_CONFIG
  DOPPLER_PROJECT
  NEON_API_KEY
  NEON_BRANCH_ID
  NEON_DATABASE_HOST
  NEON_DATABASE_NAME
  NEON_PROJECT_ID
  NEON_ROLE_NAME
  WORK_GRAPH_API_ORIGIN
  WORK_GRAPH_DOPPLER_SERVICE_TOKEN
  WORK_GRAPH_HYPERDRIVE_ID
)
for name in "${required_values[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Cannot install the Work Graph Hyperdrive origin: $name is required." >&2
    exit 1
  fi
done

secrets_root="${TMPDIR:-/tmp}"
if [[ -d /dev/shm && -w /dev/shm ]]; then
  secrets_root="/dev/shm"
fi
work_dir="$(mktemp -d "${secrets_root%/}/work-graph-hyperdrive.XXXXXX")"
chmod 700 "$work_dir"
cleanup() {
  find "$work_dir" -type f -exec unlink {} + 2>/dev/null || true
  rmdir "$work_dir" 2>/dev/null || true
  unset database_password database_url
}
trap cleanup EXIT INT TERM

printf 'header = "Authorization: Bearer %s"\n' "$NEON_API_KEY" >"$work_dir/neon.curl"
printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN" >"$work_dir/cloudflare.curl"
printf 'header = "Authorization: Bearer %s"\n' "$WORK_GRAPH_DOPPLER_SERVICE_TOKEN" >"$work_dir/doppler.curl"

curl --disable --config "$work_dir/neon.curl" --connect-timeout 10 --fail --max-time 30 \
  --silent --show-error --output "$work_dir/password.json" \
  --url "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$NEON_BRANCH_ID/roles/$NEON_ROLE_NAME/reveal_password"
database_password=$(jq -er '.password' "$work_dir/password.json")

jq -n \
  --arg database "$NEON_DATABASE_NAME" \
  --arg host "$NEON_DATABASE_HOST" \
  --arg password "$database_password" \
  --arg user "$NEON_ROLE_NAME" \
  '{
    name: "work-graph-db",
    origin: {
      database: $database,
      host: $host,
      port: 5432,
      user: $user,
      password: $password,
      scheme: "postgresql"
    },
    caching: {disabled: true}
  }' >"$work_dir/hyperdrive-update.json"
curl --disable --config "$work_dir/cloudflare.curl" --connect-timeout 10 --fail --max-time 30 \
  --silent --show-error --output "$work_dir/hyperdrive-updated.json" \
  --request PUT \
  --url "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs/$WORK_GRAPH_HYPERDRIVE_ID" \
  --header "Content-Type: application/json" \
  --data-binary "@$work_dir/hyperdrive-update.json"
if [[ "$(jq -er '.success' "$work_dir/hyperdrive-updated.json")" != true ]]; then
  echo "Cloudflare did not accept the Work Graph Hyperdrive origin." >&2
  exit 1
fi

encoded_user=$(jq -rn --arg value "$NEON_ROLE_NAME" '$value | @uri')
encoded_password=$(jq -rn --arg value "$database_password" '$value | @uri')
encoded_database=$(jq -rn --arg value "$NEON_DATABASE_NAME" '$value | @uri')
database_url="postgresql://${encoded_user}:${encoded_password}@${NEON_DATABASE_HOST}:5432/${encoded_database}?sslmode=require"
jq -n \
  --arg project "$DOPPLER_PROJECT" \
  --arg config "$DOPPLER_CONFIG" \
  --arg database_url "$database_url" \
  --arg hyperdrive_id "$WORK_GRAPH_HYPERDRIVE_ID" \
  --arg api_origin "$WORK_GRAPH_API_ORIGIN" \
  '{
    project: $project,
    config: $config,
    secrets: {
      DATABASE_URL: $database_url,
      WORK_GRAPH_HYPERDRIVE_ID: $hyperdrive_id,
      WORK_GRAPH_API_URL: $api_origin,
      WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS: $api_origin
    }
  }' >"$work_dir/doppler-update.json"
curl --disable --config "$work_dir/doppler.curl" --connect-timeout 10 --fail --max-time 30 \
  --silent --show-error --output "$work_dir/doppler-updated.json" \
  --request POST \
  --url "https://api.doppler.com/v3/configs/config/secrets" \
  --header "Content-Type: application/json" \
  --data-binary "@$work_dir/doppler-update.json"

echo "Installed the Neon origin in Hyperdrive and recorded its public ID in Doppler."
