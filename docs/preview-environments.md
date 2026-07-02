# PR preview environments

Internal pull requests receive a coordinated preview stack:

```text
https://pr-<number>.<pages-host>
  -> Pages Function auth proxy
  -> recipe-api-pr-<number> Worker
  -> preview-pr-<number> Neon branch
```

The Neon branch is created with a schema-only copy of the project's primary
branch. It copies the structure but none of the rows, so it is technically an
independent root branch rather than a child (see [Neon Free plan
constraints](#neon-free-plan-constraints) below). Production rows, Better Auth
sessions, OAuth tokens, and private recipes are therefore never copied into a
preview. The workflow pushes the PR schema and adds deterministic QA fixtures.

The branch and Worker survive updates to the PR so QA state is preserved. They
are deleted when the PR closes. Neon also expires the branch after 30 days as a
backstop; pushing another commit recreates an expired branch.

Fork pull requests do not receive preview infrastructure. The workflow uses
`pull_request_target` so its privileged control flow always comes from the
default branch, then explicitly checks out the internal PR commit. Only
preview-scoped credentials should be stored in the preview environment because
the deployed application code is still the PR's code.

## Operational setup & runbook

This environment is already provisioned. The steps below are retained as a
recovery and rotation runbook — how to recreate the GitHub environment, rotate
the scoped credentials, and rebuild the Cloudflare Access application. These
pieces are configured out of band; their sensitive values are not stored in the
repository (the Terraform configuration itself is, under `infra/`).

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

- **Account -> Workers Scripts -> Edit** (deploy/delete the preview Worker and
  upload its secrets)
- **Account -> Cloudflare Pages -> Edit** (deploy the canonical PR Pages alias)

Scope it to this Cloudflare account. Cloudflare's Pages permission is
account-level only and cannot be narrowed to the `personal-site` project, so
account scope is the tightest available. Do not reuse a global or DNS-capable
production token.

### 4. Create the GitHub environments

Create GitHub environments named `preview-recipe-api` and `preview-site-ui`.
Populate them from Doppler by running `scripts/sync-doppler-github-envs.sh`;
do not use the Doppler GitHub sync integration on the free plan.

`preview-recipe-api` receives values from `stg_recipe_api`.

`preview-recipe-api` receives these environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Least-privilege preview deployment token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing Pages and Workers |
| `NEON_API_KEY` | Creates and deletes preview branches |
| `PREVIEW_AUTH_SEED` | Derives stable, per-PR Better Auth secrets and test passwords |

Generate `PREVIEW_AUTH_SEED` locally and paste the output directly into GitHub:

```bash
openssl rand -base64 48
```

`preview-recipe-api` receives these environment variables:

| Variable | Example |
| --- | --- |
| `NEON_PROJECT_ID` | Neon project ID from project settings |
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

`NEON_API_KEY` is a **project-scoped** key for the `recipes` project (Neon
Console -> organization -> Settings -> API keys -> Create API key ->
Project-scoped), so it can manage branches in that project and nothing else.
Keep it in the `preview-recipe-api` environment only and rotate it if GitHub
reports any exposure.

`POSTHOG_KEY` and `POSTHOG_HOST` are currently omitted, so previews run without
analytics. The UI build only requires `CF_IMAGES_ACCOUNT_HASH`; the PostHog
client no-ops when its key is unset.

### 5. Smoke-test a preview

To validate the pipeline (after recreating any of the above, or when debugging),
open or update an internal PR — the workflow runs from `main`. Confirm:

1. The PR receives one `Preview environment` comment.
2. Neon contains `preview-pr-<number>` and it has no production rows.
3. Cloudflare contains `recipe-api-pr-<number>` with no Hyperdrive binding.
4. The canonical `https://pr-<number>.<pages-host>` URL requires Access.
5. The sign-in menu offers the empty, populated, and administrator scenarios.
6. Closing the PR removes both the Neon branch and Worker.

If event-driven cleanup fails, run the **Preview Environment Cleanup** workflow
manually with the PR number. Neon branch expiry is an additional database-only
backstop.

## Runtime safeguards

- Preview Workers use direct pooled Neon URLs and never receive the production
  Hyperdrive binding.
- OAuth providers are disabled in preview.
- Public email/password endpoints return `404`.
- The scenario login exists only when `DEPLOYMENT_ENV=preview`.
- Scenario login requires a valid Access JWT and accepts only compiled-in IDs.
- The browser never receives the generated test password.
- Preview secrets are derived independently per PR and uploaded atomically with
  the Worker version.

## Adding QA scenarios

Add the scenario to
`workers/recipe-api/src/preview-scenarios.ts` and its deterministic domain data
to `workers/recipe-api/scripts/seed-preview.ts`. Seeds must be idempotent and
must not erase QA changes on subsequent pushes.

## Neon Free plan constraints

The preview branch is a schema-only branch, which Neon implements as an
independent **root branch**. The Free plan permits only **3 root branches per
project**, and the project's `main` branch consumes one. Previews therefore
support at most **two concurrent internal PRs**; a third preview branch fails
with `ROOT_BRANCHES_LIMIT_EXCEEDED` until an open preview closes. Upgrading to a
paid plan (Launch allows 5 root branches) raises this ceiling.

Scale-to-zero is fixed at 5 minutes on the Free plan and cannot be configured.
The Neon branch action must not pass `suspend_timeout`; any explicit value is
rejected with `412 Precondition Failed`.

## Known follow-up: committed migrations

The workflow currently uses `drizzle-kit push`, matching production. Before
multiple schema-changing PRs become common, adopt committed Drizzle migrations
and baseline the existing production schema. Do not simply run an initial
generated migration against production: the tables already exist and the
migration journal must first be baselined safely.
