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
        }),
      },
    );
    await expect(completion.json()).resolves.toEqual({ completed: true });

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
    });
  });
});
