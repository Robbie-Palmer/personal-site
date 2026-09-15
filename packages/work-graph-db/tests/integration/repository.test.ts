import {
  getDirectChildren,
  projectWorkItemStage,
  WorkGraphError,
  type WorkItemDependency,
} from "work-graph-domain";
import { eq, sql } from "drizzle-orm";
import {
  closeDb,
  createDb,
  schema,
  WorkGraphRepository,
} from "../../src/index";

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
  throw new Error("DATABASE_URL is required for integration tests.");
}

const db = createDb(databaseURL);
const repository = new WorkGraphRepository(db);

const recordId = (suffix: number): string =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const dependency = (
  dependentWorkItemId: string,
  blockerWorkItemId: string,
): WorkItemDependency => ({ dependentWorkItemId, blockerWorkItemId });

const expectWorkGraphError = (
  result: PromiseSettledResult<unknown>,
  code: WorkGraphError["code"],
): void => {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") return;
  expect(result.reason).toEqual(
    expect.objectContaining<Partial<WorkGraphError>>({ code }),
  );
};

type DatabaseError = Error & {
  code?: string;
  constraint_name?: string;
};

const getDatabaseError = (error: unknown): DatabaseError | undefined => {
  if (!(error instanceof Error)) return undefined;
  if ("code" in error && typeof error.code === "string") {
    return error as DatabaseError;
  }
  return "cause" in error ? getDatabaseError(error.cause) : undefined;
};

const rejectedDatabaseError = async (
  operation: Promise<unknown>,
): Promise<DatabaseError | undefined> => {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return getDatabaseError(error);
  }
};

const waitForDatabaseLock = async (): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [result] = await db.execute<{ waiting: boolean }>(sql`
      select exists (
        select 1
        from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and wait_event_type = 'Lock'
      ) as waiting
    `);
    if (result?.waiting === true) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for a PostgreSQL lock waiter.");
};

beforeAll(async () => {
  const [migrationCount] = await db.execute<{ count: number }>(sql`
    select count(*)::integer as count
    from drizzle.__drizzle_migrations
  `);
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  const locks = await db
    .select({ id: schema.graphMutationLock.id })
    .from(schema.graphMutationLock);
  const lifecycleValues = await db.execute<{ enumlabel: string }>(sql`
    select enumlabel
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'work_item_lifecycle'
    order by enumsortorder
  `);
  const leaseOutcomeValues = await db.execute<{ enumlabel: string }>(sql`
    select enumlabel
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'lease_outcome'
    order by enumsortorder
  `);

  expect(migrationCount?.count).toBe(6);
  expect(tables.map(({ table_name }) => table_name)).toEqual([
    "attention_requests",
    "attention_resolutions",
    "graph_mutation_locks",
    "idempotency_keys",
    "leases",
    "notes",
    "work_item_dependencies",
    "work_item_hierarchy",
    "work_items",
  ]);
  expect(locks).toEqual([{ id: "global" }]);
  expect(lifecycleValues.map(({ enumlabel }) => enumlabel)).toEqual([
    "open",
    "released",
    "cancelled",
  ]);
  expect(leaseOutcomeValues.map(({ enumlabel }) => enumlabel)).toEqual([
    "released",
    "cancelled",
    "decomposed",
    "attention_requested",
    "expired",
  ]);
});

