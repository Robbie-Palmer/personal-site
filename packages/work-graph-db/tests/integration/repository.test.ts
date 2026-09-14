import {
  projectWorkItemStage,
  WorkGraphError,
  type WorkItemDependency,
} from "work-graph-domain";
import { sql } from "drizzle-orm";
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

  expect(migrationCount?.count).toBe(1);
  expect(tables.map(({ table_name }) => table_name)).toEqual([
    "graph_mutation_locks",
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
});

beforeEach(async () => {
  await db.transaction(async (transaction) => {
    await transaction.delete(schema.workItemDependency);
    await transaction.delete(schema.workItemHierarchy);
    await transaction.delete(schema.workItem);
  });
});

afterAll(async () => {
  await closeDb(db);
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
