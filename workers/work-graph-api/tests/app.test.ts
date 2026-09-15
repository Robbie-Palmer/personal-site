import {
  WorkGraphError,
  type WorkItemLifecycle,
  type WorkStage,
} from "work-graph-domain";
import type {
  DecomposeClaimedWorkItemInput,
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
const idempotencyKey = "00000000-0000-4000-8000-000000000002";
const removeIdempotencyKey = "00000000-0000-4000-8000-000000000003";
const noteId = "00000000-0000-4000-8000-000000000004";
const attentionRequestId = "00000000-0000-4000-8000-000000000005";
const attentionResolutionId = "00000000-0000-4000-8000-000000000006";
const secondAttentionRequestId = "00000000-0000-4000-8000-000000000007";
const childLeaseId = "00000000-0000-4000-8000-000000000008";

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
  rank: null,
  stage,
  currentLease,
});

const responseJson = async (response: Response): Promise<unknown> =>
  response.json();

const buildRepository = (): WorkGraphApiRepository => ({
  listWorkItems: vi.fn(async () => []),
  getWorkItem: vi.fn(async (workItemId) => item(workItemId, "ready")),
  listAttentionRequests: vi.fn(async () => []),
  createWorkItem: vi.fn(async (input) => ({
    ...input,
    lifecycle: "open" as const,
    parentId: input.parentId ?? null,
    rank: null,
  })),
  addDependency: vi.fn(async () => undefined),
  removeDependency: vi.fn(async () => undefined),
  createNote: vi.fn(async (input) => ({
    id: input.id,
    workItemId: input.workItemId,
    leaseId: input.leaseId,
    content: input.content,
    createdAt: acquiredAt,
  })),
  createAttentionRequest: vi.fn(async (input) => ({
    attentionRequest: {
      id: input.id,
      workItemId: input.workItemId,
      requestingLeaseId: input.leaseId,
      kind: input.kind,
      question: input.question,
      note: input.note ?? null,
      blocking: input.blocking,
      createdAt: acquiredAt,
    },
    endedLease: input.blocking
      ? {
          ...lease(input.workItemId),
          endedAt: acquiredAt,
          outcome: "attention_requested" as const,
        }
      : null,
  })),
  resolveAttentionRequest: vi.fn(async (input) => ({
    resolution: {
      id: input.id,
      attentionRequestId: input.attentionRequestId,
      resolution: input.resolution,
      createdAt: acquiredAt,
    },
    workItemId: "ready",
  })),
  claimWorkItem: vi.fn(async () => lease()),
  renewLease: vi.fn(async () => lease()),
  terminateClaimedWorkItem: vi.fn(async (input) => ({
    ...lease(input.workItemId),
    endedAt: expiresAt,
    outcome: input.outcome,
  })),
  decomposeClaimedWorkItem: vi.fn(async (input: DecomposeClaimedWorkItemInput) => ({
    children: input.children
      .map(({ rank, ...child }) => ({
        rank,
        workItem: {
          ...child,
          lifecycle: "open" as const,
          parentId: input.workItemId,
          rank,
        },
      }))
      .sort((left, right) => left.rank - right.rank),
    dependencies: input.dependencies ?? [],
    endedLease: {
      ...lease(input.workItemId),
      endedAt: acquiredAt,
      outcome: "decomposed" as const,
    },
    claimedLease: input.claim
      ? {
          ...lease(input.claim.workItemId),
          id: input.claim.leaseId,
          expiresAt,
        }
      : null,
  })),
});

describe("Given work items with derived readiness", () => {
  it("lists a stage with a cursor that survives readiness changes", async () => {
    const repository = buildRepository();
    vi.mocked(repository.listWorkItems)
      .mockResolvedValueOnce([
        item("blocked", "blocked"),
        item("a-ready", "ready"),
        item("b-ready", "ready"),
      ])
      .mockResolvedValueOnce([
        item("a-ready", "in_progress", "open", lease("a-ready")),
        item("b-ready", "ready"),
      ]);
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/work-items?stage=ready&limit=1");

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      items: [
        {
          id: "a-ready",
          title: "a-ready work",
          lifecycle: "open",
          parentId: null,
          rank: null,
          stage: "ready",
          currentLease: null,
        },
      ],
      nextCursor: "a-ready",
    });

    const nextResponse = await app.request(
      "/api/work-items?stage=ready&limit=1&cursor=a-ready",
    );
    expect(await responseJson(nextResponse)).toEqual({
      items: [
        {
          id: "b-ready",
          title: "b-ready work",
          lifecycle: "open",
          parentId: null,
          rank: null,
          stage: "ready",
          currentLease: null,
        },
      ],
      nextCursor: null,
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

describe("Given idempotent graph mutation requests", () => {
  it("creates a sparse work item without accepting derived state", async () => {
    const repository = buildRepository();
    vi.mocked(repository.getWorkItem).mockResolvedValue({
      ...item("sparse", "ready"),
      title: "Sparse work item",
    });
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "sparse", title: "Sparse work item" }),
    });

    expect(response.status).toBe(201);
    expect(repository.createWorkItem).toHaveBeenCalledWith(
      { id: "sparse", title: "Sparse work item" },
      {},
    );
    expect(await responseJson(response)).toEqual({
      id: "sparse",
      title: "Sparse work item",
      lifecycle: "open",
      parentId: null,
      rank: null,
      stage: "ready",
      currentLease: null,
    });

    const rejected = await app.request("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "fixed",
        title: "Fixed state",
        stage: "ready",
      }),
    });
    expect(rejected.status).toBe(422);
  });

  it("adds and removes one dependency with the caller's retry key", async () => {
    const repository = buildRepository();
    const app = createWorkGraphApp(repository);
    const dependency = {
      dependentWorkItemId: "dependent",
      blockerWorkItemId: "blocker",
    };
    const request = (method: "POST" | "DELETE") =>
      app.request("/api/dependencies", {
        method,
        headers: {
          "content-type": "application/json",
          "idempotency-key":
            method === "POST" ? idempotencyKey : removeIdempotencyKey,
        },
        body: JSON.stringify(dependency),
      });

    const added = await request("POST");
    const removed = await request("DELETE");

    expect(added.status).toBe(201);
    expect(removed.status).toBe(200);
    expect(await responseJson(added)).toEqual(dependency);
    expect(await responseJson(removed)).toEqual(dependency);
    expect(repository.addDependency).toHaveBeenCalledWith(dependency, {
      idempotencyKey,
    });
    expect(repository.removeDependency).toHaveBeenCalledWith(dependency, {
      idempotencyKey: removeIdempotencyKey,
    });
  });
});

