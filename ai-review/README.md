# Stateful AI review

This top-level project is the deployable service proposed by
[ADR 056](../ui/content/projects/personal-site/adrs/056-stateful-workers-ai-code-review.mdx).
The ADR remains in the Personal Site content tree for now, but the service is
not a Personal Site runtime component.

The initial deployment is deliberately an infrastructure bootstrap:

- a Worker verifies GitHub App webhook signatures and rejects other
  repositories;
- one SQLite Durable Object per pull request deduplicates webhook deliveries;
- Durable Object alarms provide a trailing-edge debounce boundary, coalescing
  rapid events to one review of the latest pull request state after a quiet
  period;
- a Cloudflare Workflow and Workers AI binding are provisioned for the review
  loop;
- the private `ai-review-data` R2 bucket stores versioned analytical records;
  and
- `AI_REVIEW_ENABLED` defaults to `false`, so installing the App does not start
  model calls before the review implementation and policy are ready.

## Ownership boundaries

- `ai-review/wrangler.toml` owns the Worker, Durable Object, Workflow, bindings,
  and non-secret runtime configuration.
- `infra/` owns the shared Cloudflare account's private R2 bucket.
- R2 expires review records after 365 days and aborts incomplete multipart
  uploads after seven days. Cloudflare provider v4 cannot represent those
  rules, so they are configured once with Wrangler and verified during setup.
- Doppler project `ai-review`, config `prd`, owns deploy and runtime secrets.
- GitHub environment `production-ai-review` is a generated deployment mirror
  of `ai-review/prd`.
- The private
  [`robbie-palmer-ai-review`](https://github.com/apps/robbie-palmer-ai-review)
  GitHub App is installed only on `Robbie-Palmer/personal-site`.

## Required Doppler values

Masked values:

- `CLOUDFLARE_API_TOKEN`
- `AI_REVIEW_APP_PRIVATE_KEY`
- `AI_REVIEW_WEBHOOK_SECRET`
- `OPENROUTER_API_KEY`

Unmasked values:

- `CLOUDFLARE_ACCOUNT_ID`
- `AI_REVIEW_APP_ID`
- `AI_REVIEW_APP_INSTALLATION_ID`

GitHub Actions reserves the `GITHUB_` prefix, so App credentials use the
`AI_REVIEW_` prefix in Doppler and the Worker.
The committed `ai-review-data` name is authoritative in Terraform, Wrangler,
and lifecycle verification; it is not a deployment input.
`AI_REVIEW_DATA_RETENTION_DAYS` documents the intended bucket policy only. The
Worker neither treats object metadata as enforcement nor deletes records; the
bucket-level lifecycle rule above is authoritative.

## Deploy

Sync the environment after changing Doppler:

```bash
scripts/sync-doppler-github-envs.sh production-ai-review
```

For a local deployment:

```bash
mise run //ai-review:deploy
```

The deploy task loads `ai-review/prd` when required values are not already in
the environment. It exposes only the five Worker runtime secrets to Wrangler
through a mode-`0600` file inside a mode-`0700` temporary directory. The
cleanup trap unlinks the file after Wrangler exits or the deploy is
interrupted. Linux deployments, including GitHub-hosted runners, place that
directory on `/dev/shm` so even an untrappable process termination leaves
secrets only in the runner's memory-backed temporary filesystem.
The GitHub App webhook URL is:

```text
https://ai-review.robbiepalmer95.workers.dev/webhooks/github
```

Verify the out-of-band R2 retention rule without reading any objects:

```bash
doppler run --project ai-review --config prd -- \
  mise x -- pnpm --dir ai-review exec wrangler r2 bucket lifecycle list ai-review-data
```

## Validation

```bash
mise run //ai-review:check
mise run //infra:format:check
mise run //infra:precommit-lint
mise run //:lint:actions
```

The bootstrap unit tests use thin `cloudflare:workers` class stubs so storage
and routing behavior can be exercised deterministically. Type checking against
the current Workers types and the Wrangler deployment dry-run validate the
runtime surface; workerd integration tests belong with the later review-engine
implementation, once there is runtime behavior beyond orchestration to test.
