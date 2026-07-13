# Secrets and Configuration

This repo uses Doppler as the source of truth for both secrets and deploy-time
configuration. Non-secret values such as `RECIPE_API_URL`,
`CF_PAGES_HOST`, and `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` belong in Doppler too
when they are needed by CI/CD or runtime builds. Mark those values unmasked in
Doppler so the manual GitHub sync script publishes them as GitHub Actions
variables instead of encrypted secrets.

GitHub Actions secrets are write-only through GitHub's API. They can be listed,
but their values cannot be fetched back out with `gh`. Use the migration
workflow in `.github/workflows/migrate-github-env-to-doppler.yml` only with
short-lived Doppler read/write service tokens, then revoke those tokens.

## Doppler Project

The Doppler project is `personal-site`. It covers the monorepo because the
current personal site, recipe site, asset tracker, Pages Functions, Worker, and
Terraform all ship as one deployed system.

Split into separate Doppler projects only when ownership, access control,
rotation cadence, or deployability diverge. Until then, separate configs inside
one project give enough structure without fragmenting the setup.

## Config Layout

Configs are split by environment and runtime/control boundary:

| Config | Purpose | GitHub target |
| --- | --- | --- |
| `dev_pages_env` | Shared local Cloudflare Pages env vars | None |
| `dev_recipe_api` | Local recipe Worker/API/DB/OAuth config | None |
| `dev_infra` | Local Terraform/provider credentials | None |
| `dev_bootstrap_infra` | Local bootstrap Terraform credentials | None |
| `stg_pages_env` | Shared PR preview Cloudflare Pages env vars | `preview-site-ui` |
| `stg_site_ui` | PR preview UI deploy credentials | `preview-site-ui` |
| `stg_recipe_api` | PR preview Worker/API automation config | `preview-recipe-api` |
| `prd_pages_env` | Shared production Cloudflare Pages env vars | `production-site-ui` |
| `prd_site_ui` | Production UI deploy credentials | `production-site-ui`, `production-recipe-api`, `production-recipe-ingest` |
| `prd_recipe_api` | Production Worker/API/DB/OAuth config | `production-recipe-api` |
| `prd_recipe_ingest` | Production recipe ingest Worker LLM config | `production-recipe-ingest` |
| `prd_infra` | Production Terraform/provider credentials | `production-infra` |
| `prd_bootstrap_infra` | Production bootstrap Terraform credentials | `production-infra-bootstrap` |
| `prd_database_backup` | Encrypted Neon-to-R2 backup credentials and public encryption recipient | `production-database-backup` |
| `prd_ci_repo` | Repo-wide sensitive CI like AI review and DVC | `production-ci` |

Doppler config inheritance is not available on this workspace plan, so local
full-stack dev uses nested `doppler run` calls instead of duplicating values
into a composite config.

`dev_personal` is a locked legacy catch-all config kept only as a migration
reference. The repo should not depend on it.

## Pages Functions

Pages Functions use the Cloudflare Pages project environment. There is no
separate OAuth secret needed by Pages Functions today.

The source of truth for deployed Pages Functions config is the matching
`*_site_ui` Doppler config. Terraform reads related values from `dev_pages_env`
locally, but Terraform is not the owner of the values.

Current Pages Function config:

- `RECIPE_API_URL` - production Worker origin override
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE` - maps PR aliases to preview Workers
- `CF_PAGES_HOST` - recognizes canonical PR aliases
- `POSTHOG_API_HOST` - optional PostHog ingest proxy override
- `POSTHOG_ASSETS_HOST` - optional PostHog assets proxy override

OAuth provider secrets and `BETTER_AUTH_SECRET` belong to the recipe Worker
configs, not the Pages UI/Functions configs.

PostHog browser analytics uses `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST` at build time. Those are not high-sensitivity
secrets, but they can still live in Doppler as unmasked config and sync to
GitHub variables through `scripts/sync-doppler-github-envs.sh`.

## Naming Rules

Prefer exact environment variable names consumed by code and tools.

Exception: GitHub Actions does not allow secret names beginning with
`GITHUB_`, so GitHub-targeted configs should use:

- `OAUTH_CLIENT_ID_GITHUB`
- `OAUTH_CLIENT_SECRET_GITHUB`

Workflows map those names to the Worker runtime names:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Google OAuth can use runtime names directly:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Local Development

Start the full local stack with:

```bash
mise run //:dev
```

The root task injects both local runtime configs:

```bash
doppler run --project personal-site --config dev_pages_env -- \
  doppler run --project personal-site --config dev_recipe_api -- ...
