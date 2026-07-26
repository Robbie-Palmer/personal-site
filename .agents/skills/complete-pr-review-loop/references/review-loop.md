# Complete the PR review loop

Own the pull request from the first draft push until every current-head signal is
settled. Leave the settled PR ready for human merge; do not merge it unless the
user explicitly asks.

## Working rules

- Use the repository's GitHub integration when it exposes the required data and
  actions; otherwise use `gh` and GitHub's REST or GraphQL API.
- Preserve unrelated user changes. Commit only the intended work.
- Keep the branch based on the current `origin/main` before publishing, unless
  the task requires another base.
- Never treat a result from an older head SHA as evidence about the current
  code. Record the PR number and head SHA at the start of every iteration.
- After every push, restart the checks-and-review loop for the new head.
- Stay with pending checks and reviewers: poll or watch them rather than handing
  the user a partially reviewed PR.
- Do not make speculative changes just to silence a tool. Classify every
  finding as a true issue, worthwhile nit, duplicate/stale finding, or false
  positive, and retain the evidence for that classification.

## Phase 1: publish a draft

1. Run the relevant local validation from `AGENTS.md`.
2. Review the complete diff and repository status.
3. Commit the intended changes with a focused message and push the branch.
4. Open a **draft** PR with an accurate title and body. Include the problem,
   solution, validation, and any QA constraints.
5. Confirm the PR is still a draft before beginning remote triage. Opening it
   ready would trigger the custom AI review too early.

If a PR already exists, reuse it. Do not open a duplicate.

## Request a backend preview when QA needs it

The preview workflow normally infers backend needs from changed paths. Force a
backend preview when deployed QA requires sign-in, seeded data, the API Worker,
or ingestion behavior even if path detection would choose frontend-only.

- Add the `preview:backend` label when configuring the PR before or during a
  preview run.
- Comment exactly `/preview-backend` to add the label and rerun an eligible
  completed preview for the current head.
- Remove a conflicting `preview:frontend-only` label.
- Wait for `Preview Environment` to finish, then use the URL in its rolling
  `<!-- preview-environment -->` comment for QA.

Do not mark preview QA complete from a deployment for an older head.

## Inspect one review iteration

For the current head SHA, collect all of the following:

1. GitHub checks and Actions jobs, including skipped or cancelled jobs.
2. Failed-step logs and check annotations, not just the check title.
3. Formal reviews, review state, inline threads, and thread-resolution state.
4. All top-level PR comments, including bot comments that may be edited in
   place.
5. The current SonarQube analysis, quality gate, issues, and security hotspots.
6. The preview deployment result and any required hands-on QA.

`gh pr view` alone does not expose enough inline-thread state. Use GitHub
GraphQL's `reviewThreads` connection when needed, and inspect unresolved and
outdated threads explicitly. Re-fetch comments after checks finish because
review bots can post late or overwrite a rolling comment.

## Inspect SonarQube through its public API

Use the public project data rather than relying only on GitHub's SonarQube
decoration:

- Host: `https://sonarcloud.io`
- Project key: `Robbie-Palmer_personal-site`

First query:

```text
GET /api/project_pull_requests/list?project=Robbie-Palmer_personal-site
```

Select the entry whose `key` is the PR number and require its `commit.sha` to
equal the current GitHub head SHA. If it is absent or stale, wait for analysis
and query again.

For the matching analysis, query:

```text
GET /api/qualitygates/project_status?projectKey=Robbie-Palmer_personal-site&pullRequest=<PR>
GET /api/issues/search?componentKeys=Robbie-Palmer_personal-site&pullRequest=<PR>&resolved=false&ps=500
GET /api/hotspots/search?projectKey=Robbie-Palmer_personal-site&pullRequest=<PR>&status=TO_REVIEW&ps=500
```

Use URL-encoded query parameters and paginate if a response exceeds its page
size. Inspect each issue's rule, severity, type, message, component, line, and
status, plus every failed quality-gate condition. Fix true issues and let a new
analysis clear them. For a false positive, preserve a concise technical
rationale; do not weaken code or tests merely to change the metric. If clearing
a false-positive gate requires SonarQube permissions unavailable to the agent,
report that exact blocker instead of claiming the gate is settled.

## Triage and repair

For every current finding:

- Reproduce or inspect the cited behavior against the current diff and
  surrounding code.
- Fix true correctness, security, reliability, maintainability, test, or
  documentation issues.
- Add regression coverage when it materially protects the fix.
- Address reasonable nits when cheap and consistent with repository style, but
  do not churn code for subjective preferences.
- Reply with a specific rationale when rejecting a false positive or stale
  finding.
- Resolve an inline thread only after its concern is fixed or explicitly
  dispositioned. Do not hide unresolved human objections.
- Treat failing CI as a real issue until logs demonstrate an infrastructure or
  unrelated failure. Retry only genuinely transient failures.

Run relevant local checks after repairs. Then commit and push the repair batch
and begin a new iteration from the new head SHA. Prefer coherent batches over a
separate commit for every bot comment.

## Settle the draft phase

Remain in draft until all of these are true for the same head:

- Every relevant check is terminal and required checks pass.
- Any skipped check is expected and understood.
- The SonarQube PR entry matches the head SHA, its quality gate passes, and no
  unresolved true issue or hotspot remains.
- Draft-visible third-party reviewers have no unaddressed true issue or active
  change request.
- Required preview QA passes.
- A final refresh finds no late actionable comment.
- The worktree is clean and all intended commits are pushed.

Then move the PR to ready for review. This transition intentionally triggers
the custom AI review and may trigger reviewers that ignore drafts.

## Phase 2: settle ready-for-review feedback

After marking the PR ready:

1. Wait for all current-head CI and reviewer activity, including the automatic
   custom AI review.
2. Run the complete inspection, triage, repair, commit, and push loop again.
3. Re-check third-party reviewer comments after each push until they contain no
   unresolved true issue.
4. Address every substantive finding from the initial custom AI review, either
   with a fix or a concrete false-positive/stale rationale.

The custom AI reviewer maintains one top-level comment containing
`<!-- ai-code-review -->` and overwrites that same comment on later runs. Never
rely on a cached copy. After each `AI code review` run completes, fetch all PR
comments again, locate the marker, and read the entire current body.

## Request follow-up custom AI reviews

Once third-party feedback and the initial custom review are settled:

1. Determine whether the head changed after the most recent completed custom AI
   review.
2. If it changed, comment exactly `/ai-review` once to request a fresh review.
3. Wait for the matching `AI code review` workflow run to finish.
4. Re-fetch the overwritten marker comment and triage its new contents.
5. Fix substantive true findings, push one coherent batch, settle CI and
   third-party feedback again, then request another custom review if the head
   changed.

Do not request another paid review when the head has not changed. Stop the
custom-review cycle when its current comment has no substantive true issue and
only nitpicks, duplicates, stale observations, or false positives remain.
Record concise dispositions for rejected findings. If the review is skipped
because of exhausted credits or no model coverage, report that limitation
truthfully rather than treating it as a clean review.

## Completion gate

Finish only when the PR is ready for review and, for one current head SHA:

- CI and the SonarQube gate pass;
- SonarQube has no unresolved true issue or hotspot;
- required preview QA passes;
- no third-party reviewer has an unresolved true issue;
- the latest applicable custom AI review has no substantive true issue;
- false positives and intentionally unaddressed nitpicks have explicit,
  evidence-based dispositions; and
- there are no uncommitted or unpushed fixes.

Report the PR URL, final head SHA, checks and SonarQube status, QA performed,
review rounds completed, and any remaining nitpick or false-positive
dispositions.
