#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for the Jellyfin stack on the macOS hub (Mac mini):
#   1. Install colima, docker, and docker-compose via Homebrew.
#   2. Create the .env file from the example template (requires MEDIA_DIR).
#   3. Start colima with the media drive mounted (vz + virtiofs, /Volumes read-only).
#   4. Install and start the homelab.jellyfin LaunchAgent (keep-running.sh).
#   5. Bring up the compose stack and print access URLs.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

HOMELAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
JELLYFIN_DIR="${HOMELAB_ROOT}/hosts/mac-mini/jellyfin"
ENV_FILE="${JELLYFIN_DIR}/.env"
LAUNCHD_AGENT="homelab.jellyfin"
LAUNCHD_TARGET="${HOME}/Library/LaunchAgents/${LAUNCHD_AGENT}.plist"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name" >&2
    exit 1
  fi
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "bootstrap.sh must run on the macOS hub (Mac mini)." >&2
  exit 1
fi

require_command brew

# 1. Container runtime -----------------------------------------------------
if ! command -v colima >/dev/null 2>&1; then
  echo "Installing colima, docker, and docker-compose via Homebrew"
  brew install colima docker docker-compose
fi
require_command colima
require_command docker
require_command docker-compose

# Docker Desktop leaves a credsStore pointing at its own helper (absent from
# this script's PATH). With colima we only pull public images, so a credential
# helper is unnecessary and its stale reference breaks every pull.
if [[ -f "${HOME}/.docker/config.json" ]] && command -v jq >/dev/null 2>&1; then
  stale_store="$(jq -r '.credsStore // empty' "${HOME}/.docker/config.json" 2>/dev/null)"
  if [[ -n "$stale_store" ]] && ! command -v "docker-credential-${stale_store}" >/dev/null 2>&1; then
    echo "Removing stale credsStore \"${stale_store}\" from ~/.docker/config.json"
    jq 'del(.credsStore)' "${HOME}/.docker/config.json" \
      > "${HOME}/.docker/config.json.tmp" \
      && mv "${HOME}/.docker/config.json.tmp" "${HOME}/.docker/config.json"
  fi
fi

# 2. Environment -----------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  cp "${JELLYFIN_DIR}/.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from the example template."
  echo "Set MEDIA_DIR to your media library on the 10TB HDD, then re-run."
  exit 1
fi

# Generate admin credentials on first bootstrap so provision.sh can complete
# the Jellyfin setup without the interactive web wizard.
if ! grep -qE '^JELLYFIN_ADMIN_USER=' "$ENV_FILE"; then
  JELLYFIN_ADMIN_PASSWORD="$(openssl rand -hex 16)"
  printf 'JELLYFIN_ADMIN_USER=admin\nJELLYFIN_ADMIN_PASSWORD=%s\n' "$JELLYFIN_ADMIN_PASSWORD" >> "$ENV_FILE"
  echo "Generated Jellyfin admin credentials; saved to $ENV_FILE (gitignored)."
fi

env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

MEDIA_DIR="$(env_value MEDIA_DIR)"
JELLYFIN_PORT="$(env_value JELLYFIN_PORT)"
JELLYFIN_PORT="${JELLYFIN_PORT:-8096}"

if [[ -z "$MEDIA_DIR" ]]; then
  echo "MEDIA_DIR is not set in $ENV_FILE" >&2
  exit 1
fi
if [[ ! -d "$MEDIA_DIR" ]]; then
  echo "MEDIA_DIR does not exist on this machine: $MEDIA_DIR" >&2
  echo "Is the 10TB HDD connected and mounted?" >&2
  exit 1
fi
mkdir -p "$MEDIA_DIR/TV" "$MEDIA_DIR/Movies"

# 3. colima ----------------------------------------------------------------
if colima status >/dev/null 2>&1; then
  echo "colima is already running; keeping its current configuration."
  echo "If the media drive is not visible to containers, recreate it with:"
  echo "  colima delete && mise run //homelab:bootstrap"
else
  # The hub has 8GB of RAM and also runs Docker Desktop, so colima gets a
  # modest allocation; raise it via COLIMA_CPU / COLIMA_MEMORY if needed.
  # $HOME is shared read-write (repo config dir lives there); /Volumes is
  # shared read-only so containers can see the 10TB HDD. Note: passing
  # --mount replaces colima's default mounts, so $HOME must be listed too.
  echo "Starting colima (vz + virtiofs, \$HOME rw + /Volumes ro)"
  colima start \
    --vm-type vz \
    --mount-type virtiofs \
    --cpu "${COLIMA_CPU:-4}" \
    --memory "${COLIMA_MEMORY:-4}" \
    --mount "${HOME}:w" \
    --mount /Volumes
fi

# 4. LaunchAgent -----------------------------------------------------------
sed \
  -e "s|__HOMELAB_ROOT__|${HOMELAB_ROOT}|g" \
  -e "s|__HOME__|${HOME}|g" \
  "${JELLYFIN_DIR}/launchd/${LAUNCHD_AGENT}.plist" > "$LAUNCHD_TARGET"

launchctl bootout "gui/$(id -u)" "$LAUNCHD_TARGET" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_TARGET"
launchctl kickstart -k "gui/$(id -u)/${LAUNCHD_AGENT}"
echo "Installed and started LaunchAgent ${LAUNCHD_AGENT}"

# 5. Bring up the stack ----------------------------------------------------
DOCKER_CONTEXT=colima docker compose \
  --project-directory "$JELLYFIN_DIR" \
  up -d

# 6. Configure Jellyfin (wizard + libraries) --------------------------------
echo "Waiting for Jellyfin to accept connections..."
for _ in $(seq 1 20); do
  if curl -fsS "http://localhost:${JELLYFIN_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
bash "${JELLYFIN_DIR}/scripts/provision.sh"

# 7. Report access ----------------------------------------------------------
echo ""
echo "Jellyfin is up. Access the web UI at:"
echo "  local:   http://localhost:${JELLYFIN_PORT}"
LAN_IF="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
LAN_IP="$(ipconfig getifaddr "$LAN_IF" 2>/dev/null || true)"
if [[ -n "$LAN_IP" ]]; then
  echo "  LAN:     http://${LAN_IP}:${JELLYFIN_PORT}  (Fire TV Stick)"
fi
TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [[ -n "$TAILSCALE_IP" ]]; then
  echo "  tailnet: http://${TAILSCALE_IP}:${JELLYFIN_PORT}  (phone / laptop)"
fi
echo ""
echo "Add your media folders in the Jellyfin web UI: TV under /media/TV,"
echo "movies under /media/Movies. The library is mounted read-only."
