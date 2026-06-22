# Recipe API Worker

Cloudflare Worker for recipe data and Better Auth. Browser auth requests stay
same-origin and are proxied to this Worker:

- local: Next.js rewrites `/api/auth/*` to `http://localhost:8787`
- production: the Pages Function at `functions/api/auth/[[path]].ts` proxies
  `/api/auth/*` to the deployed Worker

PR previews use an isolated Worker, schema-only Neon branch, and
Access-protected test-user login. See the
[preview environment runbook](../../docs/preview-environments.md).

## Local OAuth setup

Copy `.dev.vars.example` to `.dev.vars` and fill in the credentials. The file is
ignored by git. Start both the frontend and Worker from the repository root:

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
OAuth app and put its client ID and secret in `.dev.vars`.

## Production OAuth setup

The production public URL is configured as `BETTER_AUTH_URL` in
`wrangler.toml`. Provider callbacks are:

```text
Google: https://robbiepalmer.me/api/auth/callback/google
GitHub: https://robbiepalmer.me/api/auth/callback/github
```

Configure the production provider credentials and Better Auth secret as Worker
secrets using the interactive command, once for each secret name:

```bash
pnpm --filter recipe-api exec wrangler secret put GOOGLE_CLIENT_ID
pnpm --filter recipe-api exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm --filter recipe-api exec wrangler secret put GITHUB_CLIENT_ID
pnpm --filter recipe-api exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm --filter recipe-api exec wrangler secret put BETTER_AUTH_SECRET
```

Do not use the direct `workers.dev` URL as a provider callback. The supported
browser origins are the local frontend and the production site, where the
session cookie remains same-origin.

OAuth is intentionally disabled in PR previews. The preview workflow seeds
test scenarios and configures Better Auth's password support only for a
server-side scenario endpoint guarded by Cloudflare Access.
