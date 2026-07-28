# Stateful AI review

This top-level project is the deployable service proposed by
[ADR 056](../ui/content/projects/personal-site/adrs/056-stateful-ai-code-review.mdx).
The ADR remains in the Personal Site content tree for now, but the service is
not a Personal Site runtime component.

The service is a visible, stateful publisher:

- a Worker verifies GitHub App webhook signatures and rejects other
  repositories;
- one SQLite Durable Object per pull request deduplicates deliveries, review
  configurations, and already-reviewed heads while enforcing per-PR run and
  cost ceilings;
- Durable Object alarms provide a trailing-edge debounce boundary, coalescing
  rapid events to one review of the latest pull request state after a quiet
  period;
- a Cloudflare Workflow fetches the PR through GitHub App authentication, runs
  the same OpenRouter and OpenCode scout ensemble as the existing Action,
  reconciles candidates with the same OpenRouter merger, and publishes a
  separate rolling comment; paid model steps make one Workflow attempt while
  deterministic publication and storage steps remain retryable;
- the private `ai-review-data` R2 bucket stores versioned findings plus provider
  cost, latency, token, cache, availability, and failure metrics; and
- the existing stateless GitHub Action remains enabled as an independent,
  visible baseline.

Automatic runs cover non-draft PR opens, ready-for-review transitions, reopens,
and synchronized heads. An exact `/ai-review` issue comment from an owner,
member, or collaborator requests a run explicitly, including on a draft.
Ordinary comments and review-thread activity never schedule paid work.

OpenRouter is the default paid inference gateway because its broader model and
provider catalogue, provider failover, model fallbacks, and price/performance
routing are useful properties of the architecture itself. The initial route
deliberately matches the current stateless reviewer: Kimi K2.6 and DeepSeek V4
Pro through OpenRouter, eligible live free models through OpenCode Zen, and
Claude Sonnet 4.6 as the OpenRouter merger. Workers AI is deliberately not
bound or used: its narrower catalogue and provider-specific integration do not
justify higher published prices than the current multi-provider route.

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
The spend-limited OpenRouter key is installed as a Worker runtime secret.
`OPENCODE_API_KEY` is optional while OpenCode Zen permits anonymous free-model
requests; if present in Doppler it is installed as a runtime secret too.
The committed `ai-review-data` name is authoritative in Terraform, Wrangler,
and lifecycle verification; it is not a deployment input.
`AI_REVIEW_DATA_RETENTION_DAYS` documents the intended bucket policy only. The
Worker neither treats object metadata as enforcement nor deletes records; the
bucket-level lifecycle rule above is authoritative.

## GitHub App and review policy

The App requires repository metadata and contents read access, pull-request read
access, and issues read/write access for its rolling comment. Subscribe it to
`pull_request` and `issue_comment` events. The Worker re-checks repository,
PR state, draft state, author, exact command text, command-author association,
and current head before spending or publishing.

Committed non-secret defaults in `wrangler.toml` mirror the stateless reviewer:

- `AI_REVIEW_MODELS`, `AI_REVIEW_OPENCODE_MODELS`, and
  `AI_REVIEW_MERGER_MODEL` select the current ensemble;
- `AI_REVIEW_ZDR` applies the stateless OpenRouter routing constraint;
- `AI_REVIEW_MAX_PR_COST_USD=5` stops new runs after recorded successful or
  failed stateful runs on the PR reach that cumulative cost;
- `AI_REVIEW_MAX_RUNS_PER_PR=20` caps attempted stateful runs per PR; and
- `AI_REVIEW_PROMPT_VERSION` participates in the durable idempotency key, so an
  intentional prompt/configuration change can review an unchanged head once.

The per-PR Durable Object permits only one paid review to be in flight. This
ensures a later head cannot bypass the cost ceiling while an earlier review's
spend is still unknown.

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
the environment. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` authenticate
Wrangler for deployment; they are not installed as Worker runtime secrets. The
mode-`0600` Wrangler secrets file contains `AI_REVIEW_APP_ID`,
`AI_REVIEW_APP_INSTALLATION_ID`, `AI_REVIEW_APP_PRIVATE_KEY`,
`AI_REVIEW_WEBHOOK_SECRET`, and `OPENROUTER_API_KEY`, plus
`OPENCODE_API_KEY` when configured, inside a mode-`0700` temporary directory.
The cleanup trap unlinks the file after Wrangler exits or the deploy is
interrupted. Linux deployments, including GitHub-hosted runners, place that
directory on `/dev/shm` when it is available and writable, so even an
untrappable process termination leaves secrets only in the runner's
memory-backed temporary filesystem. Other environments fall back to
`${TMPDIR:-/tmp}` and retain only the unlink-on-exit protection.
The GitHub App webhook URL is:

```text
https://ai-review.robbiepalmer95.workers.dev/webhooks/github
```

Verify the out-of-band R2 retention rule without reading any objects:

```bash
doppler run --project ai-review --config prd -- \
  mise run //ai-review:lifecycle:verify
```

Production deployment runs the same verification and fails if the 365-day
expiry or seven-day multipart-abort policy drifts.

## Validation

```bash
mise run //ai-review:check
mise run //ai-review:deploy:dry-run
mise run //infra:format:check
mise run //infra:precommit-lint
mise run //:lint:actions
```

Deterministic unit tests use thin `cloudflare:workers` class stubs to exercise
routing, GitHub authentication, exact model parity, publication, and analytics
without paid calls. A separate Cloudflare-supported Vitest pool runs Durable
Object delivery, alarm, eviction, SQLite, claim, completion, and deduplication
tests inside `workerd`. Type checking against the current Workers types and the
Wrangler deployment dry-run validate the bundled runtime surface.
The `/health` response is intentionally a non-mutating binding-presence check;
the deployment dry-run is the functional binding-configuration check.
