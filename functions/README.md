# Cloudflare Pages Functions

This directory contains [Cloudflare Pages Functions][pages-functions] -
serverless functions that run at the edge alongside the static site.

Cloudflare Pages automatically detects and deploys functions from this
directory. No additional configuration is required.

## Functions

### `/api/auth/*` - Recipe Authentication Proxy

**File:** `api/auth/[[path]].ts`

Proxies same-origin Better Auth requests to the recipe API Worker. Keeping the
browser-facing auth URL on `robbiepalmer.me` means OAuth callbacks and session
cookies use the site origin even though the auth handler runs in a separate
Worker. `RECIPE_API_URL` can override the deployed Worker URL.

### `_middleware.ts` - Markdown Content Negotiation

Serves each page's agent-friendly Markdown twin from its canonical URL
when the client requests `Accept: text/markdown`, or has an agent/CLI user
agent without asking for HTML. Browsers are unaffected. Agents can also
fetch Markdown explicitly by appending `.md` to any page URL, or start
from the index at `/llms.txt`.

### `/ingest/*` - PostHog Reverse Proxy

**File:** `ingest/[[path]].ts`

Proxies analytics requests to PostHog's EU servers. This allows the site to
send analytics through our own domain (`/ingest/*`) rather than directly to
`posthog.com`, which helps avoid ad blockers.

Routes:

- `/ingest/static/*` → `https://eu-assets.i.posthog.com/static/*`
  (JS assets, session recording code)
- `/ingest/*` → `https://eu.i.posthog.com/*` (event ingestion API)

The client-side PostHog initialization in `ui/instrumentation-client.ts` uses
`api_host: "/ingest"` to send requests through this proxy.

**Environment Variables (optional, for testing):**

- `POSTHOG_API_HOST` - Override the API endpoint
  (default: `https://eu.i.posthog.com`)
- `POSTHOG_ASSETS_HOST` - Override the assets endpoint
  (default: `https://eu-assets.i.posthog.com`)

## Future Migration

When migrating to Cloudflare Workers (for SSR support, subdomain routing,
etc.), delete this directory and add equivalent routes in the Worker
configuration. The proxy logic is nearly identical.

[pages-functions]: https://developers.cloudflare.com/pages/functions/
