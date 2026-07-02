# Infrastructure

Terraform configuration for managing Cloudflare and Neon resources.

## GitHub Actions Setup

### Required Secrets

**[Doppler](https://doppler.com) is the single source of truth for these
values.** GitHub environment secrets and variables are populated manually from
Doppler with `scripts/sync-doppler-github-envs.sh` because the free Doppler plan
does not provide enough sync integrations for this repo's environment
boundaries. Do not edit GitHub environment values by hand; change Doppler, then
run the manual sync script.

Secrets and config mirrored from Doppler:

1. **`CLOUDFLARE_API_TOKEN`**
   - Create at: Cloudflare Dashboard → My Profile → API Tokens
   - Required permissions:
     - Account.Cloudflare Pages: Edit
     - Account.Account Settings: Read
     - Zone.DNS: Edit (for domain management)
2. **`TF_API_TOKEN`**
   - Create at: Terraform Cloud → User Settings → Tokens
   - Used for remote state management
   - Note: Stored as `TF_API_TOKEN` in GitHub, but workflows map it to `TF_TOKEN_app_terraform_io` for Terraform CLI
3. **`CF_IMAGES_ACCOUNT_HASH`**
   - Find at: Cloudflare Dashboard → Images → Delivery URL
   - Example: `AbCdEfGh123` (from `https://imagedelivery.net/AbCdEfGh123/...`)
   - Used to configure Cloudflare Images environment variable for deployments
   - Note: Not actually sensitive (publicly visible in image URLs), but stored as secret for consistency
4. **`NEON_API_KEY`**
   - Create at: [Neon Console](https://console.neon.tech) → Account Settings → API Keys
   - Used by the Neon Terraform provider to manage database resources
5. **`NEON_ORG_ID`**
   - Find at: [Neon Console](https://console.neon.tech) → Organization settings
   - Passed as `TF_VAR_neon_org_id`
6. **`POSTHOG_KEY`**
   - PostHog project API key (`phc_…`). This is a public, write-only ingestion
     key — it already ships to browsers via `NEXT_PUBLIC_POSTHOG_KEY`, so it is
     not secret in the usual sense, but it is sourced from Doppler for
     single-source-of-truth config management.
   - Mapped to `TF_VAR_posthog_key` (Terraform → Pages env var) and to
     `NEXT_PUBLIC_POSTHOG_KEY` (UI build). It is **also** used — outside both
     Terraform and Doppler's reach — as the auth header on the `posthog-logs`
     Workers Observability destination. See [Rotating `POSTHOG_KEY`](#rotating-posthog_key).
7. **`POSTHOG_HOST`**
   - PostHog ingestion host (`https://eu.posthog.com`).
   - Mapped to `NEXT_PUBLIC_POSTHOG_HOST` for the UI build.
8. **`MISE_GITHUB_TOKEN`**
   - GitHub token used by mise to download tools during Cloudflare Pages builds.
   - Mapped to `TF_VAR_github_token`, which Terraform passes into the Pages
     build configuration (`var.github_token`, required — no default).

### Required Environment

Create GitHub environments that match the Doppler config boundaries:

1. Go to: Settings → Environments → New environment
2. Create `production-infra`, `production-site-ui`, `production-recipe-api`,
   `production-ci`, `preview-site-ui`, and `preview-recipe-api`
3. (Optional) Add protection rules for production deployments

PR infrastructure uses the `preview-*` environments with least-privilege
credentials. Follow the
[preview environment runbook](../docs/preview-environments.md); do not copy the
production Cloudflare token or production database URL into them.

### Terraform Cloud Workspace

Create a workspace in Terraform Cloud for remote state:

1. Go to: [Terraform Cloud workspaces](https://app.terraform.io/app/robbie-palmer/workspaces)
2. Create a new workspace named: `personal-site`
3. Choose "API-driven workflow"

## Local Development

Credentials are sourced from Doppler (the same single source of truth CI uses).
mise auto-loads a local `.env` (`_.file = ".env"` in `mise.toml`), so populate
that `.env` from Doppler rather than hand-editing it, and regenerate it after
any rotation so it never drifts:

```bash
#!/usr/bin/env bash
# Pull values from Doppler into .env using the names Terraform expects
# (TF_VAR_<variable>, lowercase suffix). This covers the same secrets CI maps in
# infra-ci.yml. All secrets are fetched and checked first, then written to a
# temp file and moved into place, so a failed/empty fetch or interrupted write
# never leaves a partial .env behind (which would silently break Terraform).
set -euo pipefail

require() {
  local value
  value=$(doppler secrets get "$1" --plain) || {
    echo "error: failed to read '$1' from Doppler" >&2
    return 1
  }
  if [ -z "$value" ]; then
    echo "error: Doppler secret '$1' is empty" >&2
    return 1
  fi
  printf '%s' "$value"
}

cloudflare_api_token=$(require CLOUDFLARE_API_TOKEN)
tf_cloud_token=$(require TF_API_TOKEN)
neon_api_key=$(require NEON_API_KEY)
neon_org_id=$(require NEON_ORG_ID)
posthog_key=$(require POSTHOG_KEY)
cf_images_account_hash=$(require CF_IMAGES_ACCOUNT_HASH)
github_token=$(require MISE_GITHUB_TOKEN)

tmp=$(mktemp)       # mktemp creates the file mode 0600
chmod 600 "$tmp"    # make the owner-only intent explicit
{
  printf 'CLOUDFLARE_API_TOKEN=%s\n' "$cloudflare_api_token"
  printf 'TF_TOKEN_app_terraform_io=%s\n' "$tf_cloud_token"
  printf 'NEON_API_KEY=%s\n' "$neon_api_key"
  printf 'TF_VAR_neon_org_id=%s\n' "$neon_org_id"
  printf 'TF_VAR_posthog_key=%s\n' "$posthog_key"
  printf 'TF_VAR_cf_images_account_hash=%s\n' "$cf_images_account_hash"
  printf 'TF_VAR_github_token=%s\n' "$github_token"
} > "$tmp"
mv "$tmp" .env
```

Then run Terraform commands via mise:

- `mise run //infra:plan` - Preview changes
- `mise run //infra:apply` - Apply changes

The mapping from Doppler's uppercase secret names to Terraform's
`TF_VAR_<variable>` names is the same one CI performs in the workflow `env:`
blocks; doing it here keeps local and CI consistent.

See `mise.toml` for all available tasks.

## R2 Buckets

### `map-tiles`

Public bucket serving map tile images via `tiles.robbiepalmer.me`.
Has DNS records, cache rules, and proxied access configured in Terraform.

### `dvc`

Private bucket for ML pipeline data versioned with [DVC](https://dvc.org/).
Accessed only via S3-compatible API with credentials — no public access.
Used by `ml-pipelines/` projects, each under their own prefix
(e.g. `s3://dvc/recipe-parsing`).

To create an API token for access:
[Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) →
Manage R2 API Tokens → Create User API Token
(Object Read & Write, scoped to `dvc` bucket).

See [`ml-pipelines/README.md`](/ml-pipelines/README.md) for developer setup.

## Neon Database

### `recipes`

Serverless Postgres project for the recipe site. Managed via the
[kislerdm/neon](https://registry.terraform.io/providers/kislerdm/neon/latest/docs)
Terraform provider.

- **Region:** `aws-us-east-1`
- **Connection:** Use the pooled connection URI (`neon_connection_uri_pooler` output)
  for serverless/Workers environments

## Rotating `POSTHOG_KEY`

`POSTHOG_KEY` lives in Doppler, but it lands in **three** places — two are
automated, one is **manual**. The manual one will break silently (logs just
stop arriving in PostHog, no error) if you forget it, so rotate in this order:

1. **Doppler** — update the value. This is the source of truth.
2. **Pages / UI build** — run `scripts/sync-doppler-github-envs.sh`; the next
   infra apply / UI build picks it up via
   `TF_VAR_posthog_key` and `NEXT_PUBLIC_POSTHOG_KEY`. Nothing to do by hand.
3. **`posthog-logs` Workers Observability destination** (⚠️ **manual**) —
   Cloudflare Dashboard → Workers & Pages → Observability → Telemetry →
   `posthog-logs` → update the `Authorization: Bearer <phc_…>` header. Neither
   Terraform nor Doppler can reach this: there is a Cloudflare API for
   observability destinations, but the Terraform resource
   (`cloudflare_workers_observability_destination`) is currently
   [unimplemented](https://github.com/cloudflare/terraform-provider-cloudflare/issues/7127),
   and it is not a Worker secret or Pages var that the manual GitHub sync
   manages.

This destination is referenced by `workers/recipe-api/wrangler.toml`
(`[observability.logs]`). In practice, the public `phc_` project key rarely
rotates, which is why the manual step is an acceptable trade-off — but it is the
one to remember.
