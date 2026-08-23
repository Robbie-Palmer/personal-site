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
LOG_TS="+%F %T"

colima_running() {
  if colima status >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

vpn_tunnel_active() {
  local iface
  iface="$(route -n get 1.1.1.1 2>/dev/null | awk '/^ *interface:/{print $2}')"
  [[ "$iface" == utun* ]]
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
      --mount /Volumes >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") colima start failed; retrying next cycle" >&2
  fi

  if colima_running && vpn_tunnel_active; then
    docker compose \
      --project-directory "$MEDIA_DIR" \
      up -d >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") docker compose up failed; retrying next cycle" >&2
  elif colima_running; then
    echo "$(date "$LOG_TS") no VPN tunnel on the default route; holding the stack (ADR 020)" >&2
  fi

  sleep "$CHECK_INTERVAL_SECONDS"
done
