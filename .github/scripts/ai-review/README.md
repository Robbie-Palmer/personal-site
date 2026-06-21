# AI code review

This directory contains the repository's custom multi-model pull-request
reviewer. Four OpenRouter models independently produce structured findings. A
merger model only deduplicates those findings and reconciles them with resolved
GitHub review threads; it does not judge correctness.

## Setup

1. Add `OPENROUTER_API_KEY` as an Actions repository secret and set a suitable
   credit limit on the key.
2. Open or update a non-draft pull request from a branch in this repository as
   an owner, member, or collaborator. Every commit is reviewed automatically.
3. Fork pull requests never run automatically. An owner, member, or collaborator
   must comment exactly `/ai-review` or manually dispatch the workflow.

Outside contributors cannot trigger a paid run themselves.

Optional Actions repository variables:

- `AI_REVIEW_MODELS`: comma-separated scout models. Defaults to
  `moonshotai/kimi-k2.7-code,deepseek/deepseek-v4-pro,z-ai/glm-5.2,qwen/qwen3-coder`.
- `AI_REVIEW_MERGER_MODEL`: defaults to `anthropic/claude-sonnet-4.6`.
- `AI_REVIEW_IGNORED_AUTHORS`: comma-separated PR authors to skip. Defaults to
  `renovate[bot],dependabot[bot]`.
- `AI_REVIEW_ZDR=true`: restricts routing to zero-data-retention providers. ZDR
  is not required by default.

## Security and behavior

The workflow needs the OpenRouter secret, but code in a pull request is
untrusted. `pull_request_target` makes the secret available. Automatic reviews
check out the PR's exact base commit. Manual comment and dispatch runs check out
the protected default branch because those events do not contain a trusted PR
base reference. The trusted reviewer then downloads the proposed changes through
GitHub's API as text. It never checks out or executes code from the pull-request
branch. Do not change the checkout to the PR head while the OpenRouter secret is
present.

The reviewer is advisory: it creates one rolling comment, does not submit a
formal review, and is not intended to be a required merge check initially. Its
comment includes finding provenance, candidate, structurally invalid, and
out-of-diff finding counts per model, retained-finding counts, cumulative
per-model cost, model failures, and incomplete-coverage warnings. These
cumulative scorecard fields are intended to support removing scouts that are
noisy or not cost-effective.

Scout responses allow up to 8,000 output tokens because reasoning tokens count
against the same limit and thinking models can otherwise exhaust the budget
before emitting their final structured response.

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
