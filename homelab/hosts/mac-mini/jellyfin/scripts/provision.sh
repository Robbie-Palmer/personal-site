#!/usr/bin/env bash
set -euo pipefail

# Idempotently completes the Jellyfin first-run wizard and creates the media
# libraries (TV Shows -> /media/TV, Movies -> /media/Movies) via the API, so
# no manual web onboarding is needed. Admin credentials come from the .env
# file (JELLYFIN_ADMIN_USER / JELLYFIN_ADMIN_PASSWORD).

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

JELLYFIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${JELLYFIN_DIR}/.env"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name" >&2
    exit 1
  fi
}
require_command curl
require_command jq

env_value() {
  local key="$1"
  grep -F "${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

PORT="$(env_value JELLYFIN_PORT)"
PORT="${PORT:-8096}"
BASE_URL="http://localhost:${PORT}"

ADMIN_USER="$(env_value JELLYFIN_ADMIN_USER)"
ADMIN_PASS="$(env_value JELLYFIN_ADMIN_PASSWORD)"
if [[ -z "$ADMIN_USER" || -z "$ADMIN_PASS" ]]; then
  echo "JELLYFIN_ADMIN_USER / JELLYFIN_ADMIN_PASSWORD are not set in $ENV_FILE" >&2
  echo "Run bootstrap.sh (which generates them) or add them manually." >&2
  exit 1
fi

AUTH_HEADER='MediaBrowser Client="provision", Device="mac-mini", DeviceId="provision-cli", Version="1.0"'
CONTENT_TYPE='Content-Type: application/json'

# 1. Complete the startup wizard if it is still pending ---------------------
status="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/Startup/Configuration")"
if [[ "$status" == "200" ]]; then
  echo "Completing Jellyfin first-run wizard"
  curl -s --max-time 10 -X POST "$BASE_URL/Startup/Configuration" \
    -H "$CONTENT_TYPE" \
    -d '{"ServerName":"Mac Mini","UICulture":"en-GB","MetadataCountryCode":"GB","PreferredMetadataLanguage":"en"}' \
    -o /dev/null -w "  startup configuration: %{http_code}\n"
  user_json="$(jq -n --arg u "$ADMIN_USER" --arg p "$ADMIN_PASS" '{Name: $u, Password: $p}')"
  curl -s --max-time 10 -X POST "$BASE_URL/Startup/User" \
    -H "$CONTENT_TYPE" \
    -d "$user_json" \
    -o /dev/null -w "  admin user: %{http_code}\n"
  curl -s --max-time 10 -X POST "$BASE_URL/Startup/Complete" \
    -o /dev/null -w "  wizard complete: %{http_code}\n"
else
  echo "Startup wizard already complete (Startup/Configuration returned $status); skipping"
fi

# 2. Authenticate as admin ---------------------------------------------------
auth_json="$(jq -n --arg u "$ADMIN_USER" --arg p "$ADMIN_PASS" '{Username: $u, Pw: $p}')"
TOKEN="$(curl -s --max-time 10 -X POST "$BASE_URL/Users/AuthenticateByName" \
  -H "$CONTENT_TYPE" \
  -H "X-Emby-Authorization: $AUTH_HEADER" \
  -d "$auth_json" | jq -r .AccessToken)"
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Authentication failed for user '$ADMIN_USER' - check JELLYFIN_ADMIN_* in $ENV_FILE" >&2
  exit 1
fi

# 3. Create the media libraries if they do not exist ------------------------
add_library() {
  local name="$1" type="$2" path="$3"
  if curl -s --max-time 10 "$BASE_URL/Library/VirtualFolders" -H "X-Emby-Token: $TOKEN" \
      | jq -e --arg n "$name" 'any(.[]; .Name == $n)' >/dev/null 2>&1; then
    echo "  library '$name' already exists; skipping"
    return
  fi
  local name_enc type_enc path_enc
  name_enc="$(jq -rn --arg v "$name" '$v|@uri')"
  type_enc="$(jq -rn --arg v "$type" '$v|@uri')"
  path_enc="$(jq -rn --arg v "$path" '$v|@uri')"
  echo "  adding $name library ($path)"
  curl -s --max-time 15 -X POST \
    "$BASE_URL/Library/VirtualFolders?name=$name_enc&collectionType=$type_enc&paths=$path_enc&refreshLibrary=true" \
    -H "$CONTENT_TYPE" -H "X-Emby-Token: $TOKEN" \
    -d '{"libraryOptions":{"enableRealtimeMonitor":true}}' \
    -o /dev/null -w "  $name: %{http_code}\n"
}

add_library "TV Shows" "tvshows" "/media/TV"
add_library "Movies" "movies" "/media/Movies"

echo ""
echo "Jellyfin is configured. Log in at http://localhost:${PORT} with user '$ADMIN_USER'."
echo "Libraries: TV Shows -> /media/TV, Movies -> /media/Movies (backed by MEDIA_DIR on the host)."
