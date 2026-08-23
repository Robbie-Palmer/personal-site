#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for the media automation stack (Prowlarr, Sonarr, Radarr,
# qBittorrent) on the Mac mini hub. Assumes the Jellyfin stack already ran its
# bootstrap: colima is configured and the media volume layout exists.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

HOMELAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
MEDIA_DIR="${HOMELAB_ROOT}/hosts/mac-mini/media-automation"
ENV_FILE="${MEDIA_DIR}/.env"
LAUNCHD_AGENT="homelab.media"
LAUNCHD_TARGET="${HOME}/Library/LaunchAgents/${LAUNCHD_AGENT}.plist"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name" >&2
    exit 1
  fi
}
require_command docker
require_command docker-compose
require_command python3

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "bootstrap.sh must run on the macOS hub (Mac mini)." >&2
  exit 1
fi

# 1. Environment -------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  cp "${MEDIA_DIR}/.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from the example template."
fi

env_value() {
  local key="$1"
  grep -F "${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

if ! grep -qE '^QBITTORRENT_PASSWORD=' "$ENV_FILE" || [[ -z "$(env_value QBITTORRENT_PASSWORD)" ]]; then
  QBIT_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  if grep -qE '^QBITTORRENT_PASSWORD=' "$ENV_FILE"; then
    sed -i '' "s|^QBITTORRENT_PASSWORD=.*|QBITTORRENT_PASSWORD=${QBIT_PASSWORD}|" "$ENV_FILE"
  else
    printf '\nQBITTORRENT_PASSWORD=%s\n' "$QBIT_PASSWORD" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
  echo "Generated qBittorrent WebUI password; saved to $ENV_FILE (gitignored)."
fi

MEDIA="$(env_value MEDIA_DIR)"
DOWNLOADS="$(env_value DOWNLOADS_DIR)"
[[ -d "$MEDIA" ]] || { echo "MEDIA_DIR does not exist: $MEDIA (is the drive mounted?)" >&2; exit 1; }
mkdir -p "$DOWNLOADS"
mkdir -p "${MEDIA_DIR}/data/qbittorrent/qBittorrent"

# Seed qBittorrent config so the WebUI listens where we expect and accepts
# the "admin" username. No password is stored here: on first boot qBittorrent
# prints a temporary one into its logs and provision.sh swaps it for the
# generated password via the API (see provision.py).
if [[ ! -f "${MEDIA_DIR}/data/qbittorrent/qBittorrent/qBittorrent.conf" ]]; then
  QBIT_CONF_DIR="${MEDIA_DIR}/data/qbittorrent/qBittorrent" \
  QBITTORRENT_PORT="$(env_value QBITTORRENT_PORT)" python3 - <<'PY'
import os
conf = f"""[LegalNotice]
Accepted=true

[Preferences]
WebUI\\Address=*
WebUI\\Port={os.environ.get("QBITTORRENT_PORT") or "8080"}
WebUI\\Username=admin
Session\\DefaultSavePath=/downloads
"""
out = os.path.join(os.environ["QBIT_CONF_DIR"], "qBittorrent.conf")
with open(out, "w") as fh:
    fh.write(conf)
print(f"Wrote {out}")
PY
fi

# 2. LaunchAgent ---------------------------------------------------------------
sed_escape() { local value="$1"; printf '%s' "$value" | sed 's/[&/\|]/\\&/g'; }
HOMELAB_ROOT_ESC="$(sed_escape "$HOMELAB_ROOT")"
HOME_ESC="$(sed_escape "$HOME")"
sed \
  -e "s|__HOMELAB_ROOT__|${HOMELAB_ROOT_ESC}|g" \
  -e "s|__HOME__|${HOME_ESC}|g" \
  "${MEDIA_DIR}/launchd/${LAUNCHD_AGENT}.plist" > "$LAUNCHD_TARGET"
launchctl bootout "gui/$(id -u)" "$LAUNCHD_TARGET" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_TARGET"
launchctl kickstart -k "gui/$(id -u)/${LAUNCHD_AGENT}"
echo "Installed and started LaunchAgent ${LAUNCHD_AGENT}"

# 3. Bring up the stack ---------------------------------------------------------
# Refuse to start any container while the VPN tunnel is down; keep-running.sh
# re-checks on every cycle (ADR 020).
vpn_tunnel_active() {
  local iface
  iface="$(route -n get 1.1.1.1 2>/dev/null | awk '/^ *interface:/{print $2}')"
  if [[ "$iface" == utun* ]]; then
    return 0
  fi
  return 1
}
if ! vpn_tunnel_active; then
  echo "No utun* default route: bring the VPN tunnel up before bootstrapping." >&2
  exit 1
fi
docker compose --project-directory "$MEDIA_DIR" up -d

# 4. Provision -------------------------------------------------------------------
echo "Waiting for services to accept connections..."
bash "${MEDIA_DIR}/scripts/provision.sh"
