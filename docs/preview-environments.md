# PR preview environments

Internal pull requests receive a coordinated preview stack:

```text
https://pr-<number>.<pages-host>
  -> Pages Function auth proxy
  -> recipe-api-pr-<number> Worker
  -> recipe-ingest-pr-<number> Workflow Worker
  -> preview-pr-<number> Neon branch
  -> recipe-artifacts-preview R2 bucket (shared QA data only)
```

The Neon branch is an ordinary child of the empty `preview-base` root in a
dedicated preview project. That project has preview-only credentials and never
contains production rows, Better Auth sessions, OAuth tokens, or private
recipes. The workflow applies every committed migration to the empty branch and
then adds deterministic QA fixtures.

The database branch is deleted and recreated on every PR update so edited,
unmerged migration SQL is always exercised from zero. QA changes made in a
preview are therefore disposable between pushes. The Workers and Workflow are
redeployed to use the fresh branch and all resources are deleted when the PR
closes. Neon also expires branches after 30 days as a cleanup backstop. The
shared preview artifact bucket is persistent infrastructure and contains only
synthetic or QA data; a lifecycle rule expires objects after 30 days.

Fork pull requests do not receive preview infrastructure. The workflow uses
`pull_request` and explicitly gates every job to same-repository pull requests.
Only preview-scoped credentials are stored in the preview environment because
the deployed application code is still the PR's code.

## Operational setup & runbook

The Cloudflare and Neon resources are provisioned by Terraform. The steps below
are also the recovery and rotation runbook. Credentials are configured out of
band through Doppler; their sensitive values are not stored in the repository.

### 1. Apply the Terraform configuration

A push to `main` that touches `infra/**` applies the configuration
automatically via the `infra-cd` workflow. To apply by hand (the fallback):

```bash
mise run //infra:plan
mise run //infra:apply
```

This adds `CF_PAGES_HOST` and `RECIPE_API_PREVIEW_ORIGIN_TEMPLATE` to the Pages
Function environment. The canonical `pr-<number>` alias is required for auth;
random hash deployment URLs deliberately refuse to proxy auth to production.

### 2. Protect Pages previews with Cloudflare Access

The Cloudflare provider can manage Access applications and policies, but the
Pages-specific **Enable access policy** switch is not exposed by the
`cloudflare_pages_project` resource in provider v4.52.7. The switch is a
one-time bootstrap that creates Cloudflare's preview-aware Access application;
it protects preview aliases without also protecting the production Pages
hostname. After creation, the application and its policies can be imported
into Terraform if ongoing policy ownership in code is required.

In Cloudflare:

1. Open **Workers & Pages** -> **personal-site** -> **Settings** -> **General**.
2. Enable the preview deployment access policy.
3. In **Zero Trust** -> **Access** -> **Applications**, edit the generated Pages
   preview application.
4. Initially allow only your email address. Add QA users or an Access group
   later.
5. Record the application audience (`AUD`) tag.
6. Record the team domain, for example
   `https://your-team.cloudflareaccess.com`.

The preview Worker verifies the `Cf-Access-Jwt-Assertion` itself. Calling its
public `workers.dev` URL therefore cannot bypass Pages Access for test login.

For non-interactive agents, create a Cloudflare Access service token and add it
to the same application's policy. Automated HTTP clients supply:

```text
CF-Access-Client-Id: <service-token-client-id>
CF-Access-Client-Secret: <service-token-client-secret>
```

Do not store that service token in this repository.

### 3. Create a least-privilege Cloudflare token

Create a token intended only for previews, with exactly these account-scoped
permissions:

- **Account -> Workers Scripts -> Edit** (deploy/delete preview Workers and
  upload their secrets)
- **Account -> Workers R2 Storage -> Read** (let Wrangler validate the shared
  preview bucket while deploying its binding)
- **Account -> Cloudflare Pages -> Edit** (deploy the canonical PR Pages alias)

Scope it to this Cloudflare account. Cloudflare's Pages permission is
account-level only and cannot be narrowed to the `personal-site` project, so
account scope is the tightest available. Do not reuse a global or DNS-capable
production token.

The preview token does not need R2 write or administration permission:
Terraform owns the shared preview bucket. Wrangler does read the bucket while
validating the Worker binding at deployment time, which is why read access is
required. Workflows are deployed as part of a Worker script, so there is no
separate Workflow token permission.

After Terraform first creates `recipe-artifacts-preview`, configure its object
expiry rule using an administrator's local Wrangler session. Cloudflare provider
v4 can create R2 buckets but cannot manage lifecycle rules:

```bash
cd workers/recipe-ingest
mise x -- pnpm exec wrangler r2 bucket lifecycle add \
  recipe-artifacts-preview expire-preview-artifacts \
  --expire-days 30 --abort-multipart-days 1 --force
```

### 4. Provision the dedicated Neon preview project

Terraform creates a separate `recipes-preview` Neon project; previews must not
reuse the production `recipes` project. Apply the infrastructure configuration
as described in step 1, then publish its outputs to Doppler:

1. Set `NEON_PROJECT_ID` in `stg_recipe_api` from the
   `neon_preview_project_id` output, with unmasked visibility.
2. Set masked `NEON_API_KEY` in `stg_recipe_api` from the sensitive
   `neon_preview_api_key` output.
3. Run `scripts/sync-doppler-github-envs.sh` to update the GitHub environment.

The Terraform resource creates the empty `preview-base` root, a `recipes`
database owned by `recipes_owner`, and the project-scoped API key. Do not add
application tables or a `drizzle.__drizzle_migrations` table to the root.

