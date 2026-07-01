# Secrets and Configuration

This repo uses Doppler as the source of truth for both secrets and deploy-time
configuration. Non-secret values such as `RECIPE_API_URL`,
`CF_PAGES_HOST`, and `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` belong in Doppler too
when they are needed by CI/CD or runtime builds. Mark those values unmasked in
Doppler so GitHub sync integrations can publish them as GitHub Actions
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
| `stg_pages_env` | Shared PR preview Cloudflare Pages env vars | Future `preview-pages-env` or `preview` |
| `stg_site_ui` | PR preview UI workflow/deploy-only config | Future `preview-site-ui` or `preview` |
| `stg_recipe_api` | PR preview Worker/API automation config | Future `preview-recipe-api` or `preview` |
| `prd_pages_env` | Shared production Cloudflare Pages env vars | Future `production-pages-env` or `production` |
| `prd_site_ui` | Production UI workflow/deploy-only config | Future `production-site-ui` or `production` |
| `prd_recipe_api` | Production Worker/API/DB/OAuth config | Future `production-recipe-api` or `production` |
| `prd_infra` | Production Terraform/provider credentials | Future `production-infra` |
| `prd_ci_repo` | Repo-wide sensitive CI like AI review and DVC | Future `ci` |

Doppler config inheritance is not available on this workspace plan, so local
full-stack dev uses nested `doppler run` calls instead of duplicating values
into a composite config.

`dev_personal` is a locked legacy catch-all config kept only as a migration
reference. The repo should not depend on it.

## Pages Functions

Pages Functions use the Cloudflare Pages project environment. There is no
separate OAuth secret needed by Pages Functions today.

The source of truth for Pages Functions config is the matching `*_pages_env`
Doppler config. Terraform reads those same values when it applies the
Cloudflare Pages project, but Terraform is not the owner of the values. UI
build/deploy workflows should layer `*_pages_env` with `*_site_ui` only for
deployed environments that need Cloudflare deploy credentials.

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
GitHub variables.

## Naming Rules

Prefer exact environment variable names consumed by code and tools.

Exception: GitHub Actions does not allow secret names beginning with
`GITHUB_`, so GitHub-synced configs should use:

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
```

Terraform tasks inject both `dev_pages_env` and `dev_infra` locally. The wrapper
maps readable Doppler names to Terraform's expected names, including
`TF_TOKEN_app_terraform_io` and `TF_VAR_*`.

`dev_pages_env` owns Pages runtime values that Terraform applies to Cloudflare
Pages:

- `RECIPE_API_URL`
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE`
- `CF_PAGES_HOST`
- `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY`
- `POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_HOST`
- `CF_IMAGES_ACCOUNT_HASH` / `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`

`dev_infra` owns provider and control-plane credentials. Terraform should not
receive UI deploy credentials:

- `CLOUDFLARE_API_TOKEN`
- `GCP_PROJECT_ID`
- `GITHUB_TOKEN` or `MISE_GITHUB_TOKEN`
- `TF_API_TOKEN`
- `NEON_API_KEY`
- `NEON_ORG_ID`
- `POSTHOG_API_KEY` or `POSTHOG_PERSONAL_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_IAC_ENABLED`

## GitHub Environments

The current GitHub environments are:

- `cloudflare-preview`
- `cloudflare-production`

Those names are historical and provider-centric. The cleaner target is either:

- broad deploy environments: `preview`, `production`, `ci`, or
- strict runtime boundaries: `preview-site-ui`, `preview-recipe-api`,
  `production-site-ui`, `production-recipe-api`, `production-infra`, `ci`.

Use strict runtime boundaries if Doppler syncs are one-config-to-one-GitHub-env.
Avoid syncing multiple Doppler configs into the same GitHub environment unless
the sync integration is explicitly configured not to delete or overwrite names
owned by another config.

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

`stg_pages_env` should own:

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
preview Worker with `--secrets-file`.

## Production Values

`prd_recipe_api` should own:

- `BETTER_AUTH_SECRET`
- `NEON_DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OAUTH_CLIENT_ID_GITHUB`
- `OAUTH_CLIENT_SECRET_GITHUB`

`prd_pages_env` should own:

- `CF_IMAGES_ACCOUNT_HASH`
- `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
- `POSTHOG_KEY`
- `POSTHOG_HOST`
- `RECIPE_API_URL`
- `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE`
- `CF_PAGES_HOST`

`prd_site_ui` should own production UI deploy credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

`prd_infra` should own:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_IMAGES_ACCOUNT_HASH`
- `POSTHOG_KEY`
- `MISE_GITHUB_TOKEN`
- `NEON_API_KEY`
- `NEON_ORG_ID`
- `POSTHOG_PERSONAL_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_IAC_ENABLED`
- `TF_API_TOKEN`

`prd_ci_repo` should own:

- `OPENROUTER_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## QA Commands

These commands validate the wiring without printing secret values:

```bash
doppler secrets --project personal-site --config dev_pages_env --only-names
doppler secrets --project personal-site --config dev_recipe_api --only-names
doppler secrets --project personal-site --config dev_infra --only-names

mise run //:dev
mise run //infra:format:check
mise run //infra:precommit-lint
CI=true mise run //workers/recipe-api:typecheck
doppler run --project personal-site --config dev_recipe_api -- mise x -- pnpm --dir workers/recipe-api exec wrangler deploy --dry-run
```
