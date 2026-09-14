import {
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

  expect(migrationCount?.count).toBe(2);
  expect(tables.map(({ table_name }) => table_name)).toEqual([
    "graph_mutation_locks",
    "leases",
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
    expect(
      projectWorkItemStage(await repository.load(), "parent", {
        currentLease: { expiresAt: parentLease.expiresAt.getTime() },
        now: parentLease.acquiredAt.getTime(),
      }),
    ).toBe("in_progress");
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

    const staleGraph = await repository.load();
    expect(
      projectWorkItemStage(staleGraph, "work", {
        currentLease: { expiresAt: 946_684_860_000 },
        now: Date.now(),
      }),
    ).toBe("stale");

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
        outcome: "cancelled",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "lease_not_current",
      }),
    );
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

  it("derives readiness from persisted hierarchy, dependencies, and lifecycle", async () => {
    await repository.createWorkItem({ id: "parent", title: "Parent" });
    await repository.createWorkItem({
      id: "child",
      title: "Child",
      parentId: "parent",
    });
    await repository.createWorkItem({ id: "blocker", title: "Blocker" });
    await repository.addDependency(dependency("parent", "blocker"));

    const blocked = await repository.load();
    expect(projectWorkItemStage(blocked, "parent")).toBe("blocked");
    expect(projectWorkItemStage(blocked, "child")).toBe("blocked");

    await repository.releaseWorkItem("child");
    await repository.cancelWorkItem("blocker");

    const ready = await repository.load();
    expect(projectWorkItemStage(ready, "parent")).toBe("ready");
    expect(
      ready.workItems.find(({ id }) => id === "parent")?.lifecycle,
    ).toBe("open");
    expect(ready.dependencies).toEqual([dependency("parent", "blocker")]);
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