Every PR database is a normal child branch of `preview-base`. Ordinary child
branches use the project's general branch allowance and inherit only this empty
preview state. Keeping the preview root and credentials in a separate project
also prevents a preview Worker or workflow from connecting to production.

### 5. Create the GitHub environments

Create GitHub environments named `preview-recipe-api` and `preview-site-ui`.
Populate them from Doppler by running `scripts/sync-doppler-github-envs.sh`;
do not use the Doppler GitHub sync integration on the free plan.

`preview-recipe-api` receives values from `stg_recipe_api`.

`preview-recipe-api` receives these environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Least-privilege preview deployment token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing Pages and Workers |
| `NEON_API_KEY` | Project-scoped key for the dedicated preview Neon project |
| `PREVIEW_AUTH_SEED` | Derives stable, per-PR Better Auth secrets and test passwords |
| `OPENROUTER_API_KEY` | Preview-only key for end-to-end recipe import QA |

Generate `PREVIEW_AUTH_SEED` locally and paste the output directly into GitHub:

```bash
openssl rand -base64 48
```

`preview-recipe-api` receives these environment variables:

| Variable | Example |
| --- | --- |
| `NEON_PROJECT_ID` | Dedicated preview project ID from Neon settings |
| `CLOUDFLARE_PAGES_HOST` | `personal-site-bu5.pages.dev` |
| `CF_ACCESS_TEAM_DOMAIN` | `https://your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Audience tag from the Pages preview Access application |

`preview-site-ui` receives values from `stg_site_ui` and `stg_pages_env`.

`preview-site-ui` receives these environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Least-privilege preview deployment token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing Pages and Workers |

`preview-site-ui` receives these environment variables:

| Variable | Purpose |
| --- | --- |
| `CF_IMAGES_ACCOUNT_HASH` | Required by the UI build |
| `CLOUDFLARE_PAGES_HOST` | Used when commenting the canonical preview URL |
| `POSTHOG_KEY` | Existing public PostHog project key, if preview analytics remain enabled |
| `POSTHOG_HOST` | Existing PostHog host, if preview analytics remain enabled |

`NEON_API_KEY` is a **project-scoped** key for the dedicated preview project (Neon
Console -> organization -> Settings -> API keys -> Create API key ->
Project-scoped), so it can manage branches in that project and nothing else.
Keep it in the `preview-recipe-api` environment only and rotate it if GitHub
reports any exposure.

`POSTHOG_KEY` and `POSTHOG_HOST` are currently omitted, so previews run without
browser analytics. The UI build only requires `CF_IMAGES_ACCOUNT_HASH`; the
PostHog client no-ops when its key is unset. Preview API and ingestion Worker
logs are still retained in Cloudflare Workers Logs and exported through the
account-level `posthog-logs` observability destination.

### 6. Smoke-test a preview

To validate the pipeline (after recreating any of the above, or when debugging),
open or update an internal PR — the workflow runs from `main`. Confirm:

1. The PR receives one `Preview environment` comment.
2. The dedicated Neon preview project contains `preview-pr-<number>` as a child
   of `preview-base`, with no production rows.
3. Cloudflare contains `recipe-api-pr-<number>` with no Hyperdrive binding.
4. The canonical `https://pr-<number>.<pages-host>` URL requires Access.
5. The sign-in menu offers the empty, populated, and administrator scenarios.
6. The onboarding sign-up button creates a new empty QA account on every use.
7. Closing the PR removes both the Neon branch and Worker.

If event-driven cleanup fails, run the **Preview Environment Cleanup** workflow
manually with the PR number. Neon branch expiry is an additional database-only
backstop.

## Runtime safeguards

- Preview Workers use direct pooled Neon URLs and never receive the production
  Hyperdrive binding.
- OAuth providers are disabled in preview.
- Public email/password endpoints return `404`.
- The scenario login exists only when `DEPLOYMENT_ENV=preview`.
- Fresh QA sign-up exists only in previews, requires Access, and creates an
  isolated account so onboarding can be repeated without resetting fixtures.
- Scenario login requires a valid Access JWT and accepts only compiled-in IDs.
- The browser never receives the generated test password.
- Preview secrets are derived independently per PR and uploaded atomically with
  the Worker version.

## Adding QA scenarios

Add the scenario to
`workers/recipe-api/src/preview-scenarios.ts` and its deterministic domain data
to `workers/recipe-api/scripts/seed-preview.ts`. Seeds must be idempotent and
safe to retry within one workflow run. A new push deliberately replaces the
database and any manual QA changes in it.

## Neon Free plan constraints

The dedicated preview project uses one root branch, `preview-base`, and ordinary
child branches for PRs. Neon's current Free plan allows 10 branches per project,
so the project supports up to nine simultaneous PR databases when it contains
no other branches. This avoids the three-root-branch limit that constrained the
previous schema-only design to two concurrent previews.

Scale-to-zero is fixed at 5 minutes on the Free plan and cannot be configured.
Leave the Neon branch action's `suspend_timeout` input unset. The action then
forwards its default `0` sentinel so Neon uses the project's fixed setting;
positive overrides such as `300` are rejected with `412 Precondition Failed`.

## Database migrations

Schema changes use committed Drizzle migrations. Every preview branch starts
without application objects or migration history, so `drizzle-kit migrate`
applies the complete history beginning with the strict `0000_baseline.sql`.
The branch is recreated on every PR update; this is important because migration
files can still be edited before they reach `main`.

Once a migration reaches `main`, it is append-only. A missing table, column, or
constraint must fail deployment rather than being silently ignored.
