#!/usr/bin/env bash
set -euo pipefail
umask 077

required_values=(
  AI_REVIEW_WEBHOOK_SECRET
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
)
missing_values=()
for name in "${required_values[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing_values+=("$name")
  fi
done
if ((${#missing_values[@]} > 0)); then
  echo "Cannot run staging E2E: missing required values: ${missing_values[*]}" >&2
  exit 1
fi
for command in gh jq node pnpm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Cannot run staging E2E: ${command} is required." >&2
    exit 1
  fi
done

repository="${AI_REVIEW_E2E_REPOSITORY:-Robbie-Palmer/personal-site}"
pull_request="${AI_REVIEW_E2E_PULL_REQUEST:-}"
if [[ -z "$pull_request" ]]; then
  pull_request="$(gh pr view --json number --jq '.number')"
fi
if [[ ! "$pull_request" =~ ^[1-9][0-9]*$ ]]; then
  echo "Cannot run staging E2E: pull request must be a positive integer." >&2
  exit 1
fi
staging_url="${AI_REVIEW_STAGING_URL:-https://ai-review-staging.robbiepalmer95.workers.dev}"
delivery_id="staging-e2e-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
instance_id="review-${delivery_id}"

temporary_root="${TMPDIR:-/tmp}"
if [[ -d /dev/shm && -w /dev/shm ]]; then
  temporary_root="/dev/shm"
fi
temporary_dir="$(mktemp -d "${temporary_root%/}/ai-review-e2e.XXXXXX")"
payload_file="${temporary_dir}/payload.json"
record_file="${temporary_dir}/record.json"
chmod 700 "$temporary_dir"
cleanup() {
  [[ ! -f "$payload_file" ]] || unlink "$payload_file"
  [[ ! -f "$record_file" ]] || unlink "$record_file"
  rmdir "$temporary_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

head_sha="$(
  gh api "repos/${repository}/pulls/${pull_request}" --jq '.head.sha'
)"
jq -n \
  --arg repository "$repository" \
  --argjson pull_request "$pull_request" \
  '{
    action: "created",
    repository: {full_name: $repository},
    issue: {number: $pull_request, pull_request: {}},
    comment: {body: "/ai-review", author_association: "OWNER"}
  }' > "$payload_file"
chmod 600 "$payload_file"

signature="$(
  node -e '
    const {createHmac} = require("node:crypto");
    const {readFileSync} = require("node:fs");
    process.stdout.write(
      createHmac("sha256", process.env.AI_REVIEW_WEBHOOK_SECRET)
        .update(readFileSync(process.argv[1]))
        .digest("hex"),
    );
  ' "$payload_file"
)"

response="$(
  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "content-type: application/json" \
    --header "x-github-delivery: ${delivery_id}" \
    --header "x-github-event: issue_comment" \
    --header "x-hub-signature-256: sha256=${signature}" \
    --data-binary "@${payload_file}" \
    "${staging_url}/webhooks/github"
)"
if [[ "$(jq -r '.accepted // false' <<<"$response")" != "true" ]]; then
  echo "Staging webhook was not accepted: ${response}" >&2
  exit 1
fi
printf 'Accepted staging delivery %s for head %s\n' \
  "$delivery_id" "${head_sha:0:12}"

record_key="v1/${repository}/pr-${pull_request}/${head_sha}/${instance_id}.json"
deadline=$((SECONDS + 600))
while ((SECONDS < deadline)); do
  if pnpm exec wrangler r2 object get \
    "ai-review-data-staging/${record_key}" \
    --config wrangler.staging.toml \
    --remote \
    --file "$record_file" >/dev/null 2>&1; then
    break
  fi
  sleep 15
done
if [[ ! -s "$record_file" ]]; then
  echo "Timed out waiting for staging review record ${record_key}" >&2
  pnpm exec wrangler workflows instances describe \
    ai-review-staging \
    "$instance_id" \
    --config wrangler.staging.toml || true
  exit 1
fi

jq -e \
  --arg head_sha "$head_sha" \
  '.status == "published" and .headSha == $head_sha' \
  "$record_file" >/dev/null
comment="$(
  gh api "repos/${repository}/issues/${pull_request}/comments" \
    --paginate \
    --jq '[.[] | select(.body | contains("<!-- stateful-ai-code-review -->"))] | last'
)"
if [[ -z "$comment" ]]; then
  echo "The staging review record exists, but no visible stateful comment was found." >&2
  exit 1
fi
if ! jq -e \
  --arg head "${head_sha:0:12}" \
  '.body | contains("Head `" + $head + "`")' <<<"$comment" >/dev/null; then
  echo "The visible stateful comment does not target the expected head." >&2
  exit 1
fi

jq '{
  status,
  headSha,
  runCostUsd,
  findingCount: (.findings.findings | length),
  models: [.models[] | {model, provider, role, ok, costUsd}]
}' "$record_file"
printf 'Visible comment: %s\n' "$(jq -r '.html_url' <<<"$comment")"
