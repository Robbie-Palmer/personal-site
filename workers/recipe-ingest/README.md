# Recipe Ingest Worker

Cloudflare Workflows-backed Worker that runs the production photo-to-recipe
ingestion pipeline ([ADR 049]). `recipe-api` creates jobs and workflow
instances; this Worker owns the durable extract → normalize → canonicalize →
finalize chain, calling OpenRouter through the shared
[`recipe-parsing`](../../packages/recipe-parsing/) package — the same
algorithm the [evaluation pipeline](../../ml-pipelines/recipe-parsing/)
iterates on and scores.

[ADR 049]: https://robbiepalmer.me/projects/recipe-site/adrs/049-cloudflare-workflows-recipe-ingestion

## Data flow

- **Postgres (Neon via Hyperdrive)** — `recipe_import_job` status/stage,
  `recipe_import_artifact` manifests, and `recipe_import_attempt` usage rows.
  The schema lives in [`recipe-db`](../../packages/recipe-db/); `recipe-api`'s
  CD owns `db:push`.
- **R2 (`recipe-artifacts`)** — source images under
  `imports/{jobId}/source/`, immutable stage snapshots under
  `imports/{jobId}/{stage}/`.
- **OpenRouter** — extraction, Cooklang normalization, and ingredient
  disambiguation. Models/timeouts are `wrangler.toml` vars mirroring the
  pipeline's `params.yaml`.

Idempotency: the workflow instance id is the job id, artifact manifests upsert
on `(job, stage, kind)`, and attempt rows on `(job, stage, attempt)`, so step
replays cannot duplicate rows or double-write snapshots.

## Local development

```bash
cp .dev.vars.example .dev.vars          # add a low-limit OpenRouter key
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://..."

# Standalone (workflow can be triggered via wrangler's local workflow API):
pnpm dev

# Alongside recipe-api so its cross-script workflow binding resolves:
wrangler dev -c wrangler.toml -c ../recipe-api/wrangler.toml
```

R2 is simulated locally by miniflare. `@cooklang/cooklang` requires the pnpm
patch in `patches/` to instantiate its WASM under workerd — if the Worker
fails at startup with `wasm.parser_new is not a function`, the patch was not
applied.

## Checks

```bash
mise run //workers/recipe-ingest:check   # typecheck + tests
```