describe("transactional decomposition", () => {
  const claimParent = async (leaseId: string) => {
    await repository.createWorkItem({ id: "parent", title: "Parent context" });
    const claimed = await repository.claimWorkItem({
      leaseId,
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "parent",
    });
    if (!claimed) throw new Error("Expected the parent claim to succeed.");
    return claimed;
  };

  it("creates ranked children, ends the parent lease, and claims a ready child atomically", async () => {
    const parentLease = await claimParent(recordId(201));
    await repository.createNote({
      id: recordId(211),
      workItemId: "parent",
      leaseId: parentLease.id,
      epoch: parentLease.epoch,
      content: "Discovery context retained on the parent.",
    });
    const result = await repository.decomposeClaimedWorkItem({
      leaseId: parentLease.id,
      epoch: parentLease.epoch,
      workItemId: "parent",
      children: [
        { id: "second", title: "Second child", rank: 20 },
        { id: "first", title: "First child", rank: 10 },
      ],
      dependencies: [dependency("second", "first")],
      claim: {
        workItemId: "first",
        leaseId: recordId(202),
        leaseDurationSeconds: 120,
      },
    });

    expect(result.children).toEqual([
      {
        rank: 10,
        workItem: {
          id: "first",
          title: "First child",
          lifecycle: "open",
          parentId: "parent",
          rank: 10,
        },
      },
      {
        rank: 20,
        workItem: {
          id: "second",
          title: "Second child",
          lifecycle: "open",
          parentId: "parent",
          rank: 20,
        },
      },
    ]);
    expect(result.endedLease).toEqual(
      expect.objectContaining({
        id: parentLease.id,
        endedAt: expect.any(Date),
        outcome: "decomposed",
      }),
    );
    expect(result.claimedLease).toEqual(
      expect.objectContaining({
        id: recordId(202),
        workItemId: "first",
        workerId: "worker-a",
        epoch: 1,
      }),
    );

    const graph = await repository.load();
    expect(
      graph.workItems
        .filter(({ parentId }) => parentId === "parent")
        .map(({ id }) => id),
    ).toEqual(["first", "second"]);
    expect(graph.dependencies).toEqual([dependency("second", "first")]);
    await expect(repository.getWorkItem("parent")).resolves.toEqual(
      expect.objectContaining({ lifecycle: "open", stage: "blocked" }),
    );
    await expect(repository.getWorkItem("first")).resolves.toEqual(
      expect.objectContaining({ parentId: "parent", stage: "in_progress" }),
    );
    await expect(repository.getWorkItem("second")).resolves.toEqual(
      expect.objectContaining({ parentId: "parent", stage: "blocked" }),
    );
    await expect(repository.listNotes("parent")).resolves.toEqual([
      expect.objectContaining({
        id: recordId(211),
        content: "Discovery context retained on the parent.",
      }),
    ]);
    expect(
      await db
        .select({
          childWorkItemId: schema.workItemHierarchy.childWorkItemId,
          rank: schema.workItemHierarchy.rank,
        })
        .from(schema.workItemHierarchy)
        .orderBy(schema.workItemHierarchy.rank),
    ).toEqual([
      { childWorkItemId: "first", rank: 10 },
      { childWorkItemId: "second", rank: 20 },
    ]);
  });

  it("rolls back children, edges, the receipt, and lease ending when the combined graph cycles", async () => {
    const parentLease = await claimParent(recordId(203));
    const idempotencyKey = recordId(204);

    await expect(
      repository.decomposeClaimedWorkItem(
        {
          leaseId: parentLease.id,
          epoch: parentLease.epoch,
          workItemId: "parent",
          children: [{ id: "child", title: "Child", rank: 1 }],
          dependencies: [dependency("child", "parent")],
        },
        { idempotencyKey },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );

    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "parent",
    ]);
    expect((await repository.load()).dependencies).toEqual([]);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: parentLease.id, endedAt: null }),
    );
    expect(await db.select().from(schema.idempotencyKey)).toEqual([]);
  });

  it("rolls back the decomposition when the requested child is not ready", async () => {
    const parentLease = await claimParent(recordId(212));

    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: parentLease.id,
        epoch: parentLease.epoch,
        workItemId: "parent",
        children: [
          { id: "blocker", title: "Blocker", rank: 1 },
          { id: "blocked", title: "Blocked", rank: 2 },
        ],
        dependencies: [dependency("blocked", "blocker")],
        claim: {
          workItemId: "blocked",
          leaseId: recordId(213),
          leaseDurationSeconds: 120,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "decomposition_child_not_claimable",
      }),
    );

    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "parent",
    ]);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: parentLease.id, endedAt: null }),
    );
    await expect(repository.getCurrentLease("blocked")).resolves.toBeNull();
  });

  it("lets only one competing decomposition consume the fenced parent lease", async () => {
    const parentLease = await claimParent(recordId(205));
    const attempt = (suffix: number) =>
      repository.decomposeClaimedWorkItem(
        {
          leaseId: parentLease.id,
          epoch: parentLease.epoch,
          workItemId: "parent",
          children: [
            { id: `child-${suffix}`, title: `Child ${suffix}`, rank: 1 },
          ],
        },
        { idempotencyKey: recordId(205 + suffix) },
      );

    const results = await Promise.allSettled([attempt(1), attempt(2)]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const [rejected] = results.filter(({ status }) => status === "rejected");
    if (!rejected) throw new Error("Expected one decomposition to lose.");
    expectWorkGraphError(rejected, "lease_not_current");
    expect(
      (await repository.load()).workItems.filter(
        ({ parentId }) => parentId === "parent",
      ),
    ).toHaveLength(1);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(1);
  });

  it("serializes competing decompositions that would form a combined cycle", async () => {
    await repository.createWorkItem({ id: "a", title: "A" });
    await repository.createWorkItem({ id: "b", title: "B" });
    const [leaseA, leaseB] = await Promise.all([
      repository.claimWorkItem({
        leaseId: recordId(214),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "a",
      }),
      repository.claimWorkItem({
        leaseId: recordId(215),
        workerId: "worker-b",
        leaseDurationSeconds: 300,
        workItemId: "b",
      }),
    ]);
    if (!leaseA || !leaseB) throw new Error("Expected both claims to succeed.");

    const results = await Promise.allSettled([
      repository.decomposeClaimedWorkItem({
        leaseId: leaseA.id,
        epoch: leaseA.epoch,
        workItemId: "a",
        children: [{ id: "a-child", title: "A child", rank: 1 }],
        dependencies: [dependency("a-child", "b")],
      }),
      repository.decomposeClaimedWorkItem({
        leaseId: leaseB.id,
        epoch: leaseB.epoch,
        workItemId: "b",
        children: [{ id: "b-child", title: "B child", rank: 1 }],
        dependencies: [dependency("b-child", "a")],
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const [rejected] = results.filter(({ status }) => status === "rejected");
    if (!rejected) throw new Error("Expected one cyclic decomposition to fail.");
    expectWorkGraphError(rejected, "graph_cycle");
    const graph = await repository.load();
    expect(graph.workItems).toHaveLength(3);
    expect(graph.dependencies).toHaveLength(1);
    expect(() => projectWorkItemStage(graph, "a")).not.toThrow();
    expect(() => projectWorkItemStage(graph, "b")).not.toThrow();
    expect(
      [
        await repository.getCurrentLease("a"),
        await repository.getCurrentLease("b"),
      ].filter((currentLease) => currentLease !== null),
    ).toHaveLength(1);
  });

  it("replays a concurrent retry with the original children and child lease", async () => {
    const parentLease = await claimParent(recordId(208));
    const request = {
      leaseId: parentLease.id,
      epoch: parentLease.epoch,
      workItemId: "parent",
      children: [{ id: "child", title: "Child", rank: 1 }],
      claim: {
        workItemId: "child",
        leaseId: recordId(209),
        leaseDurationSeconds: 120,
      },
    } as const;
    const options = { idempotencyKey: recordId(210) };

    const [first, replay] = await Promise.all([
      repository.decomposeClaimedWorkItem(request, options),
      repository.decomposeClaimedWorkItem(request, options),
    ]);

    expect(replay).toEqual(first);
    expect((await repository.load()).workItems).toHaveLength(2);
    expect(await repository.listLeases("parent")).toHaveLength(1);
    expect(await repository.listLeases("child")).toHaveLength(1);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(1);
  });

  it("rejects invalid child sets before changing the graph", async () => {
    const parentLease = await claimParent(recordId(216));
    const base = {
      leaseId: parentLease.id,
      epoch: parentLease.epoch,
      workItemId: "parent",
    } as const;

    await expect(
      repository.decomposeClaimedWorkItem({ ...base, children: [] }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_decomposition",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        ...base,
        children: [{ id: "child", title: "Child", rank: 0 }],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_child_rank",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        ...base,
        children: [
          { id: "child", title: "Child", rank: 1 },
          { id: "child", title: "Duplicate", rank: 2 },
        ],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "duplicate_work_item",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        ...base,
        children: [
          { id: "first", title: "First", rank: 1 },
          { id: "second", title: "Second", rank: 1 },
        ],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_child_rank",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        ...base,
        children: [{ id: "child", title: "Child", rank: 1 }],
        claim: {
          workItemId: "other",
          leaseId: recordId(217),
          leaseDurationSeconds: 60,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_decomposition",
      }),
    );

    expect((await repository.load()).workItems).toHaveLength(1);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: parentLease.id, endedAt: null }),
    );
  });

  it("translates PostgreSQL conflicts and rolls back every partial change", async () => {
    const parentLease = await claimParent(recordId(218));
    await repository.createWorkItem({ id: "existing", title: "Existing" });

    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: parentLease.id,
        epoch: parentLease.epoch,
        workItemId: "parent",
        children: [{ id: "existing", title: "Collision", rank: 1 }],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "duplicate_work_item",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: parentLease.id,
        epoch: parentLease.epoch,
        workItemId: "parent",
        children: [{ id: "child", title: "Child", rank: 1 }],
        dependencies: [
          dependency("child", "existing"),
          dependency("child", "existing"),
        ],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "dependency_already_exists",
      }),
    );
    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: parentLease.id,
        epoch: parentLease.epoch,
        workItemId: "parent",
        children: [{ id: "child", title: "Child", rank: 1 }],
        dependencies: [dependency("child", "child")],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "self_dependency",
      }),
    );

    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "parent",
      "existing",
    ]);
    expect((await repository.load()).dependencies).toEqual([]);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: parentLease.id, endedAt: null }),
    );
  });

  it("rolls back when the optional child lease ID already exists", async () => {
    const parentLease = await claimParent(recordId(219));
    await repository.createWorkItem({ id: "other", title: "Other" });
    const duplicateLeaseId = recordId(220);
    await repository.claimWorkItem({
      leaseId: duplicateLeaseId,
      workerId: "worker-b",
      leaseDurationSeconds: 300,
      workItemId: "other",
    });

    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: parentLease.id,
        epoch: parentLease.epoch,
        workItemId: "parent",
        children: [{ id: "child", title: "Child", rank: 1 }],
        claim: {
          workItemId: "child",
          leaseId: duplicateLeaseId,
          leaseDurationSeconds: 60,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "duplicate_lease_id",
      }),
    );

    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "parent",
      "other",
    ]);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: parentLease.id, endedAt: null }),
    );
  });

  it("reconstructs sibling rank and rejects a rank used earlier", async () => {
    const firstLease = await claimParent(recordId(223));
    await repository.decomposeClaimedWorkItem({
      leaseId: firstLease.id,
      epoch: firstLease.epoch,
      workItemId: "parent",
      children: [{ id: "later", title: "Later", rank: 20 }],
    });
    await repository.releaseWorkItem("later");
    const secondLease = await repository.claimWorkItem({
      leaseId: recordId(224),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "parent",
    });
    if (!secondLease) throw new Error("Expected the parent reclaim to succeed.");

    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: secondLease.id,
        epoch: secondLease.epoch,
        workItemId: "parent",
        children: [{ id: "first", title: "First", rank: 10 }],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            rank: 10,
            workItem: expect.objectContaining({ id: "first", rank: 10 }),
          }),
        ],
      }),
    );

    const reconstructed = await repository.load();
    expect(
      getDirectChildren(reconstructed, "parent").map(({ id, rank }) => ({
        id,
        rank,
      })),
    ).toEqual([
      { id: "first", rank: 10 },
      { id: "later", rank: 20 },
    ]);
    await repository.reparentWorkItem("first", "parent");
    await expect(repository.getWorkItem("first")).resolves.toEqual(
      expect.objectContaining({ rank: 10 }),
    );

    await repository.releaseWorkItem("first");
    const thirdLease = await repository.claimWorkItem({
      leaseId: recordId(225),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "parent",
    });
    if (!thirdLease) throw new Error("Expected the parent reclaim to succeed.");
    await expect(
      repository.decomposeClaimedWorkItem({
        leaseId: thirdLease.id,
        epoch: thirdLease.epoch,
        workItemId: "parent",
        children: [{ id: "duplicate", title: "Duplicate", rank: 20 }],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_child_rank",
      }),
    );

    expect((await repository.load()).workItems.map(({ id }) => id)).toEqual([
      "parent",
      "later",
      "first",
    ]);
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      expect.objectContaining({ id: thirdLease.id, endedAt: null }),
    );
  });

  it("replays a decomposition without an optional child claim", async () => {
    const parentLease = await claimParent(recordId(221));
    const request = {
      leaseId: parentLease.id,
      epoch: parentLease.epoch,
      workItemId: "parent",
      children: [{ id: "child", title: "Child", rank: 1 }],
    } as const;
    const options = { idempotencyKey: recordId(222) };

    const first = await repository.decomposeClaimedWorkItem(request, options);
    const replay = await repository.decomposeClaimedWorkItem(request, options);

    expect(replay).toEqual(first);
    expect(replay.claimedLease).toBeNull();
    expect(await repository.listLeases("child")).toEqual([]);
  });
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

