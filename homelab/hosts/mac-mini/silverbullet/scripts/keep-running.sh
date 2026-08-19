#!/usr/bin/env bash
set -uo pipefail

# Keeps the SilverBullet stack running under launchd. Re-checks every 60
# seconds, starting the compose stack if it has stopped. Runs forever;
# launchd's KeepAlive restarts it if it ever exits.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

SB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_INTERVAL_SECONDS="${CHECK_INTERVAL_SECONDS:-60}"

colima_running() {
  colima status >/dev/null 2>&1
  return $?
}

docker_ready() {
  docker info >/dev/null 2>&1
  return $?
}

while true; do
  if ! colima_running; then
    echo "$(date '+%F %T') colima is not running; starting it" >&2
    colima start >/dev/null 2>&1 \
      || echo "$(date '+%F %T') colima start failed; retrying next cycle" >&2
  fi

  if colima_running && ! docker_ready; then
    echo "$(date '+%F %T') colima running but Docker daemon not ready; waiting" >&2
    sleep 5
  fi

  if colima_running && docker_ready; then
    docker compose \
      --project-directory "$SB_DIR" \
      up -d >/dev/null 2>&1 \
      || echo "$(date '+%F %T') docker compose up failed; retrying next cycle" >&2
  fi

  sleep "$CHECK_INTERVAL_SECONDS"
done
