# Work Graph API

This Cloudflare Worker exposes the Work Graph REST contract from
`openapi.json`. Production traffic reaches it only through
`https://work-graph.robbiepalmer.me`, which Cloudflare Access protects with a
Service Auth policy. The Wrangler config disables `workers.dev` and preview
URLs.

## Local development

Create Doppler config `work-graph/dev_work_graph` with `DATABASE_URL`, then
run:

```bash
mise run //workers/work-graph-api:dev
```

The dev helper maps `DATABASE_URL` to Wrangler's local `HYPERDRIVE` connection
string. `.dev.vars.example` documents the fallback for a local PostgreSQL
instance. Never put a Neon URL in a committed Wrangler file.

## Production deployment

Provision the dependencies first by following
[`infra/work-graph/README.md`](../../infra/work-graph/README.md). Then sync
Doppler config `prd_work_graph` into the `production-work-graph` GitHub
environment:

```bash
scripts/sync-doppler-github-envs.sh production-work-graph
```

The config needs the values written by Terraform plus a dedicated
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for Wrangler. Give that token
Workers editor access scoped to the existing `work-graph-api` Worker. Worker
bindings do not require separate Hyperdrive access. Do not reuse the broader
infrastructure token.

Deploy in this order:

1. Apply the Work Graph Terraform root and run its state credential check.
2. Apply committed migrations to `DATABASE_URL` with
   `mise run //packages/work-graph-db:db:migrate`.
3. Run `mise run //workers/work-graph-api:deploy`.
4. Run `mise run //workers/work-graph-api:smoke:production`.

The deploy helper reads the public Hyperdrive ID from the environment and
creates a mode-0600 temporary Wrangler config. It unlinks that file on exit.
Terraform's secure helper installs the database password in Hyperdrive before
this step. The Worker has no database secret.

CI performs the same sequence after changes reach `main`. The production
GitHub environment should require review until the first deploy and restore
test have passed.

## Client use

Run the CLI through the production Doppler config so its Access headers and
origin allowlist arrive together:

```bash
doppler run --project work-graph --config prd_work_graph -- work-graph queue
```

Do not copy the Access pair into shell startup files. The CLI refuses to send
it to an origin outside `WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS` and refuses HTTP
redirects.
