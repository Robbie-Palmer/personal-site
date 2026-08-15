import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";

const event: ReviewWorkflowParams = {
  deliveryId: "workerd-delivery-1",
  eventName: "pull_request",
  action: "synchronize",
  repository: "Robbie-Palmer/personal-site",
  pullRequestNumber: 42,
  headSha: "a".repeat(40),
  force: false,
};

function coordinator() {
  const bindings = env as unknown as Env;
  return bindings.PR_STATE.getByName(
    `${event.repository}#${event.pullRequestNumber}`,
  );
}

describe("PullRequestCoordinator in workerd", () => {
  it("persists delivery deduplication and alarms across eviction", async () => {
    const stub = coordinator();
    const first = await stub.fetch("https://coordinator.test/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
    await expect(first.json()).resolves.toMatchObject({
      accepted: true,
      enabled: true,
    });
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).not.toBeNull();
      expect(
        state.storage.sql
          .exec<{ delivery_id: string }>(
            "SELECT delivery_id FROM webhook_deliveries",
          )
          .toArray(),
      ).toEqual([{ delivery_id: event.deliveryId }]);
    });

    await evictDurableObject(stub);
    const duplicate = await coordinator().fetch(
      "https://coordinator.test/events",
      {
        method: "POST",
        body: JSON.stringify(event),
      },
    );
    await expect(duplicate.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
  });

  it("claims a configuration once and records its completion in SQLite", async () => {
    const stub = coordinator();
    const claimBody = {
      runId: "workerd-review-1",
      headSha: event.headSha,
      diffFingerprint: "diff-hash",
      configFingerprint: "config-hash",
      force: false,
      maxRuns: 20,
      maxCostUsd: 5,
    };
    const claim = await stub.fetch(
      "https://coordinator.test/reviews/claim",
      {
        method: "POST",
        body: JSON.stringify(claimBody),
      },
    );
    await expect(claim.json()).resolves.toMatchObject({ claimed: true });

    const completion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: JSON.stringify({
          repository: event.repository,
          pullRequestNumber: event.pullRequestNumber,
          runId: claimBody.runId,
          headSha: event.headSha,
          costUsd: 0.25,
          commentId: 123,
          hunks: [
            {
              hunkId: `h_${"c".repeat(24)}`,
              fingerprint: "d".repeat(64),
              file: "app.ts",
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
            },
          ],
          findings: [
            {
              findingId: `f_${"b".repeat(24)}`,
              hunkIds: [`h_${"c".repeat(24)}`],
              severity: "high",
              file: "app.ts",
              line: 1,
              title: "Finding",
              evidence: "Evidence",
              recommendation: "Fix it",
              confidence: 0.9,
              source_models: ["model/scout"],
              status: "open",
              resolution_note: "",
            },
          ],
          findingPublications: [
            {
              findingId: `f_${"b".repeat(24)}`,
              delivery: "line",
              commentId: 321,
              reconciled: false,
              path: "app.ts",
              line: 1,
            },
          ],
        }),
      },
    );
    await expect(completion.json()).resolves.toEqual({ completed: true });

    const firstBaseline = await stub.fetch(
      "https://coordinator.test/reviews/baseline",
      { method: "POST", body: "{}" },
    );
    await expect(firstBaseline.json()).resolves.toEqual({
      headSha: event.headSha,
      hunkIds: [`h_${"c".repeat(24)}`],
      openFindings: [
        {
          findingId: `f_${"b".repeat(24)}`,
          file: "app.ts",
          title: "Finding",
          severity: "high",
          line: 1,
          evidence: "Evidence",
          recommendation: "Fix it",
          hunkIds: [`h_${"c".repeat(24)}`],
        },
      ],
    });

    const interaction = {
      deliveryId: "workerd-feedback-1",
      eventName: "pull_request_review_thread",
      action: "resolved",
      repository: event.repository,
      pullRequestNumber: event.pullRequestNumber,
      interactionType: "thread",
      actor: "Robbie-Palmer",
      rootCommentId: 321,
      threadId: "PRRT_thread",
      occurredAt: "2026-08-09T12:00:00Z",
    };
    const interactionResponse = await stub.fetch(
      "https://coordinator.test/interactions",
      { method: "POST", body: JSON.stringify(interaction) },
    );
    await expect(interactionResponse.json()).resolves.toEqual({
      accepted: true,
      duplicate: false,
      findingId: `f_${"b".repeat(24)}`,
    });
    const duplicateInteraction = await stub.fetch(
      "https://coordinator.test/interactions",
      { method: "POST", body: JSON.stringify(interaction) },
    );
    await expect(duplicateInteraction.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
      findingId: `f_${"b".repeat(24)}`,
    });
    const evidenceKey = [
      "v2",
      event.repository,
      `pr-${event.pullRequestNumber}`,
      "findings",
      `f_${"b".repeat(24)}`,
      "evidence",
      `${interaction.deliveryId}.json`,
    ].join("/");
    const evidence = await (env as unknown as Env).REVIEW_DATA.get(evidenceKey);
    expect(await evidence?.json()).toMatchObject({
      schemaVersion: 2,
      evidenceVersion: 1,
      recordType: "finding-interaction-evidence",
      action: "resolved",
      findingId: `f_${"b".repeat(24)}`,
    });
    const dispositionInteraction = {
      deliveryId: "workerd-feedback-2",
      eventName: "issue_comment",
      action: "created",
      repository: event.repository,
      pullRequestNumber: event.pullRequestNumber,
      interactionType: "disposition",
      actor: "Robbie-Palmer",
      actorAssociation: "OWNER",
      findingId: `f_${"b".repeat(24)}`,
      disposition: "acknowledged",
      reason: "Accepted and fixing now",
      occurredAt: "2026-08-09T12:05:00Z",
    };
    const dispositionResponse = await stub.fetch(
      "https://coordinator.test/interactions",
      { method: "POST", body: JSON.stringify(dispositionInteraction) },
    );
    await expect(dispositionResponse.json()).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      findingId: dispositionInteraction.findingId,
    });
    const outcomePrefix = [
      "v2",
      event.repository,
      `pr-${event.pullRequestNumber}`,
      "findings",
      `f_${"b".repeat(24)}`,
      "outcomes",
    ].join("/");
    const acknowledgedOutcome = await (env as unknown as Env).REVIEW_DATA.get(
      `${outcomePrefix}/v1.json`,
    );
    expect(await acknowledgedOutcome?.json()).toMatchObject({
      schemaVersion: 2,
      recordType: "finding-outcome",
      outcomeVersion: 1,
      outcome: "acknowledged",
      basis: "explicit-disposition",
      evidence: {
        deliveryId: dispositionInteraction.deliveryId,
        actor: dispositionInteraction.actor,
      },
    });

    const duplicateClaim = await stub.fetch(
      "https://coordinator.test/reviews/claim",
      {
        method: "POST",
        body: JSON.stringify({ ...claimBody, runId: "workerd-review-2" }),
      },
    );
    await expect(duplicateClaim.json()).resolves.toMatchObject({
      claimed: false,
      reason: "this content and reviewer configuration were already reviewed",
    });

    const laterHead = "e".repeat(40);
    const laterRunId = "workerd-review-3";
    const laterClaim = await stub.fetch(
      "https://coordinator.test/reviews/claim",
      {
        method: "POST",
        body: JSON.stringify({
          ...claimBody,
          runId: laterRunId,
          headSha: laterHead,
          diffFingerprint: "later-diff-hash",
        }),
      },
    );
    await expect(laterClaim.json()).resolves.toMatchObject({ claimed: true });
    const laterCompletionBody = JSON.stringify({
      repository: event.repository,
      pullRequestNumber: event.pullRequestNumber,
      runId: laterRunId,
      headSha: laterHead,
      costUsd: 0.1,
      hunks: [
        {
          hunkId: `h_${"c".repeat(24)}`,
          fingerprint: "d".repeat(64),
          file: "app.ts",
          oldStart: 50,
          oldLines: 1,
          newStart: 60,
          newLines: 1,
        },
      ],
      currentHunks: [
        {
          hunkId: `h_${"c".repeat(24)}`,
          fingerprint: "d".repeat(64),
          file: "app.ts",
          oldStart: 50,
          oldLines: 1,
          newStart: 60,
          newLines: 1,
        },
        {
          hunkId: `h_${"e".repeat(24)}`,
          fingerprint: "f".repeat(64),
          file: "unchanged.ts",
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
        },
      ],
      findings: [
        {
          findingId: `f_${"b".repeat(24)}`,
          hunkIds: [`h_${"c".repeat(24)}`],
          severity: "high",
          file: "app.ts",
          line: 60,
          title: "Finding",
          evidence: "Evidence",
          recommendation: "Fix it",
          confidence: 0.9,
          source_models: ["model/scout"],
          status: "resolved",
          resolution_note: "Fixed in the later head",
        },
      ],
      findingPublications: [
        {
          findingId: `f_${"b".repeat(24)}`,
          delivery: "line",
          commentId: 321,
          reconciled: true,
          path: "app.ts",
          line: 60,
        },
      ],
    });
    const laterCompletion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: laterCompletionBody,
      },
    );
    await expect(laterCompletion.json()).resolves.toEqual({ completed: true });
    const retriedCompletion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      { method: "POST", body: laterCompletionBody },
    );
    await expect(retriedCompletion.json()).resolves.toEqual({
      completed: true,
      duplicate: true,
    });
    expect(
      await (env as unknown as Env).REVIEW_DATA.get(`${outcomePrefix}/v2.json`),
    ).toBeNull();

    const fixedHead = "f".repeat(40);
    const fixedRunId = "workerd-review-4";
    const fixedHunk = {
      hunkId: `h_${"f".repeat(24)}`,
      fingerprint: "1".repeat(64),
      file: "app.ts",
      oldStart: 50,
      oldLines: 1,
      newStart: 60,
      newLines: 1,
    };
    const fixedClaim = await stub.fetch(
      "https://coordinator.test/reviews/claim",
      {
        method: "POST",
        body: JSON.stringify({
          ...claimBody,
          runId: fixedRunId,
          headSha: fixedHead,
          diffFingerprint: "fixed-diff-hash",
        }),
      },
    );
    await expect(fixedClaim.json()).resolves.toMatchObject({ claimed: true });
    const fixedCompletion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: JSON.stringify({
          repository: event.repository,
          pullRequestNumber: event.pullRequestNumber,
          runId: fixedRunId,
          headSha: fixedHead,
          costUsd: 0.1,
          hunks: [fixedHunk],
          currentHunks: [
            fixedHunk,
            {
              hunkId: `h_${"e".repeat(24)}`,
              fingerprint: "f".repeat(64),
              file: "unchanged.ts",
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
            },
          ],
          findings: [],
          findingResolutions: [{
            findingId: `f_${"b".repeat(24)}`,
            verdict: "fixed",
            evidence: "The later diff removes the defective branch.",
          }],
        }),
      },
    );
    await expect(fixedCompletion.json()).resolves.toEqual({ completed: true });
    const fixedOutcome = await (env as unknown as Env).REVIEW_DATA.get(
      `${outcomePrefix}/v2.json`,
    );
    expect(await fixedOutcome?.json()).toMatchObject({
      schemaVersion: 2,
      recordType: "finding-outcome",
      outcomeVersion: 2,
      outcome: "confirmed-fixed",
      basis: "later-reviewed-head",
      evidence: {
        confirmation: "affirmative-controlled-replay",
        replayEvidence: "The later diff removes the defective branch.",
        firstSeenHeadSha: event.headSha,
        outcomeHeadSha: fixedHead,
        outcomeRunId: fixedRunId,
        priorHunkIds: [`h_${"c".repeat(24)}`],
      },
    });
    const laterBaseline = await stub.fetch(
      "https://coordinator.test/reviews/baseline",
      { method: "POST", body: "{}" },
    );
    await expect(laterBaseline.json()).resolves.toMatchObject({
      headSha: fixedHead,
      hunkIds: [`h_${"e".repeat(24)}`, fixedHunk.hunkId],
    });
    await runInDurableObject(stub, async (_instance, state) => {
      expect(
        state.storage.sql
          .exec<{ status: string; cost_usd: number }>(
            "SELECT status, cost_usd FROM review_runs WHERE run_id = ?",
            claimBody.runId,
          )
          .toArray(),
      ).toEqual([{ status: "completed", cost_usd: 0.25 }]);
      expect(
        state.storage.sql
          .exec<{
            finding_id: string;
            status: string;
            first_seen_head_sha: string;
            last_seen_head_sha: string;
            first_seen_run_id: string;
            last_seen_run_id: string;
          }>(
            `SELECT finding_id, status, first_seen_head_sha,
                    last_seen_head_sha, first_seen_run_id, last_seen_run_id
             FROM review_findings`,
          )
          .toArray(),
      ).toEqual([
        {
          finding_id: `f_${"b".repeat(24)}`,
          status: "resolved",
          first_seen_head_sha: event.headSha,
          last_seen_head_sha: laterHead,
          first_seen_run_id: claimBody.runId,
          last_seen_run_id: laterRunId,
        },
      ]);
      expect(
        state.storage.sql
          .exec<{ action: string; r2_recorded: number }>(
            `SELECT action, r2_recorded FROM review_finding_events
             ORDER BY occurred_at`,
          )
          .toArray(),
      ).toEqual([
        { action: "resolved", r2_recorded: 1 },
        { action: "created", r2_recorded: 1 },
      ]);
      expect(
        state.storage.sql
          .exec<{
            outcome_version: number;
            outcome: string;
            basis: string;
            r2_recorded: number;
          }>(
            `SELECT outcome_version, outcome, basis, r2_recorded
             FROM review_finding_outcomes ORDER BY outcome_version`,
          )
          .toArray(),
      ).toEqual([
        {
          outcome_version: 1,
          outcome: "acknowledged",
          basis: "explicit-disposition",
          r2_recorded: 1,
        },
        {
          outcome_version: 2,
          outcome: "confirmed-fixed",
          basis: "later-reviewed-head",
          r2_recorded: 1,
        },
      ]);
    });
  });

  it("uses a zero-cost skipped completion as the next review baseline", async () => {
    const stub = coordinator();
    const runId = "workerd-skipped-review";
    const currentHunk = {
      hunkId: `h_${"a".repeat(24)}`,
      fingerprint: "b".repeat(64),
      file: "pnpm-lock.yaml",
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
    };
    const claim = await stub.fetch("https://coordinator.test/reviews/claim", {
      method: "POST",
      body: JSON.stringify({
        runId,
        headSha: event.headSha,
        diffFingerprint: "skipped-diff-hash",
        configFingerprint: "config-hash",
        force: false,
        maxRuns: 20,
        maxCostUsd: 5,
      }),
    });
    await expect(claim.json()).resolves.toMatchObject({ claimed: true });

    const completion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: JSON.stringify({
          repository: event.repository,
          pullRequestNumber: event.pullRequestNumber,
          runId,
          headSha: event.headSha,
          costUsd: 0,
          hunks: [],
          currentHunks: [currentHunk],
          findings: [],
          findingPublications: [],
        }),
      },
    );
    await expect(completion.json()).resolves.toEqual({ completed: true });

    const baseline = await stub.fetch(
      "https://coordinator.test/reviews/baseline",
      { method: "POST", body: "{}" },
    );
    await expect(baseline.json()).resolves.toEqual({
      headSha: event.headSha,
      hunkIds: [currentHunk.hunkId],
      openFindings: [],
    });
  });

  it("finalizes unanswered and superseded findings when a pull request closes", async () => {
    const bindings = env as unknown as Env;
    const pullRequestNumber = 43;
    const repository = event.repository;
    const stub = bindings.PR_STATE.getByName(
      `${repository}#${pullRequestNumber}`,
    );
    const initialHead = "1".repeat(40);
    const finalHead = "2".repeat(40);
    const remainingHunk = {
      hunkId: `h_${"1".repeat(24)}`,
      fingerprint: "1".repeat(64),
      file: "remaining.ts",
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
    };
    const removedHunk = {
      hunkId: `h_${"2".repeat(24)}`,
      fingerprint: "2".repeat(64),
      file: "removed.ts",
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
    };
    const finding = (suffix: string, hunk: typeof remainingHunk) => ({
      findingId: `f_${suffix.repeat(24)}`,
      hunkIds: [hunk.hunkId],
      severity: "medium",
      file: hunk.file,
      line: 1,
      title: `${hunk.file} finding`,
      evidence: "Evidence",
      recommendation: "Fix it",
      confidence: 0.8,
      source_models: ["model/scout"],
      status: "open",
      resolution_note: "",
    });
    const remainingFinding = finding("3", remainingHunk);
    const removedFinding = finding("4", removedHunk);

    const claim = async (runId: string, headSha: string, fingerprint: string) =>
      stub.fetch("https://coordinator.test/reviews/claim", {
        method: "POST",
        body: JSON.stringify({
          runId,
          headSha,
          diffFingerprint: fingerprint,
          configFingerprint: "config-hash",
          force: false,
          maxRuns: 20,
          maxCostUsd: 5,
        }),
      });
    await expect(
      (await claim("outcome-initial", initialHead, "initial-diff")).json(),
    ).resolves.toMatchObject({ claimed: true });
    const initialCompletion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: JSON.stringify({
          repository,
          pullRequestNumber,
          runId: "outcome-initial",
          headSha: initialHead,
          costUsd: 0.1,
          hunks: [remainingHunk, removedHunk],
          findings: [remainingFinding, removedFinding],
        }),
      },
    );
    await expect(initialCompletion.json()).resolves.toEqual({ completed: true });

    await expect(
      (await claim("outcome-final", finalHead, "final-diff")).json(),
    ).resolves.toMatchObject({ claimed: true });
    const finalCompletion = await stub.fetch(
      "https://coordinator.test/reviews/complete",
      {
        method: "POST",
        body: JSON.stringify({
          repository,
          pullRequestNumber,
          runId: "outcome-final",
          headSha: finalHead,
          costUsd: 0,
          hunks: [],
          currentHunks: [remainingHunk],
          findings: [],
        }),
      },
    );
    await expect(finalCompletion.json()).resolves.toEqual({ completed: true });

    const finalization = {
      deliveryId: "outcome-finalization",
      eventName: "pull_request",
      action: "closed",
      repository,
      pullRequestNumber,
      headSha: finalHead,
      finalState: "merged",
      occurredAt: "2026-08-15T12:00:00Z",
    };
    const finalized = await stub.fetch(
      "https://coordinator.test/finalizations",
      { method: "POST", body: JSON.stringify(finalization) },
    );
    await expect(finalized.json()).resolves.toEqual({
      accepted: true,
      duplicate: false,
      outcomes: 2,
    });
    const duplicate = await stub.fetch(
      "https://coordinator.test/finalizations",
      { method: "POST", body: JSON.stringify(finalization) },
    );
    await expect(duplicate.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
      outcomes: 0,
    });

    const outcome = async (findingId: string) => {
      const key = [
        "v2",
        repository,
        `pr-${pullRequestNumber}`,
        "findings",
        findingId,
        "outcomes",
        "v1.json",
      ].join("/");
      return bindings.REVIEW_DATA.get(key).then((record) => record?.json());
    };
    await expect(outcome(remainingFinding.findingId)).resolves.toMatchObject({
      outcome: "no-observable-response",
      basis: "pull-request-finalization",
      evidence: { finalHeadWasReviewed: true, affectedCodeRemains: true },
    });
    await expect(outcome(removedFinding.findingId)).resolves.toMatchObject({
      outcome: "superseded",
      basis: "pull-request-finalization",
      evidence: { finalHeadWasReviewed: true, affectedCodeRemains: false },
    });
  });
});
