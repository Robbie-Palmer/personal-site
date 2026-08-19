#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for the SilverBullet stack on the Mac mini hub.
# Shares the colima VM already running for Jellyfin.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

HOMELAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SB_DIR="${HOMELAB_ROOT}/hosts/mac-mini/silverbullet"
ENV_FILE="${SB_DIR}/.env"
LAUNCHD_AGENT="homelab.silverbullet"
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
# Reuse the colima VM that Jellyfin already manages. Only install tooling if
# it is missing; do not start colima here — the Jellyfin bootstrap owns that.
require_command docker

if ! command -v colima >/dev/null 2>&1; then
  echo "colima is not installed. Run mise run //homelab:bootstrap first (Jellyfin setup) or install colima manually." >&2
  exit 1
fi

if ! colima status >/dev/null 2>&1; then
  echo "colima is not running. Start it with: colima start" >&2
  exit 1
fi

# 2. Environment -----------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  cp "${SB_DIR}/.env.example" "$ENV_FILE"
  # Replace the placeholder with the real home directory
  sed -i '' "s|/Users/YOU/knowledge|${HOME}/knowledge|g" "$ENV_FILE"
  echo "Created $ENV_FILE from the example template."
  echo "Edit SB_USER to set your credentials, then re-run."
  exit 1
fi

env_value() {
  local key="$1"
  grep -F "${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

SB_PORT="$(env_value SB_PORT)"
SB_PORT="${SB_PORT:-3001}"

SB_USER="$(env_value SB_USER)"
if [[ -z "$SB_USER" || "$SB_USER" == "CHANGEME" || "$SB_USER" == *":CHANGEME" ]]; then
  echo "SB_USER is not set or still uses the default credential in $ENV_FILE" >&2
  echo "Set it to user:password, e.g.:" >&2
  printf '  printf "SB_USER=%%s:%%s\\n" "$(whoami)" "$(openssl rand -base64 18)" >> %s\n' "$ENV_FILE" >&2
  exit 1
fi

SB_SPACE_DIR="$(env_value SB_SPACE_DIR)"
if [[ -z "$SB_SPACE_DIR" ]]; then
  echo "SB_SPACE_DIR is not set in $ENV_FILE" >&2
  exit 1
fi

# Enforce restrictive permissions on the credentials file.
chmod 600 "$ENV_FILE"

# 3. Create the knowledge space --------------------------------------------
if [[ ! -d "$SB_SPACE_DIR" ]]; then
  echo "Creating knowledge space at $SB_SPACE_DIR"
  mkdir -p "$SB_SPACE_DIR"
fi

# Initialise a private Git repo if one does not already exist.
if [[ ! -d "${SB_SPACE_DIR}/.git" ]]; then
  echo "Initialising Git repository in $SB_SPACE_DIR"
  git -C "$SB_SPACE_DIR" init -b main
  echo -e "# Knowledge Space\n\nPrivate notes and knowledge base.\n" > "${SB_SPACE_DIR}/index.md"
  echo -e ".DS_Store\n" > "${SB_SPACE_DIR}/.gitignore"
  git -C "$SB_SPACE_DIR" add -A
  git -C "$SB_SPACE_DIR" commit -m "Initialise knowledge space"
fi

# 4. LaunchAgent -----------------------------------------------------------
mkdir -p "${HOME}/Library/Logs/homelab"
sed_escape() { printf '%s' "$1" | sed 's/[&/\]/\\&/g'; }
HOMELAB_ROOT_ESC="$(sed_escape "$HOMELAB_ROOT")"
HOME_ESC="$(sed_escape "$HOME")"
sed \
  -e "s|__HOMELAB_ROOT__|${HOMELAB_ROOT_ESC}|g" \
  -e "s|__HOME__|${HOME_ESC}|g" \
  "${SB_DIR}/launchd/${LAUNCHD_AGENT}.plist" > "$LAUNCHD_TARGET"

launchctl bootout "gui/$(id -u)" "$LAUNCHD_TARGET" 2>/dev/null || true
if ! launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_TARGET"; then
  echo "Failed to install LaunchAgent ${LAUNCHD_AGENT}" >&2
  exit 1
fi
if ! launchctl kickstart -k "gui/$(id -u)/${LAUNCHD_AGENT}"; then
  echo "Failed to start LaunchAgent ${LAUNCHD_AGENT}" >&2
  exit 1
fi
echo "Installed and started LaunchAgent ${LAUNCHD_AGENT}"

# 5. Bring up the stack ----------------------------------------------------
DOCKER_CONTEXT=colima docker compose \
  --project-directory "$SB_DIR" \
  up -d

# 6. Wait for health -------------------------------------------------------
echo "Waiting for SilverBullet to accept connections..."
healthy=false
for _ in $(seq 1 20); do
  if curl -sS -o /dev/null "http://localhost:${SB_PORT}/" >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ "$healthy" != "true" ]]; then
  echo "SilverBullet did not become healthy within 40 seconds" >&2
  DOCKER_CONTEXT=colima docker compose --project-directory "$SB_DIR" logs --tail=30
  exit 1
fi

# 7. Report ----------------------------------------------------------------
echo ""
echo "SilverBullet is up. Access it at:"
echo "  local: http://localhost:${SB_PORT}"
TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [[ -n "$TAILSCALE_IP" ]]; then
  echo "  tailnet: https://robbies-mac-mini.tailaa0e46.ts.net/  (after tailscale serve)"
fi
echo ""
echo "Space: $SB_SPACE_DIR"
echo "Next step: set up Tailscale Serve for HTTPS access from other devices."
echo "  tailscale serve --bg ${SB_PORT}"
