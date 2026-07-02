#!/usr/bin/env bash
set -euo pipefail

project="${DOPPLER_PROJECT:-personal-site}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

contains_name() {
  local needle="$1"
  local names="$2"

  grep -Fxq -- "$needle" <<<"$names"
}

sync_env() {
  local doppler_config="$1"
  local github_env="$2"
  local secrets_json
  local entries_json
  local existing_secrets_json
  local existing_vars_json

  echo "Syncing Doppler config '$doppler_config' to GitHub environment '$github_env'"

  secrets_json=$(doppler secrets --project "$project" --config "$doppler_config" --json)
  entries_json=$(jq -c '
    to_entries
    | map(select(.key | startswith("DOPPLER_") | not))
    | map({
        name: .key,
        value: .value.computed,
        visibility: .value.computedVisibility
      })
  ' <<<"$secrets_json")

  desired_secrets=$(jq -r '.[] | select(.visibility != "unmasked") | .name' <<<"$entries_json")
  desired_vars=$(jq -r '.[] | select(.visibility == "unmasked") | .name' <<<"$entries_json")

  while IFS= read -r entry; do
    local name
    local value
    local visibility

    name=$(jq -r '.name' <<<"$entry")
    value=$(jq -r '.value // ""' <<<"$entry")
    visibility=$(jq -r '.visibility' <<<"$entry")

    if [ -z "$value" ]; then
      echo "Refusing to sync empty value: $doppler_config:$name" >&2
      exit 1
    fi

    if [ "$visibility" = "unmasked" ]; then
      gh variable set "$name" --env "$github_env" --body "$value" >/dev/null
      gh secret delete "$name" --env "$github_env" >/dev/null 2>&1 || true
    else
      gh secret set "$name" --env "$github_env" --body "$value" >/dev/null
      gh variable delete "$name" --env "$github_env" >/dev/null 2>&1 || true
    fi
  done < <(jq -c '.[]' <<<"$entries_json")

  existing_secrets_json=$(gh secret list --env "$github_env" --json name)
  existing_vars_json=$(gh variable list --env "$github_env" --json name)

  while IFS= read -r name; do
    if ! contains_name "$name" "$desired_secrets"; then
      echo "Deleting stale GitHub secret '$name' from '$github_env'"
      gh secret delete "$name" --env "$github_env" >/dev/null
    fi
  done < <(jq -r '.[].name' <<<"$existing_secrets_json")

  while IFS= read -r name; do
    if ! contains_name "$name" "$desired_vars"; then
      echo "Deleting stale GitHub variable '$name' from '$github_env'"
      gh variable delete "$name" --env "$github_env" >/dev/null
    fi
  done < <(jq -r '.[].name' <<<"$existing_vars_json")
}

require_command doppler
require_command gh
require_command jq

sync_env stg_recipe_api preview-recipe-api
sync_env stg_site_ui preview-site-ui
sync_env prd_recipe_api production-recipe-api
sync_env prd_site_ui production-site-ui
sync_env prd_infra production-infra
sync_env prd_ci_repo production-ci

echo "Manual Doppler to GitHub environment sync complete."
