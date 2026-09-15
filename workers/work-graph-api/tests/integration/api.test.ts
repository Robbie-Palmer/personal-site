import {
  closeDb,
  createDb,
  schema,
  WorkGraphRepository,
} from "work-graph-db";
import { createWorkGraphApp } from "../../src/index";

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
  throw new Error("DATABASE_URL is required for integration tests.");
}

const db = createDb(databaseURL);
const repository = new WorkGraphRepository(db);
const app = createWorkGraphApp(repository);

const recordId = (suffix: number): string =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const requestJson = async (
  path: string,
  method: "POST" | "DELETE" = "POST",
  body?: unknown,
  idempotencyKey?: string,
): Promise<Response> =>
  app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey === undefined
        ? {}
        : { "idempotency-key": idempotencyKey }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(async () => {
  await db.transaction(async (transaction) => {
    await transaction.delete(schema.attentionResolution);
    await transaction.delete(schema.attentionRequest);
    await transaction.delete(schema.note);
    await transaction.delete(schema.lease);
    await transaction.delete(schema.idempotencyKey);
    await transaction.delete(schema.workItemDependency);
    await transaction.delete(schema.workItemHierarchy);
    await transaction.delete(schema.workItem);
  });
});

describe("Given a claimed item that reveals more work", () => {
  it("replays one ranked decomposition with its same-worker child claim", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent context" });
    const claimResponse = await requestJson("/api/leases", "POST", {
      workItemId: "parent",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    const parentClaim = (await claimResponse.json()) as {
      lease: { id: string; epoch: number };
    };
    const body = {
      leaseId: parentClaim.lease.id,
      epoch: parentClaim.lease.epoch,
      children: [
        { id: "later", title: "Later child", rank: 20 },
        { id: "first", title: "First child", rank: 10 },
      ],
      dependencies: [
        { dependentWorkItemId: "later", blockerWorkItemId: "first" },
      ],
      claim: {
        workItemId: "first",
        leaseId: recordId(301),
        leaseDurationSeconds: 120,
      },
    };
    const key = recordId(302);

    const first = await requestJson(
      "/api/work-items/parent/decompositions",
      "POST",
      body,
      key,
    );
    const replay = await requestJson(
      "/api/work-items/parent/decompositions",
      "POST",
      body,
      key,
    );
    const firstBody = (await first.json()) as Record<string, unknown>;

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(firstBody);
    expect(firstBody).toEqual(
      expect.objectContaining({
        parent: expect.objectContaining({
          id: "parent",
          lifecycle: "open",
          stage: "blocked",
        }),
        children: [
          expect.objectContaining({
            rank: 10,
            workItem: expect.objectContaining({
              id: "first",
              parentId: "parent",
              stage: "in_progress",
            }),
          }),
          expect.objectContaining({
            rank: 20,
            workItem: expect.objectContaining({
              id: "later",
              parentId: "parent",
              stage: "blocked",
            }),
          }),
        ],
        endedLease: expect.objectContaining({ outcome: "decomposed" }),
        claimedLease: expect.objectContaining({
          id: recordId(301),
          workItemId: "first",
          workerId: "worker-a",
        }),
      }),
    );
    expect(await db.select().from(schema.workItemHierarchy)).toHaveLength(2);
    expect(await db.select().from(schema.workItemDependency)).toHaveLength(1);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(1);
  });
});

afterAll(async () => {
  await closeDb(db);
});

describe("Given persisted work with blockers", () => {
  it("lists lifecycle separately from its derived operational stage", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    await repository.addDependency({
      dependentWorkItemId: "parent",
      blockerWorkItemId: "blocker",
    });

    const allResponse = await app.request("/api/work-items");
    const all = (await allResponse.json()) as {
      items: Array<{ id: string; lifecycle: string; stage: string }>;
    };
    const readyResponse = await app.request("/api/work-items?stage=ready");
    const ready = (await readyResponse.json()) as {
      items: Array<{ id: string }>;
    };

    expect(allResponse.status).toBe(200);
    expect(
      Object.fromEntries(
        all.items.map(({ id, lifecycle, stage }) => [
          id,
          { lifecycle, stage },
        ]),
      ),
    ).toEqual({
      parent: { lifecycle: "open", stage: "blocked" },
      child: { lifecycle: "open", stage: "blocked" },
      blocker: { lifecycle: "open", stage: "ready" },
    });
    expect(ready.items.map(({ id }) => id)).toEqual(["blocker"]);
  });

  it("continues a ready-work page after an earlier item is claimed", async () => {
    await repository.createWorkItem({ id: "a-ready", title: "First" });
    await repository.createWorkItem({ id: "b-ready", title: "Second" });

    const firstResponse = await app.request(
      "/api/work-items?stage=ready&limit=1",
    );
    const first = (await firstResponse.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(first).toEqual({
      items: [expect.objectContaining({ id: "a-ready" })],
      nextCursor: "a-ready",
    });

    const claimResponse = await requestJson("/api/leases", "POST", {
      workItemId: "a-ready",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    expect(claimResponse.status).toBe(201);

    const nextResponse = await app.request(
      `/api/work-items?stage=ready&limit=1&cursor=${first.nextCursor}`,
    );
    const next = (await nextResponse.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(next).toEqual({
      items: [expect.objectContaining({ id: "b-ready" })],
      nextCursor: null,
    });
  });
});

describe("Given graph mutations over HTTP", () => {
  it("replays concurrent sparse work-item creation without a duplicate row", async () => {
    const key = "00000000-0000-4000-8000-000000000091";
    const request = () =>
      requestJson(
        "/api/work-items",
        "POST",
        { id: "sparse", title: "Sparse work item" },
        key,
      );

    const [first, retry] = await Promise.all([request(), request()]);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(await first.json());
    expect((await repository.load()).workItems).toEqual([
      {
        id: "sparse",
        title: "Sparse work item",
        lifecycle: "open",
        parentId: null,
        rank: null,
      },
    ]);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(1);
  });

  it("does not retain an unreplayable receipt when the retry key is omitted", async () => {
    const response = await requestJson("/api/work-items", "POST", {
      id: "unkeyed",
      title: "Unkeyed work item",
    });

    expect(response.status).toBe(201);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(0);
  });

  it("adds and removes a dependency idempotently while readiness stays derived", async () => {
    await repository.createWorkItem({ id: "dependent", title: "Dependent" });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    const edge = {
      dependentWorkItemId: "dependent",
      blockerWorkItemId: "blocker",
    };
    const addKey = "00000000-0000-4000-8000-000000000092";
    const removeKey = "00000000-0000-4000-8000-000000000093";

    const added = await requestJson(
      "/api/dependencies",
      "POST",
      edge,
      addKey,
    );
    const addRetry = await requestJson(
      "/api/dependencies",
      "POST",
      edge,
      addKey,
    );
    expect(added.status).toBe(201);
    expect(addRetry.status).toBe(201);
    expect((await repository.getWorkItem("dependent")).stage).toBe("blocked");

    const removed = await requestJson(
      "/api/dependencies",
      "DELETE",
      edge,
      removeKey,
    );
    const removeRetry = await requestJson(
      "/api/dependencies",
      "DELETE",
      edge,
      removeKey,
    );
    expect(removed.status).toBe(200);
    expect(removeRetry.status).toBe(200);
    expect((await repository.getWorkItem("dependent")).stage).toBe("ready");
    expect((await repository.load()).dependencies).toEqual([]);
  });

  it("rejects reuse of one idempotency key for different input", async () => {
    const key = "00000000-0000-4000-8000-000000000094";
    const first = await requestJson(
      "/api/work-items",
      "POST",
      { id: "first", title: "First" },
      key,
    );
    const conflict = await requestJson(
      "/api/work-items",
      "POST",
      { id: "second", title: "Second" },
      key,
    );

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: {
        code: "idempotency_key_reused",
        message: `Idempotency key ${key} was already used for a different mutation.`,
      },
    });
    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "first",
    ]);
  });

  it("serializes concurrent dependency writes against the combined waits-for graph", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "middle", title: "Middle" });

    const responses = await Promise.all([
      requestJson(
        "/api/dependencies",
        "POST",
        {
          dependentWorkItemId: "child",
          blockerWorkItemId: "middle",
        },
        "00000000-0000-4000-8000-000000000095",
      ),
      requestJson(
        "/api/dependencies",
        "POST",
        {
          dependentWorkItemId: "middle",
          blockerWorkItemId: "parent",
        },
        "00000000-0000-4000-8000-000000000096",
      ),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const conflict = responses.find(({ status }) => status === 409);
    expect(await conflict?.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "graph_cycle" }),
      }),
    );
    expect((await repository.load()).dependencies).toHaveLength(1);
  });
});

