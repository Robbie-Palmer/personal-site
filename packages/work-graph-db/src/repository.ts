import { and, eq } from "drizzle-orm";
import {
  createWorkGraph,
  WorkGraphError,
  type NewWorkItemInput,
  type TerminalWorkItemState,
  type WorkGraph,
  type WorkItem,
  type WorkItemDependency,
} from "work-graph-domain";
import type { Db, DbTransaction } from "./index";
import {
  graphCycleQuery,
  type GraphCycleRow,
} from "./queries/graph-cycle";
import {
  graphMutationLock,
  workItem,
  workItemDependency,
  workItemHierarchy,
} from "./schema";

const GRAPH_MUTATION_LOCK_ID = "global";

type DatabaseError = Error & {
  code?: string;
  constraint_name?: string;
};

const getDatabaseError = (error: unknown): DatabaseError | undefined => {
  if (!(error instanceof Error)) return undefined;
  if ("code" in error && typeof error.code === "string") {
    return error as DatabaseError;
  }
  if ("cause" in error) {
    return getDatabaseError(error.cause);
  }
  return undefined;
};

const requireIdentifier = (
  value: string,
  code: "invalid_parent_id" | "invalid_work_item_id",
): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkGraphError(
      code,
      code === "invalid_parent_id"
        ? "A parent work item ID cannot be empty."
        : "A work item ID cannot be empty.",
    );
  }
};

const workItemNotFound = (workItemId: string): WorkGraphError =>
  new WorkGraphError(
    "work_item_not_found",
    `Work item ${workItemId} does not exist.`,
  );

const translateForeignKeyError = (
  error: unknown,
  workItemId: string,
): never => {
  if (getDatabaseError(error)?.code === "23503") {
    throw workItemNotFound(workItemId);
  }
  throw error;
};

export class WorkGraphRepository {
  constructor(private readonly db: Db) {}

  async load(): Promise<WorkGraph> {
    return this.db.transaction(
      async (transaction) => {
        const workItems = await transaction
          .select({
            id: workItem.id,
            title: workItem.title,
            lifecycle: workItem.lifecycle,
            parentId: workItemHierarchy.parentWorkItemId,
          })
          .from(workItem)
          .leftJoin(
            workItemHierarchy,
            eq(workItemHierarchy.childWorkItemId, workItem.id),
          )
          .orderBy(workItem.createdAt, workItem.id);
        const dependencies = await transaction
          .select({
            dependentWorkItemId: workItemDependency.dependentWorkItemId,
            blockerWorkItemId: workItemDependency.blockerWorkItemId,
          })
          .from(workItemDependency)
          .orderBy(
            workItemDependency.dependentWorkItemId,
            workItemDependency.blockerWorkItemId,
          );

        return createWorkGraph({ workItems, dependencies });
      },
      {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      },
    );
  }

  async createWorkItem(input: NewWorkItemInput): Promise<WorkItem> {
    const [normalized] = createWorkGraph({
      workItems: [{ ...input, parentId: null }],
    }).workItems;
    if (!normalized) {
      throw new Error("Work item validation returned no work item.");
    }

    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      requireIdentifier(parentId, "invalid_parent_id");
    }

    try {
      await this.db.transaction(async (transaction) => {
        if (parentId !== null) {
          await this.lockGraphMutation(transaction);
        }

        await transaction.insert(workItem).values({
          id: normalized.id,
          title: normalized.title,
        });

        if (parentId !== null) {
          await transaction.insert(workItemHierarchy).values({
            childWorkItemId: normalized.id,
            parentWorkItemId: parentId,
          });
          await this.rejectCycle(transaction);
        }
      });
    } catch (error) {
      const databaseError = getDatabaseError(error);
      if (databaseError?.code === "23505") {
        throw new WorkGraphError(
          "duplicate_work_item",
          `Work item ${normalized.id} already exists.`,
        );
      }
      if (
        databaseError?.code === "23514" &&
        databaseError.constraint_name === "work_item_hierarchy_not_self_check"
      ) {
        throw new WorkGraphError(
          "graph_cycle",
          "The change creates a waits-for cycle.",
        );
      }
      translateForeignKeyError(error, parentId ?? normalized.id);
    }

