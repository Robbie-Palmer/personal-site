# Stateful AI review

This top-level project is the deployable service proposed by
[ADR 056](../ui/content/projects/personal-site/adrs/056-stateful-ai-code-review.mdx).
The ADR remains in the Personal Site content tree for now, but the service is
not a Personal Site runtime component.

The service is a visible, stateful publisher:

- a Worker verifies GitHub App webhook signatures and rejects other
  repositories;
- one SQLite Durable Object per pull request deduplicates deliveries, review
  configurations, and already-reviewed heads, assigns durable hunk and finding
  identities, and enforces per-PR run and cost ceilings;
- Durable Object alarms provide a trailing-edge debounce boundary, coalescing
  rapid events to one review of the latest pull request state after a quiet
  period;
- the same alarm handler retries committed finding outcomes that could not be
  published to R2, so a finalization-time outage cannot strand them in SQLite
  when no later pull-request event arrives;
- a Cloudflare Workflow fetches the PR through GitHub App authentication, runs
  the shared OpenRouter and OpenCode scout ensemble,
  reconciles candidates with the same OpenRouter merger, publishes each
  line-addressable finding as a native review comment with a stable hidden
  finding ID, and keeps a separate rolling run/cost/coverage comment;
  OpenRouter and OpenCode scouts use separate
  Workflow steps so a stalled free provider cannot replay completed paid calls,
  while deterministic publication and storage steps remain retryable;
- the private `ai-review-data` R2 bucket stores versioned terminal records for
  published, skipped, denied, and failed runs, including raw candidates,
  published findings, change characteristics, stable identities, and provider
  cost, latency, token, cache, availability, and failure metrics; and
- the former stateless GitHub Actions orchestrator is retired; its prompts,
  model clients, validation, and rendering code remain as the shared review
  engine imported by this service.

Automatic runs cover non-draft PR opens, ready-for-review transitions, reopens,
and synchronized heads. After the first completed review, synchronized heads
send only new or materially changed hunks, bounded context for their files, and
unchanged hunks tied to affected open findings. Generated files, lockfiles, and
whitespace-only hunks are skipped. Authentication, secrets, database-schema,
infrastructure, and deployment changes escalate deterministically to full
coverage. The rolling comment always labels coverage as full, incremental, or
skipped.

An exact `/ai-review` or `/ai-review full` issue comment from an owner, member,
or collaborator forces a full review of the current head, including on a draft.
If that same head is subsequently merged, its latest successful full review is
the final pre-merge review retrospectively; any later commit requires another
full review.
Ordinary comments and review-thread activity never schedule paid work. Replies,
reaction-count snapshots, thread resolution, and trusted
`/ai-review acknowledge f_<id> <reason>` or
`/ai-review reject f_<id> <reason>` commands instead take a storage-only path.
On an attached finding thread, trusted reviewers record a disposition by
replying with `/ai-review acknowledge <reason>`, `/ai-review confirm-fixed
<reason>`, or `/ai-review reject <reason>` before resolving it. Thread context
binds the command to the hidden finding ID. `confirm-fixed` is accepted only
after a controlled replay returns `fixed` for the current head. Findings that
GitHub cannot attach to a current diff line remain in the rolling comment with
the finding-ID form of those commands as a top-level fallback only; do not use
the finding-ID form inside an attached thread.

OpenRouter is the default paid inference gateway because its broader model and
provider catalogue, provider failover, model fallbacks, and price/performance
routing are useful properties of the architecture itself. The initial route
retains the proven ensemble: Kimi K2.6 and DeepSeek V4 Pro through OpenRouter,
eligible live free models through OpenCode Zen, and Claude Sonnet 4.6 as the
OpenRouter merger. Workers AI is deliberately not
bound or used: its narrower catalogue and provider-specific integration do not
justify higher published prices than the current multi-provider route.

## Ownership boundaries

- `ai-review/wrangler.toml` owns the Worker, Durable Object, Workflow, bindings,
  and non-secret runtime configuration.
- Changed-file context is fetched through bounded GitHub GraphQL batches rather
  than one REST request per path. This keeps large reviews comfortably below
  Cloudflare's subrequest ceiling without changing the shared prompt or
  coverage budgets.
- `infra/` owns the shared Cloudflare account's private R2 bucket.
- R2 expires review records after 365 days and aborts incomplete multipart
  uploads after seven days. Cloudflare provider v4 cannot represent those
  rules, so they are configured once with Wrangler and verified during setup.