```

`workers/recipe-api/scripts/dev.sh` maps `DATABASE_URL` to
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` so Wrangler can
emulate Hyperdrive without a `.dev.vars` file.

Required local Worker values in `dev_recipe_api`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Terraform

Run Terraform through mise:

```bash
mise run //infra:plan
mise run //infra:apply
mise run //infra-bootstrap:plan
mise run //infra-bootstrap:apply
```

Normal infra tasks inject both `dev_pages_env` and `dev_infra` locally.
Bootstrap infra tasks inject `dev_bootstrap_infra`. The wrappers map readable
Doppler names to Terraform's expected names, including
`TF_TOKEN_app_terraform_io` and `TF_VAR_*`.

`dev_pages_env` owns Pages runtime values that Terraform applies to Cloudflare
Pages:

- `RECIPE_API_URL`
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE`
- `CF_PAGES_HOST`
- `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY`
- `POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_HOST`
- `CF_IMAGES_ACCOUNT_HASH` / `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`

`dev_infra` owns normal provider credentials. Terraform should not receive UI
deploy credentials or privileged GCP credentials:

- `CLOUDFLARE_API_TOKEN`
- `GITHUB_TOKEN` or `MISE_GITHUB_TOKEN`
- `TF_API_TOKEN`
- `NEON_API_KEY`
- `NEON_ORG_ID`
- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID` (unmasked; syncs to a GitHub Actions variable)

`dev_bootstrap_infra` owns foundational IAM and identity bootstrap credentials:

- `GCP_PROJECT_ID` (unmasked)
- `GCP_WORKLOAD_IDENTITY_PROVIDER` (unmasked)
- `GCP_TERRAFORM_SERVICE_ACCOUNT` (unmasked)
- `TF_API_TOKEN`

## GitHub Environments

The GitHub environments are runtime/job boundaries, not provider names:

| GitHub environment | Doppler configs | Used by |
| --- | --- | --- |
| `preview-recipe-api` | `stg_recipe_api` | PR preview Worker/database jobs and preview cleanup |
| `preview-site-ui` | `stg_site_ui`, `stg_pages_env` | PR preview Pages build/deploy and preview comment |
| `production-recipe-api` | `prd_recipe_api`, `prd_site_ui` | Production recipe API deploy |
| `production-recipe-ingest` | `prd_recipe_ingest`, `prd_site_ui` | Production recipe ingest Worker deploy |
| `production-site-ui` | `prd_site_ui`, `prd_pages_env` | Production UI CI/CD and Cloudflare Images health check |
| `production-infra` | `prd_infra` | Terraform CI/CD |
| `production-infra-bootstrap` | `prd_bootstrap_infra` | Manual bootstrap Terraform |
| `production-database-backup` | `prd_database_backup` | Scheduled encrypted Neon backup |
| `production-ci` | `prd_ci_repo` | AI review and ML pipeline CI |

Run `scripts/sync-doppler-github-envs.sh` after any Doppler change that should
reach GitHub Actions. The script reads Doppler visibility metadata: unmasked
values become GitHub environment variables, while masked/restricted values
become GitHub environment secrets.

## Preview Values

