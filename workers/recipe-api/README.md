# Recipe API Worker

Cloudflare Worker for recipe data and Better Auth. Browser auth requests stay
same-origin and are proxied to this Worker:

- local: Next.js rewrites `/api/auth/*` to `http://localhost:8787`
- production: the Pages Function at `functions/api/auth/[[path]].ts` proxies
  `/api/auth/*` to the deployed Worker

PR previews use an isolated Worker, an empty child branch in the dedicated Neon
preview project, and Access-protected test-user login. See the
[preview environment runbook](../../docs/preview-environments.md).

Schema changes use committed Drizzle migrations. See the
[database operations runbook](../../docs/database.md) for generation, seeding,
integration testing, content inspection, deployment, and recovery.

## Local OAuth setup

Configure local credentials in Doppler config `dev_recipe_api`. Start both the
frontend and Worker from the repository root:

```bash
mise run //:dev
```

The local public auth URL is set by the Worker `dev` script. Use these provider
callback URLs:

```text
Google: http://localhost:3000/api/auth/callback/google
GitHub: http://localhost:3000/api/auth/callback/github
```

Google permits both local and production redirect URIs on one OAuth client.
GitHub OAuth apps permit only one callback URL, so use a separate development
OAuth app and put its client ID and secret in Doppler as `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`.

## Production OAuth setup

The production public URL is configured as `BETTER_AUTH_URL` in
`wrangler.toml`. Provider callbacks are:

```text
Google: https://robbiepalmer.me/api/auth/callback/google
GitHub: https://robbiepalmer.me/api/auth/callback/github
```

Configure production provider credentials and Better Auth secret in Doppler.
See the repo [secrets runbook](../../docs/secrets.md) for the GitHub-safe
secret names mirrored into GitHub production environments.

Do not use the direct `workers.dev` URL as a provider callback. The supported
browser origins are the local frontend and the production site, where the
session cookie remains same-origin.

OAuth is intentionally disabled in PR previews. The preview workflow seeds
test scenarios and configures Better Auth's password support only for a
server-side scenario endpoint guarded by Cloudflare Access.

## Public recipe caching

Anonymous public recipe lists, discovery feeds, cook lists, and recipe details
use a 60-second shared-cache lifetime with a 300-second stale revalidation
window. Requests carrying a session cookie or authorization header use
`private, no-store`, and every recipe read varies on both headers.

The Worker has no globally scoped Cloudflare cache-purge binding. Changing a
public recipe to private or deleting it can leave the previous public API
response in a shared cache for no more than 360 seconds. Published recipes use
this explicit revocation bound. For immediate removal, purge the recipe detail,
list, discovery feed, and cook-list URLs in Cloudflare. Public recipe pages and
their `.md`, `.json`, and `.cook` variants use separate cache entries, so purge
them too when applicable.

## Household realtime

`GET /pantry/realtime` upgrades authenticated household members to the
`HouseholdRealtimeRoom` Durable Object derived from their household ID. The
outer Worker validates the same-origin request, session, and current membership
before it creates a short-lived server-authored room context. Pantry writes
still commit through HTTP and Neon; after commit, the shared mutation path
publishes the canonical pantry snapshot with its decimal revision, operation ID,
and change kind. Publication runs through `waitUntil`, outside mutation response
latency.

The Pages pantry proxy preserves the browser's same-origin WebSocket upgrade.
Local Next.js rewrites use the same path. Production and each uniquely named PR
preview Worker have separate Durable Object namespaces, so preview sockets
cannot enter production rooms. Connected browsers install newer snapshots from
the socket without another database read. Subscription, reconnect, focus, and
the existing visibility-aware repair interval still fetch the canonical pantry
to repair a missed publication.

Realtime verification is layered. Unit tests cover the room and Worker route,
the preview deployment runs `preview:smoke:realtime` with independent owner and
member sessions against the deployed Worker, and the Access-authenticated
Playwright suite covers visible two-browser convergence and reconnect recovery.

## Rate limiting

Rate limiting is layered, with counters in Postgres.

| Tier                 | Where                                           | Scope                     | Default   |
| -------------------- | ----------------------------------------------- | ------------------------- | --------- |
| Edge (broad)         | `infra/public-platform/main.tf` Cloudflare rule | Per IP, `/api/auth/*`     | 20 / 10s  |
| App auth (default)   | `src/auth.ts` Better Auth `customStorage`       | Per IP, `/api/auth/*`     | 100 / 60s |
| App auth (sign-in)   | `src/auth.ts` custom rule                       | Per IP, `/sign-in/social` | 20 / 60s  |
| Per-account (writes) | `src/index.ts` invite handler                   | Per user, invites         | 10 / hour |

The shared limiter lives in `src/http/rate-limit.ts`. It does a single
`INSERT ... ON CONFLICT` against the `app_rate_limit` table so concurrent
requests cannot race a stale counter, and it fails open if the store errors.
Exceeding any tier returns `429` with a `Retry-After`/`X-Retry-After` header.

The `app_rate_limit` table is managed by the committed Drizzle migrations like
the rest of the schema, and a daily Cron Trigger sweeps counters idle for over
24h so it stays bounded. Edge thresholds are tunable via the
`auth_rate_limit_*` Terraform variables; application thresholds live alongside
the code above.
