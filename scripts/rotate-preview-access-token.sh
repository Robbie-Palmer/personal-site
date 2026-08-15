#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${DOPPLER_SERVICE_TOKEN:?DOPPLER_SERVICE_TOKEN is required}"

doppler_project="${DOPPLER_PROJECT:-personal-site}"
doppler_config="${DOPPLER_AGENT_CONFIG:-dev_agent}"
service_token_name="${CF_ACCESS_SERVICE_TOKEN_NAME:-personal-site-preview-qa-agents}"

if date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
  previous_secret_expires_at=$(date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ")
else
  previous_secret_expires_at=$(date -u -v+7d +"%Y-%m-%dT%H:%M:%SZ")
fi

# Prove the destination is writable before changing the Cloudflare secret.
curl \
  --disable \
  --fail \
  --silent \
  --show-error \
  --output /dev/null \
  --get \
  --url "https://api.doppler.com/v3/configs/config/secrets" \
  --header "Authorization: Bearer $DOPPLER_SERVICE_TOKEN" \
  --data-urlencode "project=$doppler_project" \
  --data-urlencode "config=$doppler_config"

service_tokens=$(curl \
  --disable \
  --fail \
  --silent \
  --show-error \
  --url "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/access/service_tokens" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN")

match_count=$(jq --arg name "$service_token_name" '[.result[] | select(.name == $name)] | length' <<<"$service_tokens")
if [[ "$match_count" -ne 1 ]]; then
  echo "Expected exactly one Cloudflare Access service token named '$service_token_name'; found $match_count." >&2
  exit 1
fi

service_token_id=$(jq -r --arg name "$service_token_name" '.result[] | select(.name == $name) | .id' <<<"$service_tokens")

rotation_payload=$(jq -nc \
  --arg previous_secret_expires_at "$previous_secret_expires_at" \
  '{previous_client_secret_expires_at: $previous_secret_expires_at}')
rotation_response=$(printf '%s' "$rotation_payload" | curl \
  --disable \
  --fail \
  --silent \
  --show-error \
  --request POST \
  --url "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/access/service_tokens/$service_token_id/rotate" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data-binary @-)

client_id=$(jq -er '.result.client_id' <<<"$rotation_response")
client_secret=$(jq -er '.result.client_secret' <<<"$rotation_response")

doppler_payload=$(printf '%s' "$client_secret" | jq -Rsc \
  --arg project "$doppler_project" \
  --arg config "$doppler_config" \
  --arg client_id "$client_id" \
  '{
    project: $project,
    config: $config,
    secrets: {
      CF_ACCESS_CLIENT_ID: $client_id,
      CF_ACCESS_CLIENT_SECRET: .
    }
  }')
printf '%s' "$doppler_payload" | curl \
  --disable \
  --fail \
  --silent \
  --show-error \
  --output /dev/null \
  --request POST \
  --url "https://api.doppler.com/v3/configs/config/secrets" \
  --header "Authorization: Bearer $DOPPLER_SERVICE_TOKEN" \
  --header "Content-Type: application/json" \
  --data-binary @-

stored_credentials=$(curl \
  --disable \
  --fail \
  --silent \
  --show-error \
  --get \
  --url "https://api.doppler.com/v3/configs/config/secrets/download" \
  --header "Authorization: Bearer $DOPPLER_SERVICE_TOKEN" \
  --data-urlencode "project=$doppler_project" \
  --data-urlencode "config=$doppler_config" \
  --data-urlencode "format=json" \
  --data-urlencode "secrets=CF_ACCESS_CLIENT_ID,CF_ACCESS_CLIENT_SECRET")

if [[ "$(jq -r '.CF_ACCESS_CLIENT_ID' <<<"$stored_credentials")" != "$client_id" ]] || \
  [[ "$(jq -r '.CF_ACCESS_CLIENT_SECRET' <<<"$stored_credentials")" != "$client_secret" ]]; then
  echo "Doppler did not return the newly rotated Access credentials." >&2
  echo "The previous secret remains valid until $previous_secret_expires_at." >&2
  exit 1
fi

unset client_secret rotation_response doppler_payload stored_credentials
echo "Rotated '$service_token_name' and updated $doppler_project/$doppler_config."
echo "The previous secret remains valid until $previous_secret_expires_at."