- Doppler project `ai-review`, config `prd`, owns deploy and runtime secrets.
- Doppler config `ai-review/stg` mirrors those credentials for the isolated
  `ai-review-staging` Worker used only for explicit end-to-end QA.
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
`AI_REVIEW_APP_PRIVATE_KEY` must be the unencrypted PKCS#8 representation of
the GitHub-generated PKCS#1 key. Convert it once before storage with
`openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt`; runtime authentication
is delegated to `@octokit/auth-app` and does not parse or rewrite private-key
formats.
The spend-limited OpenRouter key is installed as a Worker runtime secret.
`OPENCODE_API_KEY` is optional while OpenCode Zen permits anonymous free-model
requests; if present in Doppler it is installed as a runtime secret too.
The committed `ai-review-data` name is authoritative in Terraform, Wrangler,
and lifecycle verification; it is not a deployment input.
`AI_REVIEW_DATA_RETENTION_DAYS` documents the intended bucket policy only. The
Worker neither treats object metadata as enforcement nor deletes records; the
bucket-level lifecycle rule above is authoritative.

## GitHub App and review policy

The App requires repository metadata and contents read access, **pull-request
read/write access** for native review comments, and issues read/write access for
its rolling comment and command fallback. Subscribe it to `pull_request`,
`issue_comment`, `pull_request_review_comment`, and
`pull_request_review_thread` events. Changes to the existing App are made in
its GitHub settings and require the installation owner to approve the expanded
pull-request permission. The Worker verifies every signature and re-checks the
repository, PR state, draft state, author, exact command text,
command-author association, feedback actor, and current head before accepting
an event, spending, or publishing.

Committed non-secret defaults in `wrangler.toml` configure the shared reviewer:

- `AI_REVIEW_MODELS`, `AI_REVIEW_OPENCODE_MODELS`, and
  `AI_REVIEW_MERGER_MODEL` select the current ensemble;
- `AI_REVIEW_ZDR` applies the OpenRouter routing constraint;
- `AI_REVIEW_MAX_PR_COST_USD=5` stops new runs after recorded successful or
  failed stateful runs on the PR reach that cumulative cost;
- `AI_REVIEW_MAX_RUNS_PER_PR=20` caps attempted stateful runs per PR; and
- `AI_REVIEW_PROMPT_VERSION` participates in the durable idempotency key, so an
  intentional prompt/configuration change can review an unchanged head once.

The per-PR Durable Object permits only one paid review to be in flight. This
ensures a later head cannot bypass the cost ceiling while an earlier review's
spend is still unknown. A running claim expires after 30 minutes so a Workflow
terminated outside application code cannot block that pull request forever.
Before admitting a replacement, the coordinator terminates the expired
Cloudflare Workflow and waits for that operation to succeed. Paid OpenRouter
completion requests also make exactly one HTTP attempt because the provider
does not expose an idempotency key; GitHub and free-provider requests retain
their bounded transient retries.

### Review data schema

New analytical records use schema version 2 under
`v2/<owner>/<repository>/pr-<number>/<head>/<workflow>/<status>.json`. The
status is `published`, `skipped`, `denied`, or `failed`; using a distinct object
per terminal status preserves a published record if a later deterministic
completion step fails. Existing schema-version-1 objects remain readable and
are not rewritten.

PR-scoped hunk IDs hash the repository path and normalized unified-diff body while
excluding hunk coordinates, so an unchanged hunk keeps its identity when lines
move. PR-scoped finding IDs hash the path and normalized finding title, excluding line,
severity, status, and model provenance. The Durable Object upserts these
identities into `review_hunks`, `review_findings`, and
`review_finding_hunks`; first-seen values remain immutable while last-seen
values advance with later completed runs. `review_run_hunks` records both the
current-head hunk set and which subset was sent for review, allowing the next
run to compare against the last completed head. R2 retains the trigger decision,
full coverage accounting, raw per-model candidates, and the merged findings
that were actually published.

Native review-comment mappings live in `review_finding_comments`, so later
heads reconcile the same finding instead of publishing another thread.
Accepted feedback deliveries are deduplicated by GitHub delivery ID and stored
in `review_finding_events`. Each is also appended as schema-v2 evidence at
`v2/<owner>/<repository>/pr-<number>/findings/<finding-id>/evidence/<delivery>.json`.
These records preserve the event/action, trusted actor, reply or command body,
reaction counts present on review-comment events, thread state, explicit
disposition and timestamps without mutating earlier evidence.

