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
          findings: [{ title: "Finding" }],
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
    await runInDurableObject(stub, async (_instance, state) => {
      expect(
        state.storage.sql
          .exec<{ status: string; cost_usd: number }>(
            "SELECT status, cost_usd FROM review_runs WHERE run_id = ?",
            claimBody.runId,
          )
          .toArray(),
      ).toEqual([{ status: "completed", cost_usd: 0.25 }]);
    });
  });
});
