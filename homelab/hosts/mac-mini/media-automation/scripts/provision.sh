#!/usr/bin/env bash
set -euo pipefail

# Wires the four media automation services together through their APIs:
# qBittorrent credentials into Sonarr/Radarr, root folders, Prowlarr indexers
# (public trackers), and the indexer-to-app sync. Safe to re-run.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

# Provisioning reaches out to public trackers (indexer validation, searches),
# so refuse to run outside a VPN tunnel; see ADR 020.
VPN_IFACE="$(route -n get 1.1.1.1 2>/dev/null | awk '/^ *interface:/{print $2}')"
case "$VPN_IFACE" in
  utun*) ;;
  *) echo "refusing to provision: default route is '${VPN_IFACE:-unset}', not a VPN tunnel (ADR 020)" >&2; exit 1 ;;
esac

MEDIA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${MEDIA_DIR}/.env"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE; run //media:bootstrap first" >&2; exit 1; }

env_value() {
  local key="$1"
  grep -F "${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

export MEDIA_DIR DOWNLOADS_DIR
export MEDIA_AUTOMATION_DIR="$MEDIA_DIR"
export PROWLARR_PORT="$(env_value PROWLARR_PORT)"; export PROWLARR_PORT="${PROWLARR_PORT:-9696}"
export SONARR_PORT="$(env_value SONARR_PORT)"; export SONARR_PORT="${SONARR_PORT:-8989}"
export RADARR_PORT="$(env_value RADARR_PORT)"; export RADARR_PORT="${RADARR_PORT:-7878}"
export QBITTORRENT_PORT="$(env_value QBITTORRENT_PORT)"; export QBITTORRENT_PORT="${QBITTORRENT_PORT:-8080}"
export QBITTORRENT_PASSWORD="$(env_value QBITTORRENT_PASSWORD)"
export TRAKT_USERNAME="$(env_value TRAKT_USERNAME)"
export TRAKT_CLIENT_ID="$(env_value TRAKT_CLIENT_ID)"
export TRAKT_CLIENT_SECRET="$(env_value TRAKT_CLIENT_SECRET)"

api_key() {
  local container="$1"
  docker exec "$container" cat /config/config.xml 2>/dev/null \
    | sed -n 's/.*<ApiKey>\(.*\)<\/ApiKey>.*/\1/p' | head -1
}

wait_for_key() {
  local container="$1" name="$2" key=""
  for _ in $(seq 1 40); do
    key="$(api_key "$container")"
    [[ -n "$key" ]] && { echo "$key"; return 0; }
    sleep 3
  done
  echo "Timed out waiting for $name API key" >&2
  return 1
}

export PROWLARR_API_KEY="$(wait_for_key prowlarr "Prowlarr")"
export SONARR_API_KEY="$(wait_for_key sonarr "Sonarr")"
export RADARR_API_KEY="$(wait_for_key radarr "Radarr")"

python3 "$(dirname "${BASH_SOURCE[0]}")/provision.py"