afterAll(async () => {
  await closeDb(db);
});

describe("lease-backed claiming", () => {
  const leaseId = (suffix: number): string =>
    `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

  it("creates a lease only for work whose readiness predicates pass", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "dependent", title: "Dependent" });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    await repository.addDependency(dependency("dependent", "blocker"));

    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(1),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "parent",
      }),
    ).resolves.toBeNull();
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(2),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "dependent",
      }),
    ).resolves.toBeNull();

    await repository.releaseWorkItem("child");
    await repository.cancelWorkItem("blocker");

    const parentLease = await repository.claimWorkItem({
      leaseId: leaseId(3),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "parent",
    });
    const dependentLease = await repository.claimWorkItem({
      leaseId: leaseId(4),
      workerId: "worker-b",
      leaseDurationSeconds: 300,
      workItemId: "dependent",
    });

    expect(parentLease).toEqual(
      expect.objectContaining({
        id: leaseId(3),
        workItemId: "parent",
        workerId: "worker-a",
        epoch: 1,
        endedAt: null,
        outcome: null,
      }),
    );
    expect(dependentLease?.workItemId).toBe("dependent");
    if (!parentLease) throw new Error("Expected the parent claim to succeed.");
    await expect(repository.getCurrentLease("parent")).resolves.toEqual(
      parentLease,
    );
    await expect(repository.getWorkItem("parent")).resolves.toEqual(
      expect.objectContaining({
        stage: "in_progress",
        currentLease: parentLease,
      }),
    );
  });

  it("inherits dependency readiness from parent work", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    await repository.addDependency(dependency("parent", "blocker"));

    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(5),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "child",
      }),
    ).resolves.toBeNull();

    await repository.releaseWorkItem("blocker");
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(6),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "child",
      }),
    ).resolves.toEqual(
      expect.objectContaining({ workItemId: "child", epoch: 1 }),
    );
  });

  it("lets exactly one worker win a race for a specified item", async () => {
    await repository.createWorkItem({ id: "work", title: "Contended work" });

    const claims = await Promise.all([
      repository.claimWorkItem({
        leaseId: leaseId(10),
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: "work",
      }),
      repository.claimWorkItem({
        leaseId: leaseId(11),
        workerId: "worker-b",
        leaseDurationSeconds: 300,
        workItemId: "work",
      }),
    ]);

    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(1);
    expect(await repository.listLeases("work")).toHaveLength(1);
  });

  it("starts the lease duration after graph-lock waiting ends", async () => {
    await repository.createWorkItem({ id: "work", title: "Delayed claim" });

    let announceLock: (() => void) | undefined;
    const graphLocked = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    let releaseLock: (() => void) | undefined;
    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const lockTransaction = db.transaction(async (transaction) => {
      await transaction
        .select({ id: schema.graphMutationLock.id })
        .from(schema.graphMutationLock)
        .for("update");
      announceLock?.();
      await holdLock;
    });
    await graphLocked;

    const claim = repository.claimWorkItem({
      leaseId: leaseId(12),
      workerId: "worker-a",
      leaseDurationSeconds: 1,
      workItemId: "work",
    });
    try {
      await waitForDatabaseLock();
      await db.execute(sql`select pg_sleep(1.1)`);
    } finally {
      releaseLock?.();
      await lockTransaction;
    }

    const claimed = await claim;
    if (!claimed) throw new Error("Expected the delayed claim to succeed.");
    const [clock] = await db.execute<{ currentTime: string }>(sql`
      select clock_timestamp() as "currentTime"
    `);
    expect(claimed.expiresAt.getTime()).toBeGreaterThan(
      clock ? new Date(clock.currentTime).getTime() : Number.POSITIVE_INFINITY,
    );
  });

  it("uses SKIP LOCKED to claim other work while a candidate is held", async () => {
    await repository.createWorkItem({ id: "a", title: "First" });
    await repository.createWorkItem({ id: "b", title: "Second" });

    let announceLock: (() => void) | undefined;
    const itemLocked = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    let releaseLock: (() => void) | undefined;
    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const lockTransaction = db.transaction(async (transaction) => {
      await transaction
        .select({ id: schema.workItem.id })
        .from(schema.workItem)
        .where(eq(schema.workItem.id, "a"))
        .for("update");
      announceLock?.();
      await holdLock;
    });
    await itemLocked;

    try {
      await expect(
        repository.claimWorkItem({
          leaseId: leaseId(20),
          workerId: "worker-b",
          leaseDurationSeconds: 300,
        }),
      ).resolves.toEqual(expect.objectContaining({ workItemId: "b" }));
    } finally {
      releaseLock?.();
      await lockTransaction;
    }
  });

  it("reclaims stale work with a higher epoch and expires the old lease", async () => {
    await repository.createWorkItem({ id: "work", title: "Stale work" });
    const firstLease = await repository.claimWorkItem({
      leaseId: leaseId(30),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!firstLease) throw new Error("Expected the first claim to succeed.");

    await db
      .update(schema.lease)
      .set({
        acquiredAt: new Date("2000-01-01T00:00:00Z"),
        expiresAt: new Date("2000-01-01T00:01:00Z"),
      })
      .where(eq(schema.lease.id, firstLease.id));

    expect((await repository.getWorkItem("work")).stage).toBe("stale");

    const reclaimed = await repository.claimWorkItem({
      leaseId: leaseId(31),
      workerId: "worker-b",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    expect(reclaimed).toEqual(
      expect.objectContaining({
        id: leaseId(31),
        workItemId: "work",
        workerId: "worker-b",
        epoch: 2,
      }),
    );

    const history = await repository.listLeases("work");
    expect(history[0]).toEqual(
      expect.objectContaining({
        id: firstLease.id,
        epoch: 1,
        outcome: "expired",
      }),
    );
    expect(history[0]?.endedAt).toBeInstanceOf(Date);
    expect(history[1]).toEqual(reclaimed);

    await expect(
      repository.renewLease({
        leaseId: firstLease.id,
        epoch: firstLease.epoch,
        leaseDurationSeconds: 300,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );
    await expect(
      repository.terminateClaimedWorkItem({
        leaseId: firstLease.id,
        epoch: firstLease.epoch,
        workItemId: "work",
        outcome: "released",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );
  });

  it("renews only the active lease at the current epoch", async () => {
    await repository.createWorkItem({ id: "work", title: "Renewable work" });
    const claimed = await repository.claimWorkItem({
      leaseId: leaseId(40),
      workerId: "worker-a",
      leaseDurationSeconds: 60,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected the claim to succeed.");

    await expect(
      repository.renewLease({
        leaseId: claimed.id,
        epoch: claimed.epoch + 1,
        leaseDurationSeconds: 600,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );

    const renewed = await repository.renewLease({
      leaseId: claimed.id,
      epoch: claimed.epoch,
      leaseDurationSeconds: 600,
    });
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(
      claimed.expiresAt.getTime(),
    );
    expect(renewed.acquiredAt).toEqual(claimed.acquiredAt);
  });

  it("rejects renewal when a lease expires while waiting for its item lock", async () => {
    await repository.createWorkItem({ id: "work", title: "Expiring work" });
    const claimed = await repository.claimWorkItem({
      leaseId: leaseId(41),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected the claim to succeed.");
    await db
      .update(schema.lease)
      .set({ expiresAt: sql`clock_timestamp() + interval '1 second'` })
      .where(eq(schema.lease.id, claimed.id));

    let announceLock: (() => void) | undefined;
    const itemLocked = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    let releaseLock: (() => void) | undefined;
    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const lockTransaction = db.transaction(async (transaction) => {
      await transaction
        .select({ id: schema.workItem.id })
        .from(schema.workItem)
        .where(eq(schema.workItem.id, "work"))
        .for("update");
      announceLock?.();
      await holdLock;
    });
    await itemLocked;

    const renewalResult = Promise.allSettled([
      repository.renewLease({
        leaseId: claimed.id,
        epoch: claimed.epoch,
        leaseDurationSeconds: 300,
      }),
    ]);
    try {
      await waitForDatabaseLock();
      await db.execute(sql`select pg_sleep(1.1)`);
    } finally {
      releaseLock?.();
      await lockTransaction;
    }

    const [renewal] = await renewalResult;
    if (!renewal) throw new Error("Expected one renewal result.");
    expectWorkGraphError(renewal, "lease_not_current");
  });

  it("terminates claimed work and retains the lease outcome", async () => {
    await repository.createWorkItem({ id: "work", title: "Claimed work" });
    const claimed = await repository.claimWorkItem({
      leaseId: leaseId(50),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected the claim to succeed.");

    await expect(repository.releaseWorkItem("work")).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_has_current_lease",
      }),
    );

    const completed = await repository.terminateClaimedWorkItem({
      leaseId: claimed.id,
      epoch: claimed.epoch,
      workItemId: "work",
      outcome: "released",
    });

    expect(completed.outcome).toBe("released");
    expect(completed.endedAt).toBeInstanceOf(Date);
    expect(projectWorkItemStage(await repository.load(), "work")).toBe(
      "released",
    );
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(51),
        workerId: "worker-b",
        leaseDurationSeconds: 300,
        workItemId: "work",
      }),
    ).resolves.toBeNull();
    await expect(
      repository.terminateClaimedWorkItem({
        leaseId: claimed.id,
        epoch: claimed.epoch,
        workItemId: "work",
        outcome: "cancelled",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );
  });

  it("rejects direct termination when a claim commits during its lock wait", async () => {
    await repository.createWorkItem({ id: "work", title: "Contended work" });

    let announceLock: (() => void) | undefined;
    const itemLocked = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    let finishClaim: (() => void) | undefined;
    const holdClaim = new Promise<void>((resolve) => {
      finishClaim = resolve;
    });
    const claimTransaction = db.transaction(async (transaction) => {
      await transaction
        .select({ id: schema.workItem.id })
        .from(schema.workItem)
        .where(eq(schema.workItem.id, "work"))
        .for("update");
      announceLock?.();
      await holdClaim;
      await transaction.insert(schema.lease).values({
        id: leaseId(52),
        workItemId: "work",
        workerId: "worker-a",
        epoch: 1,
        expiresAt: sql`clock_timestamp() + interval '5 minutes'`,
      });
    });
    await itemLocked;

    const terminationResult = Promise.allSettled([
      repository.releaseWorkItem("work"),
    ]);
    try {
      await waitForDatabaseLock();
    } finally {
      finishClaim?.();
    }
    await claimTransaction;

    const [termination] = await terminationResult;
    if (!termination) throw new Error("Expected one termination result.");
    expectWorkGraphError(termination, "work_item_has_current_lease");
    expect(
      (await repository.load()).workItems.find(({ id }) => id === "work")
        ?.lifecycle,
    ).toBe("open");
    expect(await repository.getCurrentLease("work")).toEqual(
      expect.objectContaining({ id: leaseId(52), epoch: 1 }),
    );
  });

  it("expires a stale lease before direct termination", async () => {
    await repository.createWorkItem({ id: "work", title: "Abandoned work" });
    await db.insert(schema.lease).values({
      id: leaseId(53),
      workItemId: "work",
      workerId: "worker-a",
      epoch: 1,
      acquiredAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await repository.cancelWorkItem("work");

    expect(
      (await repository.load()).workItems.find(({ id }) => id === "work")
        ?.lifecycle,
    ).toBe("cancelled");
    expect(await repository.getCurrentLease("work")).toBeNull();
    expect(await repository.listLeases("work")).toEqual([
      expect.objectContaining({
        id: leaseId(53),
        epoch: 1,
        outcome: "expired",
        endedAt: expect.any(Date),
      }),
    ]);
  });

  it("fails closed when claim coordination cannot lock the graph", async () => {
    await repository.createWorkItem({ id: "work", title: "Unclaimable work" });
    await db.delete(schema.graphMutationLock);

    try {
      await expect(
        repository.claimWorkItem({
          leaseId: leaseId(60),
          workerId: "worker-a",
          leaseDurationSeconds: 300,
        }),
      ).rejects.toThrow("The global graph mutation lock row is missing.");
      expect(await repository.listLeases("work")).toEqual([]);
    } finally {
      await db.insert(schema.graphMutationLock).values({ id: "global" });
    }
  });

  it("rejects malformed lease commands before reaching PostgreSQL", async () => {
    await repository.createWorkItem({ id: "work", title: "Valid work" });

    await expect(
      repository.claimWorkItem({
        leaseId: "not-a-uuid",
        workerId: "worker-a",
        leaseDurationSeconds: 300,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_lease_id",
      }),
    );
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(70),
        workerId: " ",
        leaseDurationSeconds: 300,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_worker_id",
      }),
    );
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(71),
        workerId: "worker-a",
        leaseDurationSeconds: 0,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_lease_duration",
      }),
    );
    await expect(
      repository.terminateClaimedWorkItem({
        leaseId: leaseId(72),
        epoch: 1,
        workItemId: "work",
        outcome: "released",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );

    await repository.createWorkItem({ id: "other", title: "Other work" });
    await repository.claimWorkItem({
      leaseId: leaseId(73),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    await expect(
      repository.claimWorkItem({
        leaseId: leaseId(73),
        workerId: "worker-b",
        leaseDurationSeconds: 300,
        workItemId: "other",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "duplicate_lease_id",
      }),
    );
  });
});

describe("lease-fenced notes and attention", () => {
  it("rejects audit records whose lease belongs to another work item", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    await repository.createWorkItem({ id: "other", title: "Other" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(230),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");

    expect(
      await rejectedDatabaseError(
        db.insert(schema.note).values({
          id: recordId(231),
          workItemId: "other",
          leaseId: claimed.id,
          content: "Mismatched provenance",
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        code: "23503",
        constraint_name: "notes_lease_work_item_fk",
      }),
    );
    expect(
      await rejectedDatabaseError(
        db.insert(schema.attentionRequest).values({
          id: recordId(232),
          workItemId: "other",
          requestingLeaseId: claimed.id,
          kind: "review",
          question: "Can this mismatched lease be recorded?",
          blocking: false,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        code: "23503",
        constraint_name: "attention_requests_lease_work_item_fk",
      }),
    );
    expect(await db.select().from(schema.note)).toHaveLength(0);
    expect(await db.select().from(schema.attentionRequest)).toHaveLength(0);
  });

  it("filters and bounds attention requests in PostgreSQL", async () => {
    const work = [
      { id: "first", leaseId: recordId(240) },
      { id: "resolved", leaseId: recordId(241) },
      { id: "last", leaseId: recordId(242) },
    ] as const;
    for (const item of work) {
      await repository.createWorkItem({ id: item.id, title: item.id });
      const claimed = await repository.claimWorkItem({
        leaseId: item.leaseId,
        workerId: "worker-a",
        leaseDurationSeconds: 300,
        workItemId: item.id,
      });
      if (!claimed) throw new Error(`Expected ${item.id} to be claimed.`);
    }

    const first = await repository.createAttentionRequest({
      id: recordId(243),
      workItemId: "first",
      leaseId: work[0].leaseId,
      epoch: 1,
      kind: "decision",
      question: "First question",
      blocking: true,
    });
    const resolved = await repository.createAttentionRequest({
      id: recordId(244),
      workItemId: "resolved",
      leaseId: work[1].leaseId,
      epoch: 1,
      kind: "review",
      question: "Resolved question",
      blocking: false,
    });
    const resolution = await repository.resolveAttentionRequest({
      id: recordId(245),
      attentionRequestId: resolved.attentionRequest.id,
      resolution: "Resolved answer",
    });
    const last = await repository.createAttentionRequest({
      id: recordId(246),
      workItemId: "last",
      leaseId: work[2].leaseId,
      epoch: 1,
      kind: "decision",
      question: "Last question",
      blocking: true,
    });

    expect(
      await repository.listAttentionRequests({
        state: "unresolved",
        blocking: true,
        limit: 1,
      }),
    ).toEqual([{ ...first.attentionRequest, resolution: null }]);
    expect(
      await repository.listAttentionRequests({
        state: "unresolved",
        blocking: true,
        cursor: first.attentionRequest.id,
        limit: 1,
      }),
    ).toEqual([{ ...last.attentionRequest, resolution: null }]);
    expect(
      await repository.listAttentionRequests({
        state: "resolved",
        blocking: false,
        limit: 1,
      }),
    ).toEqual([
      {
        ...resolved.attentionRequest,
        resolution: resolution.resolution,
      },
    ]);
  });

  it("records an idempotent note only for the current lease epoch", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(201),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");
    const input = {
      id: recordId(202),
      workItemId: "work",
      leaseId: claimed.id,
      epoch: claimed.epoch,
      content: "The API contract is generated from the route registry.",
    };
    const options = { idempotencyKey: recordId(203) };

    const first = await repository.createNote(input, options);
    const replay = await repository.createNote(input, options);

    expect(replay).toEqual(first);
    expect(await repository.listNotes("work")).toEqual([first]);
    await expect(
      repository.createNote(
        { ...input, id: recordId(204), epoch: claimed.epoch + 1 },
        { idempotencyKey: recordId(205) },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );
  });

  it("ends a lease for blocking attention and allows another worker after resolution", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(206),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");
    const requestInput = {
      id: recordId(207),
      workItemId: "work",
      leaseId: claimed.id,
      epoch: claimed.epoch,
      kind: "decision",
      question: "Should this endpoint accept non-blocking requests?",
      note: "The schema can represent either choice.",
      blocking: true,
    };
    const requestOptions = { idempotencyKey: recordId(208) };

    const opened = await repository.createAttentionRequest(
      requestInput,
      requestOptions,
    );
    const replay = await repository.createAttentionRequest(
      requestInput,
      requestOptions,
    );

    expect(replay).toEqual(opened);
    expect(opened.attentionRequest).toEqual(
      expect.objectContaining({
        requestingLeaseId: claimed.id,
        kind: "decision",
        question: "Should this endpoint accept non-blocking requests?",
        note: "The schema can represent either choice.",
        blocking: true,
      }),
    );
    expect(opened.endedLease).toEqual(
      expect.objectContaining({
        workerId: "worker-a",
        outcome: "attention_requested",
      }),
    );
    expect((await repository.getWorkItem("work")).stage).toBe(
      "needs_attention",
    );
    expect(await repository.listAttentionRequests()).toEqual([
      { ...opened.attentionRequest, resolution: null },
    ]);
    await expect(
      repository.claimWorkItem({
        leaseId: recordId(209),
        workerId: "worker-b",
        leaseDurationSeconds: 300,
        workItemId: "work",
      }),
    ).resolves.toBeNull();

    const resolutionInput = {
      id: recordId(210),
      attentionRequestId: opened.attentionRequest.id,
      resolution: "Keep both forms and let blocking control the lease.",
    };
    const resolutionOptions = { idempotencyKey: recordId(211) };
    const resolution = await repository.resolveAttentionRequest(
      resolutionInput,
      resolutionOptions,
    );
    const resolutionReplay = await repository.resolveAttentionRequest(
      resolutionInput,
      resolutionOptions,
    );

    expect(resolutionReplay).toEqual(resolution);
    expect(await repository.listAttentionRequests()).toEqual([
      {
        ...opened.attentionRequest,
        resolution: resolution.resolution,
      },
    ]);
    expect((await repository.getWorkItem("work")).stage).toBe("ready");
    const resumed = await repository.claimWorkItem({
      leaseId: recordId(212),
      workerId: "worker-b",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    expect(resumed).toEqual(
      expect.objectContaining({ workerId: "worker-b", epoch: 2 }),
    );
  });

  it("recomputes other blockers after resolving attention", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(213),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");
    const opened = await repository.createAttentionRequest({
      id: recordId(214),
      workItemId: "work",
      leaseId: claimed.id,
      epoch: claimed.epoch,
      kind: "input",
      question: "Which prerequisite applies?",
      blocking: true,
    });
    await repository.addDependency(dependency("work", "blocker"));

    await repository.resolveAttentionRequest({
      id: recordId(215),
      attentionRequestId: opened.attentionRequest.id,
      resolution: "The blocker must finish first.",
    });

    expect((await repository.getWorkItem("work")).stage).toBe("blocked");
  });

  it("keeps a lease active for non-blocking attention", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(216),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");

    const opened = await repository.createAttentionRequest({
      id: recordId(217),
      workItemId: "work",
      leaseId: claimed.id,
      epoch: claimed.epoch,
      kind: "review",
      question: "Can someone check the wording while implementation continues?",
      blocking: false,
    });

    expect(opened.endedLease).toBeNull();
    expect((await repository.getWorkItem("work")).stage).toBe("in_progress");
    expect(await repository.getCurrentLease("work")).toEqual(claimed);
  });

  it("accepts exactly one of two concurrent resolutions", async () => {
    await repository.createWorkItem({ id: "work", title: "Work" });
    const claimed = await repository.claimWorkItem({
      leaseId: recordId(218),
      workerId: "worker-a",
      leaseDurationSeconds: 300,
      workItemId: "work",
    });
    if (!claimed) throw new Error("Expected work to be claimed.");
    const opened = await repository.createAttentionRequest({
      id: recordId(219),
      workItemId: "work",
      leaseId: claimed.id,
      epoch: claimed.epoch,
      kind: "decision",
      question: "Choose one answer.",
      blocking: true,
    });

    const results = await Promise.allSettled([
      repository.resolveAttentionRequest({
        id: recordId(220),
        attentionRequestId: opened.attentionRequest.id,
        resolution: "First answer.",
      }),
      repository.resolveAttentionRequest({
        id: recordId(221),
        attentionRequestId: opened.attentionRequest.id,
        resolution: "Second answer.",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const [rejected] = results.filter(({ status }) => status === "rejected");
    if (!rejected) throw new Error("Expected one resolution to be rejected.");
    expectWorkGraphError(rejected, "attention_request_already_resolved");
  });
});

describe("Work Graph PostgreSQL persistence", () => {
  it("persists a sparse work item without fixed task or readiness fields", async () => {
    await repository.createWorkItem({
      id: "sparse",
      title: "Sparse work item",
    });

    expect(await repository.load()).toEqual({
      workItems: [
        {
          id: "sparse",
          title: "Sparse work item",
          lifecycle: "open",
          parentId: null,
          rank: null,
        },
      ],
      dependencies: [],
    });

    const columns = await db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'work_items'
      order by ordinal_position
    `);
    expect(columns.map(({ column_name }) => column_name)).toEqual([
      "id",
      "title",
      "lifecycle",
      "created_at",
      "updated_at",
    ]);
  });

  it("serializes concurrent retries of one sparse work-item creation", async () => {
    const key = "00000000-0000-4000-8000-000000000081";
    const request = () =>
      repository.createWorkItem(
        { id: "retried", title: "Created once" },
        { idempotencyKey: key },
      );

    const [first, retry] = await Promise.all([request(), request()]);

    expect(first).toEqual(retry);
    expect((await repository.load()).workItems).toEqual([
      {
        id: "retried",
        title: "Created once",
        lifecycle: "open",
        parentId: null,
        rank: null,
      },
    ]);
    await expect(
      repository.createWorkItem(
        { id: "different", title: "Different input" },
        { idempotencyKey: key },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "idempotency_key_reused",
      }),
    );
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(1);
  });

  it("derives readiness from persisted hierarchy, dependencies, and lifecycle", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    await repository.addDependency(dependency("parent", "blocker"));

    const blocked = await repository.listWorkItems();
    expect(blocked.find(({ id }) => id === "parent")?.stage).toBe("blocked");
    expect(blocked.find(({ id }) => id === "child")?.stage).toBe("blocked");

    await repository.releaseWorkItem("child");
    await repository.cancelWorkItem("blocker");

    const ready = await repository.getWorkItem("parent");
    expect(ready).toEqual(
      expect.objectContaining({
        id: "parent",
        lifecycle: "open",
        stage: "ready",
        currentLease: null,
      }),
    );
    expect((await repository.load()).dependencies).toEqual([
      dependency("parent", "blocker"),
    ]);
  });

  it("records explicit terminal changes once", async () => {
    await repository.createWorkItem({ id: "released", title: "Released" });
    await repository.createWorkItem({ id: "cancelled", title: "Cancelled" });

    await repository.releaseWorkItem("released");
    await repository.cancelWorkItem("cancelled");

    const graph = await repository.load();
    expect(projectWorkItemStage(graph, "released")).toBe("released");
    expect(projectWorkItemStage(graph, "cancelled")).toBe("cancelled");
    await expect(repository.cancelWorkItem("released")).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_already_terminal",
      }),
    );
  });

  it("reparents work without replacing its identity or lifecycle", async () => {
    await repository.createWorkItem({
      id: "old-parent",
      title: "Old parent",
    });
    await repository.createWorkItem({
      id: "new-parent",
      title: "New parent",
    });
    await repository.createWorkItem({
      id: "work",
      title: "Stable work",
      parentId: "old-parent",
    });
    await repository.releaseWorkItem("work");

    await repository.reparentWorkItem("work", "new-parent");

    expect(
      (await repository.load()).workItems.find(({ id }) => id === "work"),
    ).toEqual({
      id: "work",
      title: "Stable work",
      lifecycle: "released",
      parentId: "new-parent",
      rank: null,
    });
  });

  it("rolls back a work item whose parent does not exist", async () => {
    await expect(
      repository.createWorkItem({
        id: "orphan",
        title: "Orphan",
        parentId: "missing",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_not_found",
      }),
    );

    expect((await repository.load()).workItems).toEqual([]);
  });

  it("preserves domain errors across database transactions", async () => {
    await repository.createWorkItem({ id: "existing", title: "Existing" });

    await expect(
      repository.createWorkItem({ id: "existing", title: "Duplicate" }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "duplicate_work_item",
      }),
    );
    await expect(
      repository.createWorkItem(
        { id: "invalid-key", title: "Invalid key" },
        { idempotencyKey: "not-a-uuid" },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_idempotency_key",
      }),
    );
    await expect(repository.reparentWorkItem("", null)).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_work_item_id",
      }),
    );
    await expect(
      repository.reparentWorkItem("existing", ""),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_parent_id",
      }),
    );
    await expect(repository.releaseWorkItem("missing")).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_not_found",
      }),
    );
    await expect(repository.getWorkItem("missing")).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_not_found",
      }),
    );
    await expect(
      repository.addDependency(dependency("existing", "missing")),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_not_found",
      }),
    );
  });
});

