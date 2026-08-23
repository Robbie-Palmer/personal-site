#!/usr/bin/env bash
set -uo pipefail

# Keeps the media automation stack (Prowlarr, Sonarr, Radarr, qBittorrent)
# running under launchd. Re-checks every 60 seconds, starting the VM and the
# compose stack if either has stopped, so the stack self-heals across hub
# reboots and crashes. Runs forever; launchd's KeepAlive restarts it if it
# ever exits.
#
# The stack is only brought up while the hub's default route runs through a
# VPN tunnel interface (utun*); see ADR 020. Until a tunnel appears, the VM
# still starts but the containers are held back, cycle by cycle.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

MEDIA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_INTERVAL_SECONDS="${CHECK_INTERVAL_SECONDS:-60}"
TRAKT_SYNC_INTERVAL_SECONDS="${TRAKT_SYNC_INTERVAL_SECONDS:-3600}"
LOG_TS="+%F %T"

# One Trakt pass per interval (ADR 021). Quiet no-op until the bridge has
# been authorized with `trakt_sync.py auth`.
run_trakt_sync() {
  local watermark="${MEDIA_DIR}/data/trakt/last_sync"
  local now marker key value
  now="$(date +%s)"
  marker="$(cat "$watermark" 2>/dev/null || echo 0)"
  if (( now - marker < TRAKT_SYNC_INTERVAL_SECONDS )); then
    return 0
  fi
  # The LaunchAgent does not read .env; pick up the bridge's own settings.
  while IFS= read -r line; do
    key="${line%%=*}"; value="${line#*=}"
    case "$key" in
      TRAKT_USERNAME|TRAKT_CLIENT_ID|TRAKT_CLIENT_SECRET) export "$key=$value" ;;
    esac
  done < "${MEDIA_DIR}/.env"
  date +%s > "$watermark"
  MEDIA_AUTOMATION_DIR="$MEDIA_DIR" python3 \
    "${MEDIA_DIR}/scripts/trakt_sync.py" sync >&2 \
    || echo "$(date "$LOG_TS") trakt sync failed; retrying next interval" >&2
}

colima_running() {
  if colima status >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

vpn_tunnel_active() {
  local iface
  iface="$(route -n get 1.1.1.1 2>/dev/null | awk '/^ *interface:/{print $2}')"
  if [[ "$iface" == utun* ]]; then
    return 0
  fi
  return 1
}

while true; do
  if ! colima_running; then
    echo "$(date "$LOG_TS") colima is not running; starting it" >&2
    colima start \
      --vm-type vz \
      --mount-type virtiofs \
      --cpu "${COLIMA_CPU:-4}" \
      --memory "${COLIMA_MEMORY:-4}" \
      --mount "${HOME}:w" \
      --mount "/Volumes:w" >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") colima start failed; retrying next cycle" >&2
  fi

  if colima_running && vpn_tunnel_active; then
    docker compose \
      --project-directory "$MEDIA_DIR" \
      up -d >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") docker compose up failed; retrying next cycle" >&2
    run_trakt_sync
  elif colima_running; then
    echo "$(date "$LOG_TS") no VPN tunnel on the default route; holding the stack (ADR 020)" >&2
  fi

  sleep "$CHECK_INTERVAL_SECONDS"
done
