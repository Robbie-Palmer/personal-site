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

## One-time manual setup

### 1. Apply the Terraform change

After this change reaches `main`, apply the infrastructure workspace:

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

Create a token intended only for previews. It needs the account permissions
required to deploy/delete Workers and deploy Pages projects. Scope it to this
Cloudflare account and, where Cloudflare permits, the `personal-site` Pages
project. Do not reuse a global or DNS-capable production token.

### 4. Create the GitHub environment

Create a GitHub environment named `cloudflare-preview`.

Add these environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Least-privilege preview deployment token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing Pages and Workers |
| `NEON_API_KEY` | Creates and deletes preview branches |
| `PREVIEW_AUTH_SEED` | Derives stable, per-PR Better Auth secrets and test passwords |
| `CF_IMAGES_ACCOUNT_HASH` | Required by the UI build |
| `POSTHOG_KEY` | Existing public PostHog project key, if preview analytics remain enabled |
| `POSTHOG_HOST` | Existing PostHog host, if preview analytics remain enabled |

Generate `PREVIEW_AUTH_SEED` locally and paste the output directly into GitHub:

```bash
openssl rand -base64 48
```

Add these environment variables:

| Variable | Example |
| --- | --- |
| `NEON_PROJECT_ID` | Neon project ID from project settings |
| `CLOUDFLARE_PAGES_HOST` | `personal-site-bu5.pages.dev` |
| `CF_ACCESS_TEAM_DOMAIN` | `https://your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Audience tag from the Pages preview Access application |

The Neon key currently operates at project or organization scope. Keep it in
the controller action only and rotate it if GitHub reports any exposure.

### 5. Verify the first preview

Open or update an internal PR after the workflow has landed on `main`. Confirm:

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
