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

const requestJson = async (
  path: string,
  method: "POST" = "POST",
  body?: unknown,
): Promise<Response> =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(async () => {
  await db.transaction(async (transaction) => {
    await transaction.delete(schema.lease);
    await transaction.delete(schema.workItemDependency);
    await transaction.delete(schema.workItemHierarchy);
    await transaction.delete(schema.workItem);
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
