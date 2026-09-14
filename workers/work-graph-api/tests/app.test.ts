import {
  WorkGraphError,
  type WorkItemLifecycle,
  type WorkStage,
} from "work-graph-domain";
import type {
  StoredLease,
  WorkItemReadModel,
} from "work-graph-db";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkGraphApp,
  type WorkGraphApiRepository,
} from "../src/index";

const acquiredAt = new Date("2026-09-14T10:00:00.000Z");
const expiresAt = new Date("2026-09-14T10:05:00.000Z");
const leaseId = "00000000-0000-4000-8000-000000000001";

const lease = (workItemId = "ready"): StoredLease => ({
  id: leaseId,
  workItemId,
  workerId: "worker-a",
  epoch: 1,
  acquiredAt,
  expiresAt,
  endedAt: null,
  outcome: null,
});

const item = (
  id: string,
  stage: WorkStage,
  lifecycle: WorkItemLifecycle = "open",
  currentLease: StoredLease | null = null,
): WorkItemReadModel => ({
  id,
  title: `${id} work`,
  lifecycle,
  parentId: null,
  stage,
  currentLease,
});

const responseJson = async (response: Response): Promise<unknown> =>
  response.json();

const buildRepository = (): WorkGraphApiRepository => ({
  listWorkItems: vi.fn(async () => []),
  getWorkItem: vi.fn(async (workItemId) => item(workItemId, "ready")),
  claimWorkItem: vi.fn(async () => lease()),
  renewLease: vi.fn(async () => lease()),
  terminateClaimedWorkItem: vi.fn(async (input) => ({
    ...lease(input.workItemId),
    endedAt: expiresAt,
    outcome: input.outcome,
  })),
});

describe("Given work items with derived readiness", () => {
  it("lists only the requested stage and respects the response bound", async () => {
    const repository = buildRepository();
    vi.mocked(repository.listWorkItems).mockResolvedValue([
      item("blocked", "blocked"),
      item("ready", "ready"),
      item("another-ready", "ready"),
    ]);
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/work-items?stage=ready&limit=1");

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      items: [
        {
          id: "ready",
          title: "ready work",
          lifecycle: "open",
          parentId: null,
          stage: "ready",
          currentLease: null,
        },
      ],
      nextOffset: 1,
    });

    const nextResponse = await app.request(
      "/api/work-items?stage=ready&limit=1&offset=1",
    );
    expect(await responseJson(nextResponse)).toEqual({
      items: [
        {
          id: "another-ready",
          title: "another-ready work",
          lifecycle: "open",
          parentId: null,
          stage: "ready",
          currentLease: null,
        },
      ],
      nextOffset: null,
    });
  });

  it("reads one work item without storing its projected stage", async () => {
    const repository = buildRepository();
    vi.mocked(repository.getWorkItem).mockResolvedValue(
      item("leased", "in_progress", "open", lease("leased")),
    );
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/work-items/leased");

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual(
      expect.objectContaining({
        id: "leased",
        lifecycle: "open",
        stage: "in_progress",
        currentLease: expect.objectContaining({
          id: leaseId,
          acquiredAt: acquiredAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        }),
      }),
    );
  });
});

describe("Given a worker managing a lease", () => {
  it("claims, renews, and releases through noun-based resources", async () => {
    const repository = buildRepository();
    const released = item("ready", "released", "released");
    vi.mocked(repository.getWorkItem)
      .mockResolvedValueOnce(
        item("ready", "in_progress", "open", lease("ready")),
      )
      .mockResolvedValueOnce(released);
    const app = createWorkGraphApp(repository, {
      createLeaseId: () => leaseId,
    });

    const claimResponse = await app.request("/api/leases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workItemId: "ready",
        workerId: "worker-a",
        leaseDurationSeconds: 300,
      }),
    });
    const renewResponse = await app.request(`/api/leases/${leaseId}/renewals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ epoch: 1, leaseDurationSeconds: 600 }),
    });
    const releaseResponse = await app.request(
      "/api/work-items/ready/releases",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leaseId, epoch: 1 }),
      },
    );

    expect(claimResponse.status).toBe(201);
    expect(renewResponse.status).toBe(200);
    expect(releaseResponse.status).toBe(201);
    expect(repository.claimWorkItem).toHaveBeenCalledWith({
      leaseId,
      workItemId: "ready",
      workerId: "worker-a",
      leaseDurationSeconds: 300,
    });
    expect(repository.renewLease).toHaveBeenCalledWith({
      leaseId,
      epoch: 1,
      leaseDurationSeconds: 600,
    });
    expect(repository.terminateClaimedWorkItem).toHaveBeenCalledWith({
      leaseId,
      epoch: 1,
      workItemId: "ready",
      outcome: "released",
    });
    expect(await responseJson(releaseResponse)).toEqual(
      expect.objectContaining({
        workItem: expect.objectContaining({
          lifecycle: "released",
          stage: "released",
        }),
      }),
    );
  });

  it("cancels only the work item named by the resource path", async () => {
    const repository = buildRepository();
    vi.mocked(repository.getWorkItem).mockResolvedValue(
      item("cancelled", "cancelled", "cancelled"),
    );
    const app = createWorkGraphApp(repository);

    const response = await app.request(
      "/api/work-items/cancelled/cancellations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leaseId, epoch: 1 }),
      },
    );

    expect(response.status).toBe(201);
    expect(repository.terminateClaimedWorkItem).toHaveBeenCalledWith({
      leaseId,
      epoch: 1,
      workItemId: "cancelled",
      outcome: "cancelled",
    });
  });

  it("returns a conflict when no eligible claim candidate remains", async () => {
    const repository = buildRepository();
    vi.mocked(repository.claimWorkItem).mockResolvedValue(null);
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/leases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workerId: "worker-a",
        leaseDurationSeconds: 300,
      }),
    });

    expect(response.status).toBe(409);
    expect(await responseJson(response)).toEqual({
      error: {
        code: "work_item_not_claimable",
        message: "No work item is currently claimable.",
      },
    });
  });

  it("maps stale lease fencing and missing work into shared errors", async () => {
    const repository = buildRepository();
    vi.mocked(repository.renewLease).mockRejectedValue(
      new WorkGraphError("lease_not_current", "The lease is stale."),
    );
    vi.mocked(repository.getWorkItem).mockRejectedValue(
      new WorkGraphError("work_item_not_found", "The work item is missing."),
    );
    const app = createWorkGraphApp(repository);

    const renewResponse = await app.request(
      `/api/leases/${leaseId}/renewals`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ epoch: 1, leaseDurationSeconds: 300 }),
      },
    );
    const readResponse = await app.request("/api/work-items/missing");

    expect(renewResponse.status).toBe(409);
    expect(await responseJson(renewResponse)).toEqual({
      error: { code: "lease_not_current", message: "The lease is stale." },
    });
    expect(readResponse.status).toBe(404);
  });
});

describe("Given an invalid REST request", () => {
  it("rejects unknown fields and out-of-range lease durations", async () => {
    const app = createWorkGraphApp(buildRepository());

    const response = await app.request("/api/leases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workerId: "worker-a",
        leaseDurationSeconds: 86_401,
        executionMode: "action",
      }),
    });

    expect(response.status).toBe(422);
    expect(await responseJson(response)).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "validation_failed" }),
      }),
    );
  });
});