describe("atomic graph mutations", () => {
  const createThreeItems = async (): Promise<void> => {
    await repository.createWorkItem({ id: "a", title: "A" });
    await repository.createWorkItem({ id: "b", title: "B" });
    await repository.createWorkItem({ id: "c", title: "C" });
  };

  it("rejects hierarchy cycles and leaves the previous parent intact", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });

    await expect(
      repository.reparentWorkItem("parent", "child"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );

    const graph = await repository.load();
    expect(graph.workItems.find(({ id }) => id === "parent")?.parentId).toBe(
      null,
    );
    expect(graph.workItems.find(({ id }) => id === "child")?.parentId).toBe(
      "parent",
    );
  });

  it("rejects direct constraint violations with domain errors", async () => {
    await repository.createWorkItem({ id: "a", title: "A" });
    await repository.createWorkItem({ id: "b", title: "B" });

    await expect(repository.reparentWorkItem("a", "a")).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );
    await expect(
      repository.addDependency(dependency("a", "a")),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "self_dependency",
      }),
    );

    const edge = dependency("a", "b");
    await repository.addDependency(edge);
    await expect(repository.addDependency(edge)).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "dependency_already_exists",
      }),
    );
  });

  it("can move a child back to the graph root", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });

    await repository.reparentWorkItem("child", null);

    expect(
      (await repository.load()).workItems.find(({ id }) => id === "child")
        ?.parentId,
    ).toBeNull();
  });

  it("fails closed when the graph-mutation lock is missing", async () => {
    await repository.createWorkItem({ id: "a", title: "A" });
    await repository.createWorkItem({ id: "b", title: "B" });
    await db.delete(schema.graphMutationLock);

    try {
      await expect(
        repository.addDependency(dependency("a", "b")),
      ).rejects.toThrow("The global graph mutation lock row is missing.");
      expect((await repository.load()).dependencies).toEqual([]);
    } finally {
      await db.insert(schema.graphMutationLock).values({ id: "global" });
    }
  });

  it("rejects direct and transitive dependency cycles atomically", async () => {
    await createThreeItems();
    await repository.addDependency(dependency("a", "b"));
    await repository.addDependency(dependency("b", "c"));

    await expect(
      repository.addDependency(dependency("c", "a")),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );

    expect((await repository.load()).dependencies).toEqual([
      dependency("a", "b"),
      dependency("b", "c"),
    ]);
  });

  it("replays dependency additions and removals with separate mutation keys", async () => {
    await repository.createWorkItem({ id: "a", title: "A" });
    await repository.createWorkItem({ id: "b", title: "B" });
    const edge = dependency("a", "b");
    const addOptions = {
      idempotencyKey: "00000000-0000-4000-8000-000000000082",
    };
    const removeOptions = {
      idempotencyKey: "00000000-0000-4000-8000-000000000083",
    };

    await repository.addDependency(edge, addOptions);
    await repository.addDependency(edge, addOptions);
    expect((await repository.load()).dependencies).toEqual([edge]);

    await expect(
      repository.removeDependency(edge, addOptions),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "idempotency_key_reused",
      }),
    );
    await repository.removeDependency(edge, removeOptions);
    await repository.removeDependency(edge, removeOptions);

    expect((await repository.load()).dependencies).toEqual([]);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(2);
  });

  it.each([
    ["child depending on its parent", "child", "parent"],
    ["parent depending on its descendant", "parent", "child"],
  ])("rejects a %s in the combined waits-for graph", async (_name, from, to) => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });

    await expect(
      repository.addDependency(dependency(from, to)),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );
    expect((await repository.load()).dependencies).toEqual([]);
  });

  it("serializes concurrent hierarchy and dependency edits", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({ id: "child", title: "Child" });

    const results = await Promise.allSettled([
      repository.reparentWorkItem("child", "parent"),
      repository.addDependency(dependency("child", "parent")),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const [rejection] = results.filter(({ status }) => status === "rejected");
    if (!rejection) throw new Error("Expected one graph mutation to fail.");
    expectWorkGraphError(rejection, "graph_cycle");

    const graph = await repository.load();
    expect(() => projectWorkItemStage(graph, "parent")).not.toThrow();
    expect(
      graph.dependencies.length +
        graph.workItems.filter(({ parentId }) => parentId !== null).length,
    ).toBe(1);
  });

  it("removes dependencies without merging them into hierarchy", async () => {
    await createThreeItems();
    const edge = dependency("a", "b");
    await repository.addDependency(edge);
    await repository.reparentWorkItem("c", "a");

    await repository.removeDependency(edge);

    const graph = await repository.load();
    expect(graph.dependencies).toEqual([]);
    expect(graph.workItems.find(({ id }) => id === "c")?.parentId).toBe("a");
    await expect(repository.removeDependency(edge)).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "dependency_not_found",
      }),
    );
  });
});