`stg_recipe_api` should own:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEON_API_KEY`
- `PREVIEW_AUTH_SEED`
- `CLOUDFLARE_PAGES_HOST`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `NEON_PROJECT_ID`

`stg_pages_env` should own preview UI build/runtime config:

- `CF_IMAGES_ACCOUNT_HASH`
- `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
- `CLOUDFLARE_PAGES_HOST`
- `CF_PAGES_HOST`
- `RECIPE_API_URL`
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE`
- `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` if preview analytics are enabled
- `POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_HOST` if preview analytics are enabled

`stg_site_ui` should own preview UI deploy credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The preview workflow derives per-PR `BETTER_AUTH_SECRET`,
`PREVIEW_AUTH_PASSWORD`, and `DATABASE_URL`, then uploads those to the isolated
preview Workers with `--secrets-file`. `stg_recipe_api` also supplies a
spend-limited `OPENROUTER_API_KEY` so recipe imports can be QA'd end to end.

## Production Values

`prd_recipe_api` should own:

- `BETTER_AUTH_SECRET`
- `NEON_DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OAUTH_CLIENT_ID_GITHUB`
- `OAUTH_CLIENT_SECRET_GITHUB`

`prd_recipe_ingest` should own:

- `OPENROUTER_API_KEY`

`prd_pages_env` should own production UI build/runtime config:

- `CF_IMAGES_ACCOUNT_HASH`
- `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
- `POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `RECIPE_API_URL`
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE`
- `CF_PAGES_HOST`

`prd_site_ui` should own production UI deploy credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The sync script also includes `prd_site_ui` when publishing
`production-recipe-api` and `production-recipe-ingest`, so Worker deploy jobs
reuse the shared Cloudflare deploy token without duplicating it into each
runtime-specific Doppler config.

`prd_infra` should own:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_IMAGES_ACCOUNT_HASH`
- `POSTHOG_KEY`
- `MISE_GITHUB_TOKEN`
- `NEON_API_KEY`
- `NEON_ORG_ID`
- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID` (unmasked; syncs to a GitHub Actions variable)
- `TF_API_TOKEN`

`prd_bootstrap_infra` should own:

- `GCP_PROJECT_ID` (unmasked)
- `GCP_WORKLOAD_IDENTITY_PROVIDER` (unmasked)
- `GCP_TERRAFORM_SERVICE_ACCOUNT` (unmasked)
- `TF_API_TOKEN`

`prd_database_backup` should own:

- `AGE_RECIPIENT` (unmasked; public age recipient, never the private identity)
- `CLOUDFLARE_ACCOUNT_ID` (unmasked)
- `NEON_DATABASE_URL_UNPOOLED`
- `R2_ACCESS_KEY_ID`
- `R2_DATABASE_BACKUPS_BUCKET_NAME` (unmasked)
- `R2_SECRET_ACCESS_KEY`

The Neon URL should use a dedicated read-only backup role and the direct,
unpooled endpoint. Scope the R2 Object Read & Write token to only the database
backup bucket. The private age identity must not be stored in Doppler or GitHub;
keep it in a password manager plus a separate recovery copy.

`prd_ci_repo` should own:

- `OPENROUTER_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

This OpenRouter key is for repo-wide CI, such as AI review and ML pipeline
jobs. Recipe ingestion uses the separate key in `prd_recipe_ingest` so its
budget and limits can be managed independently.

## QA Commands

These commands validate the wiring without printing secret values:

```bash
doppler secrets --project personal-site --config dev_pages_env --only-names
doppler secrets --project personal-site --config dev_recipe_api --only-names
doppler secrets --project personal-site --config dev_infra --only-names
doppler secrets --project personal-site --config dev_bootstrap_infra --only-names
doppler secrets --project personal-site --config prd_database_backup --only-names
scripts/sync-doppler-github-envs.sh

mise run //:dev
mise run //infra:format:check
mise run //infra:precommit-lint
mise run //infra-bootstrap:format:check
mise run //infra-bootstrap:precommit-lint
CI=true mise run //workers/recipe-api:typecheck
doppler run --project personal-site --config dev_recipe_api -- mise x -- pnpm --dir workers/recipe-api exec wrangler deploy --dry-run
```
