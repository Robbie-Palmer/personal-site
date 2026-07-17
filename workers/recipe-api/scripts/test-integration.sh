#!/usr/bin/env bash
set -euo pipefail

container_id=""

cleanup() {
  if [[ -n "$container_id" ]]; then
    integration_label=$(
      docker inspect \
        --format '{{ index .Config.Labels "personal-site.recipe-api-integration" }}' \
        "$container_id" 2>/dev/null || true
    )
    if [[ "$integration_label" == "true" ]]; then
      docker rm --force "$container_id" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT INT TERM

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  if [[ "${ALLOW_INTEGRATION_DATABASE:-}" != "1" ]]; then
    echo "ALLOW_INTEGRATION_DATABASE=1 is required with TEST_DATABASE_URL." >&2
    echo "The integration suite truncates application tables." >&2
    exit 1
  fi
  export DATABASE_URL="$TEST_DATABASE_URL"
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required when TEST_DATABASE_URL is not provided." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but its daemon is unavailable." >&2
    exit 1
  fi

  container_id=$(docker run --detach --rm \
    --env POSTGRES_DB=recipes_integration \
    --env POSTGRES_PASSWORD=integration-password \
    --label personal-site.recipe-api-integration=true \
    --publish 127.0.0.1::5432 \
    postgres:17-alpine)
  if [[ ! "$container_id" =~ ^[a-f0-9]{12,64}$ ]]; then
    echo "Docker returned an invalid container ID." >&2
    exit 1
  fi

  for attempt in {1..30}; do
    if docker exec "$container_id" pg_isready \
      --username postgres \
      --dbname recipes_integration >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" -eq 30 ]]; then
      echo "PostgreSQL did not become ready within 30 seconds." >&2
      exit 1
    fi
    sleep 1
  done

  published_port=$(docker port "$container_id" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')
  if [[ ! "$published_port" =~ ^[0-9]+$ ]]; then
    echo "Could not determine the disposable PostgreSQL port." >&2
    exit 1
  fi
  export DATABASE_URL="postgresql://postgres:integration-password@127.0.0.1:${published_port}/recipes_integration"
fi

pnpm db:migrate
pnpm exec vitest run --config vitest.integration.config.ts
