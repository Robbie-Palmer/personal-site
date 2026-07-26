# Complete the PR review loop

Own completed work from draft PR to a settled, ready-for-review PR. Do not merge
unless the user explicitly asks.

## Publish the draft

1. Sync with the intended base, inspect the diff, and run relevant local checks
   from `AGENTS.md`.
2. Commit only the intended work, push it, and open or reuse a draft PR.
3. Give the PR an accurate summary, validation notes, and QA requirements.

If deployed QA needs sign-in, seeded data, the API Worker, or ingestion, add
`preview:backend`. Comment exactly `/preview-backend` to request or retry it.
Otherwise let the preview workflow infer whether a backend is needed.

## Wait efficiently

CI and reviewers normally take several minutes. After a push or PR state change,
schedule a wait, timer, or completion notification and yield. Prefer one
consolidated inspection after roughly 3–5 minutes over a live CLI watcher that
redraws status every few seconds. Back off further for services known to take
longer.

When a reviewer is rate-limited:

- estimate whether another review is likely to add material value given the
  change risk and existing coverage;
- if yes, schedule one timer or monitor for the cooldown expiry, then resume the
  inspection instead of busy-polling; or
- if no, record the limitation and why the remaining review is not worth
  waiting for.

## Inspect and repair

Once activity settles, take one current-state snapshot:

- CI conclusions and failure details;
- review comments, change requests, and unresolved threads;
- SonarQube gate and actionable findings;
- preview result and any required QA; and
- rolling bot comments that may have been edited in place.

Treat results as stale after a new push, but do not repeatedly prove the head
SHA when GitHub already associates completed checks and decorations with the
current PR state. Query the public SonarQube API when its decoration is missing,
failing, stale-looking, or lacks enough detail. Use:

- host `https://sonarcloud.io`;
- project key `Robbie-Palmer_personal-site`; and
- PR issues, hotspots, and quality-gate endpoints as needed.

Only compare SonarQube's analyzed commit with the PR head when a recent push or
conflicting evidence creates a real staleness risk.

For each finding, decide whether it is a true issue, worthwhile nit,
duplicate/stale observation, or false positive. Fix true issues, add useful
regression coverage, and give concise evidence for rejected findings. Avoid
churn merely to satisfy a reviewer. Batch coherent fixes, validate, commit,
push, and return to the wait step.

## Settle the draft phase

Keep the PR in draft until:

- required checks pass and expected skips are understood;
- SonarQube passes with no unresolved true issue or hotspot;
- draft-visible reviewers have no unresolved true issue or active change
  request;
- required preview QA passes; and
- the worktree is clean and pushed.

Refresh once for late feedback, then mark the PR ready for review.

## Settle the ready phase

Wait for ready-only reviewers and the automatic custom AI review, then repeat
the same inspect, repair, and wait cycle.

The custom reviewer overwrites one top-level comment containing
`<!-- ai-code-review -->`. Re-fetch that comment after each completed run
instead of relying on an older copy.

After third-party feedback and the initial custom review are settled, request
another review with exactly `/ai-review` only if the head changed after the
latest completed custom review. Repeat after substantive fixes. Do not pay for
another run when the head is unchanged, or when only nitpicks, duplicates,
stale observations, or false positives remain. Record their dispositions. If a
run has no model coverage or exhausted credits, report that limitation rather
than calling it clean.

## Completion gate

Finish when the PR is ready for review and the current state has:

- passing CI and SonarQube;
- no unresolved true SonarQube, reviewer, or custom-review finding;
- completed required preview QA;
- explicit dispositions for remaining nits and false positives; and
- no uncommitted or unpushed fixes.

Report the PR URL, final commit, validation and QA status, review rounds, and
material limitations. Leave the PR for human merge.
