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
9. **`POSTHOG_API_KEY`**
   - Create at: PostHog → Settings → Personal API keys
   - Required scopes:
     - `dashboard:read`
     - `dashboard:write`
     - `insight:read`
     - `insight:write`
   - Used by the PostHog Terraform provider
10. **`POSTHOG_PROJECT_ID`**
    - Find in the PostHog project/environment settings or API URLs
    - Passed as `TF_VAR_posthog_project_id`
    - Mark unmasked in Doppler so the GitHub sync publishes it as an Actions
      variable, not a secret. Terraform requires a non-empty value and has no
      production default.
11. **`GCP_PROJECT_ID`**
    - GCP project ID backing the recipe site's Google OAuth.
    - Passed as `TF_VAR_gcp_project_id`.
    - Mark unmasked in Doppler so the GitHub sync publishes it as an Actions
      variable, not a secret.
12. **`GCP_WORKLOAD_IDENTITY_PROVIDER`**
    - Full Workload Identity Provider resource name from Terraform output
      `gcp_workload_identity_provider`.
    - GitHub environment variable, not a secret.
13. **`GCP_TERRAFORM_SERVICE_ACCOUNT`**
    - Service account email from Terraform output
      `gcp_terraform_service_account_email`.
    - GitHub environment variable, not a secret.

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

Credentials are sourced from Doppler, the same single source of truth CI uses.
Run Terraform through mise; `infra/scripts/doppler-terraform-env` injects
`dev_pages_env` and `dev_infra`, then maps readable Doppler names to
Terraform's expected `TF_VAR_*` and provider environment variables. A local
`.env` file is no longer required for normal development.

Then run Terraform commands via mise:

- `mise run //infra:plan` - Preview changes
- `mise run //infra:apply` - Apply changes

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

## PostHog

PostHog dashboards and insights are managed in Terraform via the official
`PostHog/posthog` provider. The live project inventory is captured in
`posthog_resources.json`, with `posthog.tf` converting that data into
Terraform-managed dashboard and insight resources.

### Managed PostHog Resources

- Existing dashboards in project `123162`
- Existing insights in project `123162`, including their dashboard attachments

### Importing PostHog Resources

The dashboards and insights in `posthog_resources.json` have already been
imported into Terraform Cloud state. For future resources, add the resource to
`posthog_resources.json`, import it once, then commit the updated inventory:

```bash
terraform import 'posthog_dashboard.managed["<stable-key>"]' '<project-id>/<dashboard-id>'
terraform import 'posthog_insight.managed["<stable-key>"]' '<project-id>/<insight-id>'
```

After import, `mise run //infra:plan` should show no PostHog changes. Do not
edit managed dashboards or insights in the PostHog UI without also updating
`posthog_resources.json`, because Terraform will treat that as drift.

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

## Google Cloud

The recipe site's Google OAuth lives in a GCP project. Terraform manages the
project and its enabled APIs via the `hashicorp/google` provider.

### Managed in Terraform

- `google_project.recipes` — the project itself (imported, `prevent_destroy`)
- `google_project_service.required` — APIs needed for Terraform-managed IAM and
  Workload Identity Federation
- `google_service_account.github_terraform` — service account impersonated by
  GitHub Actions
- `google_iam_workload_identity_pool.*` — GitHub Actions OIDC trust
- `google_project_iam_member.github_terraform` — project-level IAM for the
  Terraform service account
- `google_service_account_iam_member.github_actions_workload_identity_user` —
  repository permission to impersonate the Terraform service account

### Intentionally manual (not in Terraform)

The **OAuth consent screen** and the **OAuth 2.0 client** (client ID + secret)
are configured by hand in the Cloud console. They have no usable Terraform
resource — the only options (`google_iap_brand`, `google_iap_client`) are
IAP-only and built on a deprecated API. The client ID/secret are consumed by
the app as configuration, not provisioned here.

### Credentials

The `google` provider needs credentials, supplied separately from the
Cloudflare/Neon tokens:

- **Local:** install the [gcloud CLI](https://cloud.google.com/sdk/docs/install)
  (e.g. `brew install --cask gcloud-cli`), then
  `gcloud auth login --update-adc`. The `--update-adc` flag writes
  application-default credentials for Terraform while also selecting an active
  `gcloud` account for bootstrap commands like `gcloud services enable`.
- **CI (GitHub Actions):** runs execute on the runner, not in Terraform Cloud
  ([ADR 017](/projects/personal-site/adrs/017-terraform-cloud) — TFC is
  state-only, `execution_mode = local`). CI uses **keyless** auth via GitHub
  OIDC and
  [Workload Identity Federation](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account):
  no long-lived key to store, sync, or rotate. Terraform creates the GitHub
  Workload Identity Pool, provider, and impersonated service account.

This is independent of where state lives, so it survives a future migration to
the R2 backend (ADR 017's escape hatch) unchanged.

### GitHub Actions Auth

Install and authenticate local Google credentials before running Terraform
against GCP:

```bash
brew install --cask gcloud-cli
gcloud auth login --update-adc
gcloud config set project <project-id>
```

The GitHub `production-infra` environment reads these unmasked variables from
Doppler `prd_infra`:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_TERRAFORM_SERVICE_ACCOUNT`

The two WIF values come from Terraform outputs:

```bash
cd infra
terraform output -raw gcp_workload_identity_provider
terraform output -raw gcp_terraform_service_account_email
```

### Importing

1. `gcloud auth login --update-adc` and set `gcp_project_id` (in
   `terraform.tfvars` or `TF_VAR_gcp_project_id`).
2. Add application APIs to `google.tf` as `google_project_service` resources
   when Terraform should own them.
3. `mise run //infra:plan` and confirm the import shows no destructive changes.