describe("Given claimed work that needs notes or attention", () => {
  it("records a note, pauses for a decision, and becomes claimable after resolution", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    const claimResponse = await requestJson("/api/leases", "POST", {
      workItemId: "work",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    const claim = (await claimResponse.json()) as {
      lease: { id: string; epoch: number };
    };
    const noteRequest = () =>
      requestJson(
        "/api/work-items/work/notes",
        "POST",
        {
          id: recordId(301),
          leaseId: claim.lease.id,
          epoch: claim.lease.epoch,
          content: "The dependency contract is complete.",
        },
        recordId(302),
      );

    const noteResponse = await noteRequest();
    const noteReplay = await noteRequest();
    expect(noteResponse.status).toBe(201);
    expect(noteReplay.status).toBe(201);
    expect(await noteReplay.json()).toEqual(await noteResponse.json());
    expect(await repository.listNotes("work")).toHaveLength(1);

    const attentionBody = {
      id: recordId(303),
      workItemId: "work",
      leaseId: claim.lease.id,
      epoch: claim.lease.epoch,
      kind: "decision",
      question: "Should the next slice include attention resolution?",
      note: "The worker can resume once this is answered.",
    };
    const attentionResponse = await requestJson(
      "/api/attention-requests",
      "POST",
      attentionBody,
      recordId(304),
    );
    const attention = (await attentionResponse.json()) as {
      attentionRequest: { id: string; requestingLeaseId: string };
      endedLease: { workerId: string; outcome: string };
      workItem: { stage: string; currentLease: unknown };
    };

    expect(attentionResponse.status).toBe(201);
    expect(attention.attentionRequest).toEqual(
      expect.objectContaining({
        id: recordId(303),
        requestingLeaseId: claim.lease.id,
      }),
    );
    expect(attention.endedLease).toEqual(
      expect.objectContaining({
        workerId: "worker-a",
        outcome: "attention_requested",
      }),
    );
    expect(attention.workItem).toEqual(
      expect.objectContaining({
        stage: "needs_attention",
        currentLease: null,
      }),
    );
    const pendingResponse = await app.request("/api/attention-requests");
    const pendingAttention = (await pendingResponse.json()) as {
      items: Array<{ id: string }>;
    };
    expect(pendingAttention.items.map(({ id }) => id)).toEqual([
      recordId(303),
    ]);

    const blockedClaim = await requestJson("/api/leases", "POST", {
      workItemId: "work",
      workerId: "worker-b",
      leaseDurationSeconds: 300,
    });
    expect(blockedClaim.status).toBe(409);

    const resolutionBody = {
      id: recordId(305),
      resolution: "Yes. Resolution completes the pause-and-resume loop.",
    };
    const resolveRequest = () =>
      requestJson(
        `/api/attention-requests/${recordId(303)}/resolutions`,
        "POST",
        resolutionBody,
        recordId(306),
      );
    const resolutionResponse = await resolveRequest();
    const resolutionReplay = await resolveRequest();
    const resolution = (await resolutionResponse.json()) as {
      workItem: { stage: string };
    };

    expect(resolutionResponse.status).toBe(201);
    expect(resolutionReplay.status).toBe(201);
    expect(resolution.workItem.stage).toBe("ready");
    const noPendingResponse = await app.request("/api/attention-requests");
    const noPendingAttention = (await noPendingResponse.json()) as {
      items: unknown[];
    };
    expect(noPendingAttention.items).toEqual([]);
    const resolvedResponse = await app.request(
      "/api/attention-requests?state=resolved",
    );
    const resolvedAttention = (await resolvedResponse.json()) as {
      items: Array<{ id: string }>;
    };
    expect(resolvedAttention.items.map(({ id }) => id)).toEqual([
      recordId(303),
    ]);
    const resumed = await requestJson("/api/leases", "POST", {
      workItemId: "work",
      workerId: "worker-b",
      leaseDurationSeconds: 300,
    });
    const resumedBody = (await resumed.json()) as {
      lease: { workerId: string; epoch: number };
    };
    expect(resumed.status).toBe(201);
    expect(resumedBody.lease).toEqual(
      expect.objectContaining({ workerId: "worker-b", epoch: 2 }),
    );
  });

  it("returns blocked after resolution when a dependency was added during the pause", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(307),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");
    await requestJson(
      "/api/attention-requests",
      "POST",
      {
        id: recordId(308),
        workItemId: "work",
        leaseId: claimed.id,
        epoch: claimed.epoch,
        kind: "input",
        question: "Which prerequisite applies?",
      },
      recordId(309),
    );
    await repository.addDependency({
      dependentWorkItemId: "work",
      blockerWorkItemId: "blocker",
    });

    const response = await requestJson(
      `/api/attention-requests/${recordId(308)}/resolutions`,
      "POST",
      {
        id: recordId(310),
        resolution: "The blocker must finish first.",
      },
      recordId(311),
    );
    const body = (await response.json()) as { workItem: { stage: string } };

    expect(response.status).toBe(201);
    expect(body.workItem.stage).toBe("blocked");
  });
});

