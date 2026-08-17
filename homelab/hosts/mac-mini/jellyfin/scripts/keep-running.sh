#!/usr/bin/env bash
set -uo pipefail

# Keeps the Jellyfin stack running under launchd (homelab.jellyfin).
# Re-checks every 60 seconds, starting colima and the compose stack if either
# has stopped, so the stack self-heals across hub reboots and colima crashes.
# Runs forever; launchd's KeepAlive restarts it if it ever exits.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

JELLYFIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_INTERVAL_SECONDS="${CHECK_INTERVAL_SECONDS:-60}"

colima_running() {
  colima status >/dev/null 2>&1
}

while true; do
  if ! colima_running; then
    echo "$(date '+%F %T') colima is not running; starting it" >&2
    # Same mount layout as bootstrap.sh: $HOME rw + /Volumes ro. If the VM
    # already exists these flags are ignored and its saved config is reused.
    colima start \
      --vm-type vz \
      --mount-type virtiofs \
      --cpu 4 \
      --memory 4 \
      --mount "${HOME}:w" \
      --mount /Volumes >/dev/null 2>&1 \
      || echo "$(date '+%F %T') colima start failed; retrying next cycle" >&2
  fi

  if colima_running; then
    docker compose \
      --project-directory "$JELLYFIN_DIR" \
      up -d >/dev/null 2>&1 \
      || echo "$(date '+%F %T') docker compose up failed; retrying next cycle" >&2
  fi

  sleep "$CHECK_INTERVAL_SECONDS"
done
