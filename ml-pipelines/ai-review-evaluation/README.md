# AI reviewer evaluation

This DVC project extracts redacted Pull Request replay snapshots from the AI
review data export, fixes a traceable cohort, runs controlled baseline and
candidate replays, and builds a DuckDB scorecard. It does not read or write live
Pull Request state.

The pipeline has five stages:

1. `extract_dataset` joins immutable replay inputs to their production terminal
   records and latest finding outcomes. It copies only the replayable snapshots
   into `data/corpus`, records SHA-256 provenance for every source object, and
   reports terminal-record PRs separately from PRs that have replay snapshots.
2. `freeze_cohort` groups snapshots by Pull Request and includes every available
   PR unless `cohort.pullRequestNumbers` names an explicit cohort. Every snapshot
   for a selected PR remains in the cohort. The stage writes PR and snapshot
   counts, baseline, candidate, repetitions, limits, matching rules, metrics,
   sample size, and thresholds before replay results exist.
3. `replay` calls the production-isolated corpus runner once per corpus entry,
   variant, and repetition. It runs inference unless `replay.mode=plan`.
4. `match` applies the frozen matching rules to immutable historical labels.
5. `evaluate` uses DuckDB to write a per-run Parquet scorecard, summary metrics
   with variance, and an `adopt`, `reject`, or `gather-more-evidence` decision.

## Prepare and freeze the dataset

First pull the production export with the existing AI review task:

```bash
mise run //ai-review:scorecard:pull
```

Review `params.yaml` before running the pipeline. Fix the model or prompt pair,
repetitions, budgets, matching rules, sample size, and decision thresholds.
For an explicitly curated cohort, put PR numbers in
`cohort.pullRequestNumbers`. An empty list uses every replayable PR. The pipeline
includes every captured snapshot for each selected PR. The experiment-wide cost
limit guards execution as the corpus grows. Freeze validation and holdout splits
later, once the corpus supports them.

Additions plus deletions determine change size. Configure each band's exclusive
upper bound in `cohort.changeSizeBands`. The committed bands cover small changes
below 200 lines, medium changes from 200 through 999, substantial changes from 1,000
through 1,999, large changes from 2,000 through 4,999, and oversized changes
from 5,000. The frozen cohort records these thresholds.

Each baseline and candidate contains one experiment object. The pipeline accepts
the replay runner's four variables: `scout-model`, `merger-model`,
`prompt-version`, and `coverage-policy`. Both variants must use the one variable
named by `experiment.variable`.

Then reproduce the pipeline:

```bash
mise run //ml-pipelines/ai-review-evaluation:repro
```

The source export lives outside the DVC project. Run `dvc repro --force
extract_dataset` after refreshing it. DVC versions the extracted corpus. Its
manifest keeps the source object keys and hashes needed to audit the extraction.
Each stage has a dedicated command script, so editing one stage's mise wrapper
does not invalidate unrelated cached stages.

Corpus entries preserve the PR author and the unique GitHub users who submitted
reviews. Older snapshots may omit reviewer metadata. Each trusted finding
disposition records its actor separately on the historical outcome.

## Plan without inference

To inspect the DAG and downstream artifact shapes without inference, override
the committed `execute` mode for a DVC experiment:

```bash
mise run //ml-pipelines/ai-review-evaluation:dvc -- \
  exp run -S replay.mode=plan
```

Run `mise run //ml-pipelines/ai-review-evaluation:dvc -- repro freeze_cohort`
instead if you do not need replay output. The corpus runner has no GitHub
publication adapter. Results stay under the evaluation
project's `outputs/replays` namespace and never update production configuration.
The pipeline stops if one replay or the complete experiment exceeds its
declared cost limit.

DVC caches the replay stage by its corpus, model experiment, limits, runner
code, and mode. The runner also keeps content-addressed completed results under
`~/.cache/ai-review/evaluation-replays`. Matching or decision-threshold changes
start downstream of replay and do not call a provider again.

## Inspect results

Inspect these artifacts:

- `outputs/evaluation/replay-scorecard.parquet`, one traceable row per replay;
- `outputs/matched/matches.jsonl`, recorded match method, evidence,
  confidence, outcome revision, and manual-adjudication status;
- `outputs/evaluation/metrics.json`, sample sizes, missing coverage, failures,
  tokens, latency, cost, mean within-snapshot sample standard deviation across
  repetitions, and separate between-PR accepted-finding variation; and
- `outputs/evaluation/decision.md`, the fixed-threshold recommendation.

Unmatched, censored, no-response, and ambiguous findings remain separate. The
scorecard never treats them as rejections.

The comparison metrics first aggregate snapshots within each PR, then average
the PR-level values. A PR with four captured snapshots therefore has the same
weight as a PR with one. Raw finding, token, and cost totals remain available
for operational accounting. The committed decision policy also uses completed
PRs as its minimum-sample unit. Cost comparisons use the PR-weighted mean cost
per replay rather than the raw experiment total.

Language strata come from the typed `linguist-languages` package, which mirrors
GitHub Linguist's language metadata and has no runtime dependencies.

The production reviewer and this pipeline share Zod schemas and inferred
TypeScript types through `packages/ai-review-domain`. Both boundaries validate
replay inputs, finding outcomes, coverage, change profiles, model metrics,
provider names, and replay experiments with those schemas.