describe("Given lease-backed work over HTTP", () => {
  it("distinguishes a missing specified item from ineligible work", async () => {
    const response = await requestJson("/api/leases", "POST", {
      workItemId: "missing",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "work_item_not_found",
        message: "Work item missing does not exist.",
      },
    });
  });

  it("claims, renews, and releases one specified work item", async () => {
    await repository.createWorkItem({ id: "work", title: "Release me" });

    const claimResponse = await requestJson("/api/leases", "POST", {
      workItemId: "work",
      workerId: "worker-a",
      leaseDurationSeconds: 60,
    });
    const claim = (await claimResponse.json()) as {
      lease: { id: string; epoch: number; expiresAt: string };
      workItem: { lifecycle: string; stage: string };
    };
    const renewResponse = await requestJson(
      `/api/leases/${claim.lease.id}/renewals`,
      "POST",
      { epoch: claim.lease.epoch, leaseDurationSeconds: 600 },
    );
    const renewal = (await renewResponse.json()) as {
      lease: { expiresAt: string };
    };
    const releaseResponse = await requestJson(
      "/api/work-items/work/releases",
      "POST",
      { leaseId: claim.lease.id, epoch: claim.lease.epoch },
    );
    const released = (await releaseResponse.json()) as {
      lease: { outcome: string; endedAt: string | null };
      workItem: { lifecycle: string; stage: string; currentLease: unknown };
    };

    expect(claimResponse.status).toBe(201);
    expect(claim.workItem).toEqual(
      expect.objectContaining({ lifecycle: "open", stage: "in_progress" }),
    );
    expect(renewResponse.status).toBe(200);
    expect(new Date(renewal.lease.expiresAt).getTime()).toBeGreaterThan(
      new Date(claim.lease.expiresAt).getTime(),
    );
    expect(releaseResponse.status).toBe(201);
    expect(released.lease.outcome).toBe("released");
    expect(released.lease.endedAt).not.toBeNull();
    expect(released.workItem).toEqual({
      id: "work",
      title: "Release me",
      lifecycle: "released",
      parentId: null,
      rank: null,
      stage: "released",
      currentLease: null,
    });
  });

  it("scheduler-selects an eligible item and can cancel it", async () => {
    await repository.createWorkItem({ id: "first", title: "First" });
    await repository.createWorkItem({ id: "second", title: "Second" });

    const claimResponse = await requestJson("/api/leases", "POST", {
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    const claim = (await claimResponse.json()) as {
      lease: { id: string; epoch: number; workItemId: string };
    };
    const cancelResponse = await requestJson(
      `/api/work-items/${claim.lease.workItemId}/cancellations`,
      "POST",
      { leaseId: claim.lease.id, epoch: claim.lease.epoch },
    );
    const cancelled = (await cancelResponse.json()) as {
      workItem: { lifecycle: string; stage: string };
    };

    expect(claimResponse.status).toBe(201);
    expect(claim.lease.workItemId).toBe("first");
    expect(cancelResponse.status).toBe(201);
    expect(cancelled.workItem).toEqual(
      expect.objectContaining({ lifecycle: "cancelled", stage: "cancelled" }),
    );
  });

  it("rejects a lease used against another work-item path", async () => {
    await repository.createWorkItem({ id: "claimed", title: "Claimed" });
    await repository.createWorkItem({ id: "other", title: "Other" });
    const claimResponse = await requestJson("/api/leases", "POST", {
      workItemId: "claimed",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    const claim = (await claimResponse.json()) as {
      lease: { id: string; epoch: number };
    };

    const response = await requestJson(
      "/api/work-items/other/releases",
      "POST",
      { leaseId: claim.lease.id, epoch: claim.lease.epoch },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "lease_not_current" }),
      }),
    );
    expect((await repository.getWorkItem("claimed")).stage).toBe("in_progress");
    expect((await repository.getWorkItem("other")).stage).toBe("ready");

  });
});
