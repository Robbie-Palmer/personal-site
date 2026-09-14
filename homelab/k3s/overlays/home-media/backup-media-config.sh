#!/usr/bin/env bash
set -euo pipefail

# Nightly restic snapshots of the K3s media stack's app configuration, so an
# incident like the worktree wipe of 2026-09-12 cannot destroy app state
# again (see ADR 023 and the k3s migration).
#
# What gets backed up:
#   ~/.local/share/homelab/k3s/media/  (Jellyfin, Sonarr, Radarr, Prowlarr,
#   qBittorrent, Recyclarr configs + the gitignored .env credentials)
#
# The *arr apps and Jellyfin keep SQLite databases that must not be copied
# while mid-write, so every *.db is snapshotted through sqlite3's online
# .backup API into a staging directory; the live tree is backed up with the
# database files excluded and the staging tree included.
#
# Fail-closed: refuses to run when the Expansion disk is not mounted, like
# the Ente export check (ADR 022). A mkdir lockfile prevents overlap.
#
# Restore: install restic (mise install), then
#   export RESTIC_REPOSITORY=/Volumes/Expansion/Backups/media-k3s
#   export RESTIC_PASSWORD_FILE=~/.local/share/homelab/k3s/media-backup.restic-pw
#   restic restore latest --target /tmp/restore \
#     --include '/media-config' --include '/media-db-snapshots'
# Scale the media stack down, copy the app directories from
# /tmp/restore/media-config into ~/.local/share/homelab/k3s/media/, copy the
# staged databases from /tmp/restore/media-db-snapshots over the live *.db
# files, then scale the stack back up (or restart the pods).
#
# Install the schedule (launchd, nightly 04:17):
#   sed -e 's|__HOMELAB_ROOT__|'"$HOME"'/repos/personal-site/homelab|' \
#       -e 's|__HOME__|'"$HOME"'|' \
#       homelab/k3s/overlays/home-media/homelab.media-k3s-backup.plist \
#       > ~/Library/LaunchAgents/homelab.media-k3s-backup.plist
#   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/homelab.media-k3s-backup.plist

export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

MEDIA_DATA_DIR="${MEDIA_DATA_DIR:-$HOME/.local/share/homelab/k3s/media}"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/Volumes/Expansion/Backups/media-k3s}"
RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-$HOME/.local/share/homelab/k3s/media-backup.restic-pw}"
LOCK_DIR="${TMPDIR:-/tmp}/homelab-media-backup.lock"
# Stable path so restores are predictable; wiped and rebuilt every run.
STAGE_ROOT="$HOME/.local/share/homelab/k3s/media-db-snapshots"
LOG_TS="+%F %T"

log() { echo "$(date "$LOG_TS") $*"; }

cleanup() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup EXIT

if [[ -d "$LOCK_DIR" ]]; then
  log "another backup run holds the lock; exiting"
  exit 0
fi
mkdir "$LOCK_DIR"

if [[ ! -d /Volumes/Expansion ]]; then
  log "refusing to back up: the Expansion disk is not mounted"
  exit 1
fi
if [[ ! -d "$MEDIA_DATA_DIR" ]]; then
  log "refusing to back up: $MEDIA_DATA_DIR does not exist"
  exit 1
fi
case "$STAGE_ROOT" in
  "$HOME"/.local/share/homelab/*) ;;
  *) log "refusing to back up: unsafe staging path '$STAGE_ROOT'"; exit 1 ;;
esac

RESTIC_BIN="$(ls -t "$HOME"/.local/share/mise/installs/aqua-restic-restic/*/restic 2>/dev/null | head -1)"
if [[ -z "$RESTIC_BIN" ]] && command -v restic >/dev/null 2>&1; then
  RESTIC_BIN="$(command -v restic)"
fi
if [[ -z "$RESTIC_BIN" ]]; then
  log "refusing to back up: restic not found (run 'mise install' in homelab/)"
  exit 1
fi
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

if [[ ! -f "$RESTIC_PASSWORD_FILE" ]]; then
  umask 077
  openssl rand -base64 32 > "$RESTIC_PASSWORD_FILE"
  log "generated restic repository password at $RESTIC_PASSWORD_FILE"
  log "store a copy of that file outside this machine; without it the snapshots are unrecoverable"
fi

if ! "$RESTIC_BIN" snapshots --json >/dev/null 2>&1; then
  log "initializing restic repository at $RESTIC_REPOSITORY"
  "$RESTIC_BIN" init
fi

# Stage consistent copies of every SQLite database.
log "staging SQLite databases from $MEDIA_DATA_DIR"
rm -rf "$STAGE_ROOT"
mkdir -p "$STAGE_ROOT"
while IFS= read -r -d '' db; do
  rel="${db#"$MEDIA_DATA_DIR"/}"
  app_dir="$(dirname "$rel")"
  mkdir -p "$STAGE_ROOT/$app_dir"
  sqlite3 "$db" ".backup '$STAGE_ROOT/$app_dir/$(basename "$db")'"
done < <(find "$MEDIA_DATA_DIR" -name '*.db' -print0)

log "running restic backup"
"$RESTIC_BIN" backup "$MEDIA_DATA_DIR" \
  --exclude '*.db' \
  --exclude '*.db-wal' \
  --exclude '*.db-shm' \
  --tag media-config
"$RESTIC_BIN" backup "$STAGE_ROOT" --tag media-config-db-snapshots
log "applying retention (7 daily, 4 weekly, 6 monthly)"
"$RESTIC_BIN" forget \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 \
  --prune --compact

log "backup complete"
