#!/usr/bin/env bash
set -euo pipefail

# Re-applies Tailscale Serve for SilverBullet (port 3001). The serve config
# can be overwritten by other Tailscale serve/funnel invocations (e.g.
# t3-code preview agents), so this script periodically verifies and
# re-applies the desired state.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

DESIRED_PORT="${SB_PORT:-3001}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "$(date '+%F %T') tailscale command not found; skipping" >&2
  exit 0
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "$(date '+%F %T') tailscale not connected; skipping" >&2
  exit 0
fi

status_json="$(tailscale serve status --json 2>/dev/null || echo '{}')"

if echo "$status_json" | grep -q "\"${DESIRED_PORT}\""; then
  exit 0
fi

echo "$(date '+%F %T') re-applying Tailscale Serve for SilverBullet on port ${DESIRED_PORT}"
tailscale serve --bg "${DESIRED_PORT}"
