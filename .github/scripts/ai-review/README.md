# AI code review

This directory contains the repository's custom multi-model pull-request
reviewer. Two paid OpenRouter scouts and the retained free models advertised by
OpenCode Zen independently produce structured findings. A paid OpenRouter merger
only deduplicates those findings and reconciles them with resolved GitHub review
threads; it does not judge correctness. Free-scout findings are real review
inputs rather than shadow telemetry, so their downstream outcomes can inform
future performance analytics.

## Setup

1. Add `OPENROUTER_API_KEY` as an Actions repository secret and set a suitable
   credit limit on the key. It is used by the paid scouts and merger.
2. Open or update a non-draft pull request from a branch in this repository as
   an owner, member, or collaborator. Every commit is reviewed automatically.
3. Fork pull requests never run automatically. An owner, member, or collaborator
   must comment exactly `/ai-review` or manually dispatch the workflow.

Outside contributors cannot trigger a paid run themselves.

Optional Actions repository variables:

- `AI_REVIEW_MODELS`: comma-separated paid OpenRouter scout models. Defaults to
  `moonshotai/kimi-k2.6,deepseek/deepseek-v4-pro`.
- `AI_REVIEW_OPENCODE_MODELS`: comma-separated free OpenCode model IDs. When it
  is unset, the reviewer discovers eligible IDs ending in `-free` plus
  `big-pickle` from the live OpenCode catalogue. DeepSeek V4 Flash, MiMo V2.5,
  Laguna S 2.1, Ling 3.0 Flash, and North Mini Code are excluded after live runs
  showed that they provided no useful incremental coverage or failed too often.
  The override is limited to six enabled free IDs.
- `AI_REVIEW_MERGER_MODEL`: defaults to `anthropic/claude-sonnet-4.6`.
- `AI_REVIEW_IGNORED_AUTHORS`: comma-separated PR authors to skip. Defaults to
  `renovate[bot],dependabot[bot]`.
- `AI_REVIEW_ZDR=true`: restricts paid OpenRouter scout and merger routing to
  zero-data-retention providers. It does not change OpenCode scout routing.

OpenCode currently accepts anonymous requests for its free models. An
`OPENCODE_API_KEY` Actions secret may be added if OpenCode requires
authentication in the future; it is optional today. The TypeScript OpenCode SDK
controls an OpenCode server, while Zen exposes these models through an
OpenAI-compatible API, so the workflow calls the Zen API directly and does not
need to install the CLI or SDK on each runner.

## Security and behavior

The workflow needs the OpenRouter secret, but code in a pull request is untrusted.
`pull_request_target` makes the secret available. Automatic reviews
check out the PR's exact base commit. Manual comment and dispatch runs check out
the protected default branch for comments. Maintainer-only manual dispatches
check out their explicitly selected ref so reviewer changes can be tested before
merge. The trusted reviewer then downloads the proposed changes through GitHub's
API as text. It never checks out or executes code from the reviewed Pull Request
branch. Do not change automatic or comment-triggered checkout to the PR head
while the OpenRouter secret is present.

The reviewer is advisory: it creates one rolling comment, does not submit a
formal review, and is not intended to be a required merge check initially. Its
comment includes finding provenance, candidate, structurally invalid, and
out-of-diff finding counts per model, retained-finding counts, cumulative
per-model cost, model failures, and incomplete-coverage warnings. These
cumulative scorecard fields are intended to support removing scouts that are
noisy or not cost-effective.

Free-model availability is refreshed from OpenCode at the start of every run.
Models removed from the catalogue are skipped. The four default scouts—Kimi
K2.6, DeepSeek V4 Pro, Big Pickle, and Nemotron 3 Ultra Free—run concurrently.
Transient failures such as rate limits are retried, Nemotron receives a
180-second timeout, and DeepSeek V4 Pro receives a 16,000-token completion
budget. Individual failures do not block the remaining scouts. Any successful
scout is enough to continue to reconciliation. If every scout is unavailable,
rate-limited, or invalid, the workflow publishes an explicit no-coverage warning
and does not spend money on the merger; the stable `review` check is skipped.

When OpenRouter reports exhausted account credits or an exhausted API-key
spending limit, the stable `review` check is also marked as skipped.
Authentication, merger, reviewer, and workflow failures continue to fail the
check.

Scout responses allow up to 8,000 output tokens because reasoning tokens count
against the same limit and thinking models can otherwise exhaust the budget
before emitting their final structured response.

OpenCode describes the free models as limited-time feedback programmes. Prompts
and outputs may be collected or used to improve those models, depending on the
model's terms. Do not use this scout path for private or sensitive repositories
without reviewing the current OpenCode privacy terms.

## Testing reviewer changes

`pull_request_target` deliberately runs the reviewer from the Pull Request's
trusted base commit, so it cannot validate reviewer changes in that Pull Request.
To run a branch version end to end, a maintainer can manually dispatch the
workflow against that branch and supply an open Pull Request number:

```sh
gh workflow run ai-review.yml --ref <branch> -f pr_number=<number>
```

The manual run checks out the selected branch commit. Do not add untrusted users
as repository collaborators: collaborators can dispatch workflows with access to
Actions secrets. Every live review runs the reviewer unit tests and syntax check
before making paid model calls.

The reviewer excludes lock files, generated/minified files, dependency/build
directories, images, fonts, archives, documents, audio/video, compiled objects,
databases, WebAssembly, model checkpoints, and binary data formats. GitHub also
omits textual patches for binary or excessively large files; the reviewer marks
those files as omitted rather than sending them to a model. The PR comment lists
all unexpectedly omitted files; intentionally ignored files do not produce an
incomplete-coverage warning. It does not fetch files over 200 KB. For files it
does fetch, it includes at most 40,000 characters per file and 180,000 characters
of combined file context. It also caps each patch at 60,000 characters and the
combined diff at 280,000 characters. Split large PRs when full coverage matters.

## Validation

Node.js 24 runs TypeScript directly using native type stripping:

```sh
node --test .github/scripts/ai-review/ai-review.test.ts
node --check .github/scripts/ai-review/ai-review.ts
mise run //:lint:yaml
```
