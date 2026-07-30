# Shared AI review engine

This directory contains the provider-neutral prompts, model clients,
validation, filtering, and comment rendering used by the stateful
[`ai-review`](../../../ai-review) GitHub App. Four paid OpenRouter scouts and the
retained free models advertised by OpenCode Zen independently produce structured
findings. A paid OpenRouter merger only deduplicates those findings and
reconciles them with resolved GitHub review threads; it does not judge
correctness. Free-scout findings are real review inputs rather than shadow
telemetry, so their downstream outcomes can inform future performance
analytics.

The former `.github/workflows/ai-review.yml` orchestrator was retired after the
GitHub App completed live reviews successfully. Keep this shared implementation:
the stateful Worker imports it directly.

## Runtime configuration

The GitHub App owns triggers, authentication, secrets, and deployment. See its
[README](../../../ai-review/README.md) for setup and operational instructions.
The shared engine accepts these runtime variables:

- `AI_REVIEW_MODELS`: comma-separated paid OpenRouter scout models. Defaults to
  `moonshotai/kimi-k2.6,deepseek/deepseek-v4-pro,z-ai/glm-5.2,inclusionai/ling-2.6-1t`.
  The default models have per-token price ceilings so a promotional provider
  price increase fails that scout instead of silently spending above the
  expected rate.
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
`OPENCODE_API_KEY` Worker secret may be added if OpenCode requires
authentication in the future; it is optional today. The TypeScript OpenCode SDK
controls an OpenCode server, while Zen exposes these models through an
OpenAI-compatible API, so the engine calls the Zen API directly.

## Security and behavior

Pull-request code is untrusted. The GitHub App downloads proposed changes
through GitHub's API as text and never checks out or executes code from the
reviewed pull-request branch. Production CD builds the Worker and this imported
shared engine only after a push to `main`, and reruns the complete
`//ai-review:check` suite before deploying with production credentials.

The reviewer is advisory: it creates one rolling comment, does not submit a
formal review, and is not intended to be a required merge check initially. Its
comment includes finding provenance, candidate, structurally invalid, and
out-of-diff finding counts per model, retained-finding counts, cumulative
per-model cost, model failures, and incomplete-coverage warnings. These
cumulative scorecard fields are intended to support removing scouts that are
noisy or not cost-effective.

Free-model availability is refreshed from OpenCode at the start of every run.
Models removed from the catalogue are skipped. The six default scouts—Kimi
K2.6, DeepSeek V4 Pro, GLM 5.2, Ling 2.6 1T, Big Pickle, and Nemotron 3 Ultra
Free—run in bounded concurrent batches.
GitHub and free-provider transient failures use bounded retries, while paid
OpenRouter completion POSTs make one HTTP attempt because the provider exposes
no idempotency key. Nemotron receives a 180-second timeout, and individual
failures do not block the remaining scouts. Any successful scout is enough to
continue to reconciliation. If every scout is unavailable, rate-limited, or
invalid, the run records an explicit no-coverage result and does not spend money
on the merger.

When OpenRouter reports exhausted account credits or an exhausted API-key
spending limit, the run records the provider failure rather than claiming clean
review coverage.

Scout responses allow up to 8,000 output tokens because reasoning tokens count
against the same limit and thinking models can otherwise exhaust the budget
before emitting their final structured response.

OpenCode describes the free models as limited-time feedback programmes. Prompts
and outputs may be collected or used to improve those models, depending on the
model's terms. Do not use this scout path for private or sensitive repositories
without reviewing the current OpenCode privacy terms.

The reviewer excludes lock files, generated/minified files, dependency/build
directories, images, fonts, archives, documents, audio/video, compiled objects,
databases, WebAssembly, model checkpoints, and binary data formats. GitHub also
omits textual patches for binary or excessively large files; the reviewer marks
those files as omitted rather than sending them to a model. The PR comment lists
all unexpectedly omitted files; intentionally ignored files do not produce an
incomplete-coverage warning. It does not fetch files over 200 KB. For files it
does fetch, it includes at most 40,000 characters per file and 180,000 characters
of combined file context. File contents are fetched through bounded GraphQL
batches, and later batches are skipped once that combined budget is full. It
also caps each patch at 60,000 characters and the combined diff at 280,000
characters. Split large PRs when full coverage matters.

## Validation

Node.js 24 runs TypeScript directly using native type stripping:

```sh
node --test .github/scripts/ai-review/ai-review.test.ts
node --check .github/scripts/ai-review/ai-review.ts
mise run //ai-review:check
```