    return { ...normalized, parentId };
  }

  async reparentWorkItem(
    workItemId: string,
    parentId: string | null,
  ): Promise<void> {
    requireIdentifier(workItemId, "invalid_work_item_id");
    if (parentId !== null) {
      requireIdentifier(parentId, "invalid_parent_id");
    }

    try {
      await this.db.transaction(async (transaction) => {
        await this.lockGraphMutation(transaction);
        await this.requireStoredWorkItem(transaction, workItemId);

        if (parentId === null) {
          await transaction
            .delete(workItemHierarchy)
            .where(eq(workItemHierarchy.childWorkItemId, workItemId));
        } else {
          await transaction
            .insert(workItemHierarchy)
            .values({
              childWorkItemId: workItemId,
              parentWorkItemId: parentId,
            })
            .onConflictDoUpdate({
              target: workItemHierarchy.childWorkItemId,
              set: { parentWorkItemId: parentId },
            });
        }

        await this.rejectCycle(transaction);
      });
    } catch (error) {
      const databaseError = getDatabaseError(error);
      if (
        databaseError?.code === "23514" &&
        databaseError.constraint_name === "work_item_hierarchy_not_self_check"
      ) {
        throw new WorkGraphError(
          "graph_cycle",
          "The change creates a waits-for cycle.",
        );
      }
      translateForeignKeyError(error, parentId ?? workItemId);
    }
  }

  async addDependency(dependency: WorkItemDependency): Promise<void> {
    try {
      await this.db.transaction(async (transaction) => {
        await this.lockGraphMutation(transaction);
        await this.requireStoredWorkItem(
          transaction,
          dependency.dependentWorkItemId,
        );
        await this.requireStoredWorkItem(
          transaction,
          dependency.blockerWorkItemId,
        );
        await transaction.insert(workItemDependency).values(dependency);
        await this.rejectCycle(transaction);
      });
    } catch (error) {
      const databaseError = getDatabaseError(error);
      if (databaseError?.code === "23505") {
        throw new WorkGraphError(
          "dependency_already_exists",
          `Dependency ${dependency.dependentWorkItemId} -> ${dependency.blockerWorkItemId} already exists.`,
        );
      }
      if (
        databaseError?.code === "23514" &&
        databaseError.constraint_name ===
          "work_item_dependencies_not_self_check"
      ) {
        throw new WorkGraphError(
          "self_dependency",
          `Work item ${dependency.dependentWorkItemId} cannot depend on itself.`,
        );
      }
      translateForeignKeyError(error, dependency.dependentWorkItemId);
    }
  }

  async removeDependency(dependency: WorkItemDependency): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await this.lockGraphMutation(transaction);
      const removed = await transaction
        .delete(workItemDependency)
        .where(
          and(
            eq(
              workItemDependency.dependentWorkItemId,
              dependency.dependentWorkItemId,
            ),
            eq(
              workItemDependency.blockerWorkItemId,
              dependency.blockerWorkItemId,
            ),
          ),
        )
        .returning({
          dependentWorkItemId: workItemDependency.dependentWorkItemId,
        });
      if (removed.length === 0) {
        throw new WorkGraphError(
          "dependency_not_found",
          `Dependency ${dependency.dependentWorkItemId} -> ${dependency.blockerWorkItemId} does not exist.`,
        );
      }
      await this.rejectCycle(transaction);
    });
  }

  async releaseWorkItem(workItemId: string): Promise<void> {
    await this.terminateWorkItem(workItemId, "released");
  }

  async cancelWorkItem(workItemId: string): Promise<void> {
    await this.terminateWorkItem(workItemId, "cancelled");
  }

  private async terminateWorkItem(
    workItemId: string,
    lifecycle: TerminalWorkItemState,
  ): Promise<void> {
    requireIdentifier(workItemId, "invalid_work_item_id");

    await this.db.transaction(async (transaction) => {
      const updated = await transaction
        .update(workItem)
        .set({ lifecycle })
        .where(
          and(eq(workItem.id, workItemId), eq(workItem.lifecycle, "open")),
        )
        .returning({ id: workItem.id });
      if (updated.length > 0) {
        return;
      }

      const [existing] = await transaction
        .select({ lifecycle: workItem.lifecycle })
        .from(workItem)
        .where(eq(workItem.id, workItemId))
        .limit(1);
      if (!existing) {
        throw workItemNotFound(workItemId);
      }
      throw new WorkGraphError(
        "work_item_already_terminal",
        `Work item ${workItemId} is already ${existing.lifecycle}.`,
      );
    });
  }

  private async lockGraphMutation(transaction: DbTransaction): Promise<void> {
    const locked = await transaction
      .select({ id: graphMutationLock.id })
      .from(graphMutationLock)
      .where(eq(graphMutationLock.id, GRAPH_MUTATION_LOCK_ID))
      .for("update");
    if (locked.length !== 1) {
      throw new Error("The global graph mutation lock row is missing.");
    }
  }

  private async requireStoredWorkItem(
    transaction: DbTransaction,
    workItemId: string,
  ): Promise<void> {
    const stored = await transaction
      .select({ id: workItem.id })
      .from(workItem)
      .where(eq(workItem.id, workItemId))
      .limit(1);
    if (stored.length === 0) {
      throw workItemNotFound(workItemId);
    }
  }

  private async rejectCycle(transaction: DbTransaction): Promise<void> {
    const [result] = await transaction.execute<GraphCycleRow>(graphCycleQuery);
    if (result?.hasCycle === true) {
      throw new WorkGraphError(
        "graph_cycle",
        "The change creates a waits-for cycle.",
      );
    }
  }
}
