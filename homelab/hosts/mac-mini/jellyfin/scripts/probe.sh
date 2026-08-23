#!/usr/bin/env bash
set -euo pipefail

# Smoke-tests media files before adding them to the Jellyfin library. Probes
# real codecs/containers via the jellyfin image's bundled ffprobe, reports
# client compatibility, and can cut a short universally playable preview clip.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="${DOCKER_CONTEXT:-colima}"

JELLYFIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="$(sed -n 's/^JELLYFIN_VERSION=//p' "$JELLYFIN_DIR/.env" 2>/dev/null | tail -1 | tr -d "\"'" || true)"
IMAGE_TAG="${IMAGE_TAG:-10.11}"
IMAGE="jellyfin/jellyfin:${IMAGE_TAG}"
REPORT="$(dirname "${BASH_SOURCE[0]}")/probe_report.py"

PREVIEW_SECONDS=""
AT_OFFSET="0"
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preview)
      if [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]]; then PREVIEW_SECONDS="$2"; shift 2; else PREVIEW_SECONDS=30; shift; fi
      ;;
    --at)
      [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || { echo "--at requires a number of seconds" >&2; exit 2; }
      AT_OFFSET="$2"; shift 2
      ;;
    -h|--help)
      sed -n '2,6p' "${BASH_SOURCE[0]}" | cut -c2-
      echo ""
      echo "Usage: mise run //homelab:probe [--preview [SECONDS]] [--at OFFSET] FILE [FILE ...]"
      exit 0
      ;;
    *)
      FILES+=("$1"); shift
      ;;
  esac
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files given." >&2
  echo "Usage: mise run //homelab:probe [--preview [SECONDS]] [--at OFFSET] FILE [FILE ...]" >&2
  exit 2
fi

if ! colima status >/dev/null 2>&1; then
  echo "colima is not running; start it first (mise run //homelab:up)" >&2
  exit 1
fi

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name" >&2
    exit 1
  fi
}
require_command docker
require_command python3

if [[ ! -r "$REPORT" ]]; then
  echo "Report helper not found: $REPORT" >&2
  exit 1
fi

report() {
  local f="$1"
  local dir base ext
  dir="$(cd "$(dirname "$f")" && pwd)"
  base="$(basename "$f")"
  ext="${base##*.}"
  ext="${ext,,}"

  echo "=== $base"

  local rc=0
  docker run --rm --entrypoint /usr/lib/jellyfin-ffmpeg/ffprobe -v "${dir}:/probe:ro" "$IMAGE" \
    -v error -print_format json -show_format -show_streams "/probe/${base}" \
    | python3 "$REPORT" "$ext" || rc=$?

  if [[ $rc -ne 0 ]]; then
    echo "  FAILED to probe: see ffprobe errors above"
    return 1
  fi
  return 0
}

overall=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "=== $(basename "$f")" >&2
    echo "  ERROR: file not found: $f" >&2
    overall=1
    continue
  fi
  report "$f" || overall=1
done

if [[ -n "$PREVIEW_SECONDS" ]]; then
  src="${FILES[0]}"
  if [[ ! -f "$src" ]]; then
    echo ""
    echo "Preview skipped: source file missing" >&2
    overall=1
  elif [[ $overall -ne 0 ]]; then
    echo ""
    echo "Preview skipped: probing reported errors"
  else
    dir="$(cd "$(dirname "$src")" && pwd)"
    base="$(basename "$src")"
    stem="${base%.*}" stem="${stem//[^A-Za-z0-9._-]/_}"
    preview_dir="${HOME}/.cache/jellyfin-previews"
    mkdir -p "$preview_dir"
    final="${preview_dir}/${stem}.preview.mp4"
    partial="${preview_dir}/${stem}.preview.mp4.part"
    echo ""
    echo "Cutting ${PREVIEW_SECONDS}s preview from ${AT_OFFSET}s -> $final"
    rc=0
    docker run --rm --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg -v "${dir}:/probe:ro" -v "${preview_dir}:/out" "$IMAGE" \
      -hide_banner -loglevel error -y \
      -ss "$AT_OFFSET" -i "/probe/${base}" -t "$PREVIEW_SECONDS" \
      -map 0:v:0 -map "0:a:0?" \
      -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -movflags +faststart \
      "/out/$(basename "$partial")" || rc=$?
    if [[ $rc -eq 0 ]]; then
      mv -f "$partial" "$final"
      echo "Preview ready: open '$final'"
    else
      rm -f "$partial"
      echo "Preview failed (ffmpeg exit $rc)" >&2
      overall=1
    fi
  fi
fi

exit $overall