`review_finding_outcomes` turns that evidence into a versioned evaluation
label. An explicit acknowledgement or rejection creates an outcome immediately.
When a later review covers the finding's file after its affected hunks change,
the merger performs a controlled replay of the durable finding against the
current diff and file context, recording `fixed`, `still-present`, or `uncertain`
with direct code evidence. Replay is evidence, not adjudication: the coordinator
adds a `confirmed-fixed` outcome only after a trusted actor submits
the top-level fallback `/ai-review confirm-fixed <finding-id> <reason>` for a
recorded `fixed` replay when no finding thread is available.
The replay head must match the authoritative current PR head fetched from
GitHub when the trusted command is handled. The outcome links the trusted actor
and reason to that replay's head, run, and
evidence. PR content, stale replay, model omission, or a resolved GitHub thread
cannot mint a confirmed label by itself. Confirmation suppresses replay only on
that exact head; a later head makes the finding eligible for replay again. On
`pull_request.closed`, any finding without an outcome becomes `superseded` when
the final reviewed diff no longer contains its affected hunks, or
`no-observable-response` otherwise. A legacy finding with a persisted explicit
disposition but no outcome row receives the matching `acknowledged` or
`rejected` label. The closure evidence records whether the final head was
actually reviewed so censored outcomes remain distinguishable from complete
coverage.

Outcome revisions are immutable schema-v2 objects at
`v2/<owner>/<repository>/pr-<number>/findings/<finding-id>/outcomes/v<version>.json`.
The highest version is the current outcome; earlier labels remain available to
show how later code evidence changed the attribution. SQLite commits the outcome
before R2 publication and retains an `r2_recorded` flag, so a retried webhook or
review completion repairs an interrupted object write without creating another
revision.

### Scorecard marts

The DuckDB batch in `analytics/` builds versioned `finding_latest`,
`review_run_fact`, `model_run_fact`, and `pull_request_fact` Parquet marts plus
a checksum-bearing machine-readable manifest. The latest outcome is the highest
`outcomeVersion`; `finding_history` remains in the transient DuckDB build so
revision resolution is explicit and testable. Unknown schema versions, unknown
record types, duplicate revisions, and outcome/evidence joins to unpublished
findings stop the build. When one workflow has both `published` and `failed`
terminal records, the published record is authoritative; every other duplicate
or conflicting terminal combination stops the build. Pull Request-grain marts
retain distinct prompt versions, task types, and originating agents as lists so
a multi-run lifecycle is not attributed to one arbitrary scalar value.

Run one deterministic rebuild from a fixed local R2 export prefix with:

```bash
AI_REVIEW_SCORECARD_INPUT=/path/to/r2-export \
AI_REVIEW_SCORECARD_OUTPUT=/path/to/output \
mise run //ai-review:scorecard:build
```

Metric definitions follow
[Agentic Code Review ADR 033](/projects/agentic-code-review/adrs/033-duckdb-ai-review-scorecard):
acceptance excludes censored outcomes, fix-through and noise use published
findings as their denominator, cost uses accepted findings, token efficiency
uses uncached input tokens, and coverage uses reviewed over total hunks. Outputs
retain prompt, risk, change-size, repository-area, task, originating-agent, and
time dimensions for stratification.

## Deploy

Sync the environment after changing Doppler:

```bash
scripts/sync-doppler-github-envs.sh production-ai-review
```

For a local deployment:

```bash
mise run //ai-review:deploy
```

For an isolated staging deployment and live review of the current branch's PR:

```bash
mise run //ai-review:deploy:staging
mise run //ai-review:e2e:staging
```

Staging deploys as `ai-review-staging`, uses its own Durable Object namespace,
Workflow, and private `ai-review-data-staging` bucket, and publishes through the
real GitHub App. The E2E task sends a correctly signed synthetic `/ai-review`
webhook, waits for its versioned R2 record, and verifies that the visible
stateful PR comment targets the current head and that at least one scout
provided actual review coverage.
Set `AI_REVIEW_E2E_PULL_REQUEST` to test another pull request explicitly.
After a full staging run establishes a baseline, add a semantic commit that
preserves at least one eligible baseline hunk, then set
`AI_REVIEW_E2E_EVENT_MODE=synchronize` to send a non-forced `pull_request`
event and require incremental coverage with both reviewed and unchanged hunks.

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