describe("Given a worker recording progress and requesting attention", () => {
  it("lists unresolved attention by default and can select resolved requests", async () => {
    const repository = buildRepository();
    const firstUnresolved = {
      id: attentionRequestId,
      workItemId: "ready",
      requestingLeaseId: leaseId,
      kind: "decision",
      question: "Which contract is canonical?",
      note: null,
      blocking: true,
      createdAt: acquiredAt,
      resolution: null,
    } as const;
    const resolvedRequest = {
      id: attentionResolutionId,
      workItemId: "resolved",
      requestingLeaseId: leaseId,
      kind: "review",
      question: "Is the wording clear?",
      note: null,
      blocking: false,
      createdAt: acquiredAt,
      resolution: {
        id: noteId,
        attentionRequestId: attentionResolutionId,
        resolution: "Yes.",
        createdAt: expiresAt,
      },
    } as const;
    const secondUnresolved = {
      id: secondAttentionRequestId,
      workItemId: "other",
      requestingLeaseId: leaseId,
      kind: "input",
      question: "Which option applies?",
      note: null,
      blocking: true,
      createdAt: expiresAt,
      resolution: null,
    } as const;
    vi.mocked(repository.listAttentionRequests)
      .mockResolvedValueOnce([firstUnresolved, secondUnresolved])
      .mockResolvedValueOnce([secondUnresolved])
      .mockResolvedValueOnce([resolvedRequest]);
    const app = createWorkGraphApp(repository);

    const unresolved = await app.request(
      "/api/attention-requests?limit=1",
    );
    const nextUnresolved = await app.request(
      `/api/attention-requests?cursor=${attentionRequestId}`,
    );
    const resolved = await app.request(
      "/api/attention-requests?state=resolved&blocking=false",
    );

    expect(await responseJson(unresolved)).toEqual({
      items: [
        expect.objectContaining({
          id: attentionRequestId,
          resolution: null,
        }),
      ],
      nextCursor: attentionRequestId,
    });
    expect(await responseJson(nextUnresolved)).toEqual({
      items: [
        expect.objectContaining({
          id: secondAttentionRequestId,
          resolution: null,
        }),
      ],
      nextCursor: null,
    });
    expect(await responseJson(resolved)).toEqual({
      items: [
        expect.objectContaining({
          id: attentionResolutionId,
          resolution: expect.objectContaining({
            resolution: "Yes.",
            createdAt: expiresAt.toISOString(),
          }),
        }),
      ],
      nextCursor: null,
    });
    expect(repository.listAttentionRequests).toHaveBeenNthCalledWith(1, {
      state: "unresolved",
      limit: 2,
    });
    expect(repository.listAttentionRequests).toHaveBeenNthCalledWith(2, {
      state: "unresolved",
      cursor: attentionRequestId,
      limit: 51,
    });
    expect(repository.listAttentionRequests).toHaveBeenNthCalledWith(3, {
      state: "resolved",
      blocking: false,
      limit: 51,
    });
  });

  it("records a note only against the work item in the path", async () => {
    const repository = buildRepository();
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/work-items/ready/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        id: noteId,
        leaseId,
        epoch: 1,
        content: "Checked the generated contract.",
      }),
    });

    expect(response.status).toBe(201);
    expect(repository.createNote).toHaveBeenCalledWith(
      {
        id: noteId,
        workItemId: "ready",
        leaseId,
        epoch: 1,
        content: "Checked the generated contract.",
      },
      { idempotencyKey },
    );
    expect(await responseJson(response)).toEqual({
      id: noteId,
      workItemId: "ready",
      leaseId,
      content: "Checked the generated contract.",
      createdAt: acquiredAt.toISOString(),
    });
  });

  it("ends a lease for blocking attention and returns derived readiness after resolution", async () => {
    const repository = buildRepository();
    vi.mocked(repository.getWorkItem)
      .mockResolvedValueOnce(item("ready", "needs_attention"))
      .mockResolvedValueOnce(item("ready", "ready"));
    const app = createWorkGraphApp(repository);

    const opened = await app.request("/api/attention-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        id: attentionRequestId,
        workItemId: "ready",
        leaseId,
        epoch: 1,
        kind: "decision",
        question: "Which contract should remain canonical?",
      }),
    });
    const resolved = await app.request(
      `/api/attention-requests/${attentionRequestId}/resolutions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": removeIdempotencyKey,
        },
        body: JSON.stringify({
          id: attentionResolutionId,
          resolution: "Keep the generated OpenAPI document canonical.",
        }),
      },
    );

    expect(opened.status).toBe(201);
    expect(resolved.status).toBe(201);
    expect(repository.createAttentionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: attentionRequestId,
        blocking: true,
      }),
      { idempotencyKey },
    );
    expect(repository.resolveAttentionRequest).toHaveBeenCalledWith(
      {
        id: attentionResolutionId,
        attentionRequestId,
        resolution: "Keep the generated OpenAPI document canonical.",
      },
      { idempotencyKey: removeIdempotencyKey },
    );
    expect(await responseJson(opened)).toEqual(
      expect.objectContaining({
        endedLease: expect.objectContaining({
          outcome: "attention_requested",
        }),
        workItem: expect.objectContaining({ stage: "needs_attention" }),
      }),
    );
    expect(await responseJson(resolved)).toEqual(
      expect.objectContaining({
        workItem: expect.objectContaining({ stage: "ready" }),
      }),
    );
  });
});

describe("Given a worker managing a lease", () => {
  it("decomposes into ranked children and claims one for the same worker", async () => {
    const repository = buildRepository();
    vi.mocked(repository.listWorkItems).mockResolvedValue(
      ["parent", "first", "second"].map((workItemId) => ({
        ...item(
          workItemId,
          workItemId === "parent"
            ? "blocked"
            : workItemId === "first"
              ? "in_progress"
              : "blocked",
          "open",
          workItemId === "first"
            ? { ...lease("first"), id: childLeaseId }
            : null,
        ),
        parentId: workItemId === "parent" ? null : "parent",
        rank:
          workItemId === "first" ? 10 : workItemId === "second" ? 20 : null,
      })),
    );
    const app = createWorkGraphApp(repository);
    const body = {
      leaseId,
      epoch: 1,
      children: [
        { id: "second", title: "Second child", rank: 20 },
        { id: "first", title: "First child", rank: 10 },
      ],
      dependencies: [
        { dependentWorkItemId: "second", blockerWorkItemId: "first" },
      ],
      claim: {
        workItemId: "first",
        leaseId: childLeaseId,
        leaseDurationSeconds: 300,
      },
    };

    const response = await app.request(
      "/api/work-items/parent/decompositions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      },
    );

    expect(response.status).toBe(201);
    expect(repository.decomposeClaimedWorkItem).toHaveBeenCalledWith(
      { ...body, workItemId: "parent" },
      { idempotencyKey },
    );
    expect(repository.listWorkItems).toHaveBeenCalledOnce();
    expect(repository.getWorkItem).not.toHaveBeenCalled();
    expect(await responseJson(response)).toEqual(
      expect.objectContaining({
        parent: expect.objectContaining({ id: "parent", stage: "blocked" }),
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
              id: "second",
              stage: "blocked",
            }),
          }),
        ],
        endedLease: expect.objectContaining({ outcome: "decomposed" }),
        claimedLease: expect.objectContaining({
          id: childLeaseId,
          workItemId: "first",
          workerId: "worker-a",
        }),
      }),
    );
  });

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
    vi.mocked(repository.resolveAttentionRequest).mockRejectedValue(
      new WorkGraphError(
        "attention_request_not_found",
        "The attention request is missing.",
      ),
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
    const resolutionResponse = await app.request(
      `/api/attention-requests/${attentionRequestId}/resolutions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: attentionResolutionId,
          resolution: "No answer is available.",
        }),
      },
    );

    expect(renewResponse.status).toBe(409);
    expect(await responseJson(renewResponse)).toEqual({
      error: { code: "lease_not_current", message: "The lease is stale." },
    });
    expect(readResponse.status).toBe(404);
    expect(resolutionResponse.status).toBe(404);
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

  it("rejects a malformed idempotency key before mutation", async () => {
    const repository = buildRepository();
    const app = createWorkGraphApp(repository);

    const response = await app.request("/api/dependencies", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "not-a-uuid",
      },
      body: JSON.stringify({
        dependentWorkItemId: "dependent",
        blockerWorkItemId: "blocker",
      }),
    });

    expect(response.status).toBe(422);
    expect(repository.addDependency).not.toHaveBeenCalled();
  });
});
