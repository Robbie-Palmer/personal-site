#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

if [[ "${WORK_GRAPH_DOPPLER_WRAPPED:-}" != "1" ]]; then
  missing=false
  for name in CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET WORK_GRAPH_API_URL; do
    if [[ -z "${!name:-}" ]]; then
      missing=true
    fi
  done
  if [[ "$missing" == true ]]; then
    if ! command -v doppler >/dev/null 2>&1; then
      echo "Cannot smoke-test Work Graph: required values are missing and doppler is unavailable." >&2
      exit 1
    fi
    export WORK_GRAPH_DOPPLER_WRAPPED=1
    exec doppler run \
      --project "${DOPPLER_PROJECT:-personal-site}" \
      --config "${DOPPLER_WORK_GRAPH_CONFIG:-prd_work_graph}" \
      --preserve-env=WORK_GRAPH_DOPPLER_WRAPPED,DOPPLER_PROJECT,DOPPLER_WORK_GRAPH_CONFIG \
      -- bash "$0"
  fi
fi

: "${CF_ACCESS_CLIENT_ID:?CF_ACCESS_CLIENT_ID is required}"
: "${CF_ACCESS_CLIENT_SECRET:?CF_ACCESS_CLIENT_SECRET is required}"
: "${WORK_GRAPH_API_URL:?WORK_GRAPH_API_URL is required}"
if [[ ! "$WORK_GRAPH_API_URL" =~ ^https://[a-z0-9.-]+$ ]]; then
  echo "Cannot smoke-test Work Graph: WORK_GRAPH_API_URL must be an HTTPS origin without a path." >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/work-graph-smoke.XXXXXX")"
chmod 700 "$work_dir"
cleanup() {
  find "$work_dir" -type f -exec unlink {} + 2>/dev/null || true
  rmdir "$work_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

printf 'header = "CF-Access-Client-Id: %s"\nheader = "CF-Access-Client-Secret: %s"\n' \
  "$CF_ACCESS_CLIENT_ID" "$CF_ACCESS_CLIENT_SECRET" >"$work_dir/access.curl"
status="000"
for attempt in 1 2 3 4 5; do
  status=$(curl --disable \
    --config "$work_dir/access.curl" \
    --connect-timeout 10 \
    --max-time 30 \
    --silent \
    --show-error \
    --output "$work_dir/response.json" \
    --write-out '%{http_code}' \
    "$WORK_GRAPH_API_URL/api/work-items?limit=1") || status="000"
  if [[ "$status" == "200" ]] && jq -e '.items | type == "array"' "$work_dir/response.json" >/dev/null; then
    echo "Work Graph production queue is reachable through Cloudflare Access."
    exit 0
  fi
  sleep "$attempt"
done

echo "Work Graph production smoke test failed with HTTP $status." >&2
exit 1
