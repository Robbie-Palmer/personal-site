import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import {
  createWorkGraph,
  WorkGraphError,
  type NewWorkItemInput,
  type TerminalWorkItemState,
  type WorkGraph,
  type WorkItem,
  type WorkItemDependency,
} from "work-graph-domain";
import type { Db, DbTransaction } from "./connection";
import { claimableWorkItemWhere } from "./queries/claimable-work-item";
import {
  graphCycleQuery,
  type GraphCycleRow,
} from "./queries/graph-cycle";
import {
  graphMutationLock,
  lease,
  workItem,
  workItemDependency,
  workItemHierarchy,
} from "./schema";

const GRAPH_MUTATION_LOCK_ID = "global";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoredLease = typeof lease.$inferSelect;

export interface ClaimWorkItemInput {
  readonly leaseId: string;
  readonly workerId: string;
  readonly leaseDurationSeconds: number;
  readonly workItemId?: string;
}

export interface RenewLeaseInput {
  readonly leaseId: string;
  readonly epoch: number;
  readonly leaseDurationSeconds: number;
}

export interface TerminateClaimedWorkItemInput {
  readonly leaseId: string;
  readonly epoch: number;
  readonly outcome: TerminalWorkItemState;
}

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

const requireLeaseId = (leaseId: string): void => {
  if (typeof leaseId !== "string" || !UUID_PATTERN.test(leaseId)) {
    throw new WorkGraphError(
      "invalid_lease_id",
      "A lease ID must be a UUID.",
    );
  }
};

const requireWorkerId = (workerId: string): void => {
  if (typeof workerId !== "string" || workerId.trim().length === 0) {
    throw new WorkGraphError(
      "invalid_worker_id",
      "A worker ID cannot be empty.",
    );
  }
};

const requireLeaseDuration = (leaseDurationSeconds: number): void => {
  if (
    !Number.isSafeInteger(leaseDurationSeconds) ||
    leaseDurationSeconds <= 0
  ) {
    throw new WorkGraphError(
      "invalid_lease_duration",
      "A lease duration must be a positive whole number of seconds.",
    );
  }
};

const requireLeaseEpoch = (epoch: number): void => {
  if (!Number.isSafeInteger(epoch) || epoch <= 0) {
    throw new WorkGraphError(
      "invalid_lease_epoch",
      "A lease epoch must be a positive whole number.",
    );
  }
};

const leaseNotCurrent = (leaseId: string, epoch: number): WorkGraphError =>
  new WorkGraphError(
    "lease_not_current",
    `Lease ${leaseId} at epoch ${epoch} is not current and active.`,
  );

const readDatabaseClock = async (
  transaction: DbTransaction,
): Promise<Date> => {
  const [clock] = await transaction.execute<{ currentTime: string }>(sql`
    select clock_timestamp() as "currentTime"
  `);
  if (!clock) {
    throw new Error("Reading the database clock returned no row.");
  }
  return new Date(clock.currentTime);
};

const calculateLeaseExpiry = (
  acquiredAt: Date,
  leaseDurationSeconds: number,
): Date => {
  const expiresAt = new Date(
    acquiredAt.getTime() + leaseDurationSeconds * 1_000,
  );
  if (Number.isNaN(expiresAt.getTime())) {
    throw new WorkGraphError(
      "invalid_lease_duration",
      "The lease duration exceeds the supported timestamp range.",
    );
  }
  return expiresAt;
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

  async claimWorkItem(input: ClaimWorkItemInput): Promise<StoredLease | null> {
    requireLeaseId(input.leaseId);
    requireWorkerId(input.workerId);
    requireLeaseDuration(input.leaseDurationSeconds);
    if (input.workItemId !== undefined) {
      requireIdentifier(input.workItemId, "invalid_work_item_id");
    }

    try {
      return await this.db.transaction(
        async (transaction) => {
          await this.lockGraphSnapshot(transaction);

          const excludedWorkItemIds: string[] = [];
          let candidateId: string | undefined;
          while (candidateId === undefined) {
            const [candidate] = await transaction
              .select({ id: workItem.id })
              .from(workItem)
              .where(
                claimableWorkItemWhere(
                  input.workItemId,
                  excludedWorkItemIds,
                ),
              )
              .orderBy(workItem.createdAt, workItem.id)
              .limit(1)
              .for("update", { of: workItem, skipLocked: true });
            if (!candidate) return null;

            // A concurrent claimant can commit between predicate evaluation
            // and row locking. Recheck in a new READ COMMITTED statement after
            // the lock is held, then move on if it is no longer eligible.
            const [stillClaimable] = await transaction
              .select({ id: workItem.id })
              .from(workItem)
              .where(claimableWorkItemWhere(candidate.id))
              .limit(1);
            if (stillClaimable) {
              candidateId = candidate.id;
            } else {
              excludedWorkItemIds.push(candidate.id);
            }
          }

          const acquiredAt = await readDatabaseClock(transaction);
          const expiresAt = calculateLeaseExpiry(
            acquiredAt,
            input.leaseDurationSeconds,
          );

          await transaction
            .update(lease)
            .set({ endedAt: acquiredAt, outcome: "expired" })
            .where(
              and(
                eq(lease.workItemId, candidateId),
                isNull(lease.endedAt),
                lte(lease.expiresAt, acquiredAt),
              ),
            );

          const [epochRow] = await transaction
            .select({
              nextEpoch: sql<number>`coalesce(max(${lease.epoch}), 0) + 1`,
            })
            .from(lease)
            .where(eq(lease.workItemId, candidateId));
          if (!epochRow) {
            throw new Error("Lease epoch allocation returned no row.");
          }

          const [claimedLease] = await transaction
            .insert(lease)
            .values({
              id: input.leaseId,
              workItemId: candidateId,
              workerId: input.workerId,
              epoch: epochRow.nextEpoch,
              acquiredAt,
              expiresAt,
            })
            .returning();
          if (!claimedLease) {
            throw new Error("Lease creation returned no lease.");
          }
          return claimedLease;
        },
        { isolationLevel: "read committed" },
      );
    } catch (error) {
      const databaseError = getDatabaseError(error);
      if (
        databaseError?.code === "23505" &&
        databaseError.constraint_name === "leases_pkey"
      ) {
        throw new WorkGraphError(
          "duplicate_lease_id",
          `Lease ${input.leaseId} already exists.`,
        );
      }
      throw error;
    }
  }

  async renewLease(input: RenewLeaseInput): Promise<StoredLease> {
    requireLeaseId(input.leaseId);
    requireLeaseEpoch(input.epoch);
    requireLeaseDuration(input.leaseDurationSeconds);

    return this.db.transaction(async (transaction) => {
      const [storedLease] = await transaction
        .select({ workItemId: lease.workItemId })
        .from(lease)
        .where(eq(lease.id, input.leaseId))
        .limit(1);
      if (!storedLease) {
        throw leaseNotCurrent(input.leaseId, input.epoch);
      }

      await transaction
        .select({ id: workItem.id })
        .from(workItem)
        .where(eq(workItem.id, storedLease.workItemId))
        .for("update");

      const renewedAt = await readDatabaseClock(transaction);
      const expiresAt = calculateLeaseExpiry(
        renewedAt,
        input.leaseDurationSeconds,
      );

      const [renewedLease] = await transaction
        .update(lease)
        .set({ expiresAt })
        .where(
          and(
            eq(lease.id, input.leaseId),
            eq(lease.workItemId, storedLease.workItemId),
            eq(lease.epoch, input.epoch),
            isNull(lease.endedAt),
            gt(lease.expiresAt, renewedAt),
          ),
        )
        .returning();
      if (!renewedLease) {
        throw leaseNotCurrent(input.leaseId, input.epoch);
      }
      return renewedLease;
    });
  }

  async terminateClaimedWorkItem(
    input: TerminateClaimedWorkItemInput,
  ): Promise<StoredLease> {
    requireLeaseId(input.leaseId);
    requireLeaseEpoch(input.epoch);

    return this.db.transaction(async (transaction) => {
      const [storedLease] = await transaction
        .select({ workItemId: lease.workItemId })
        .from(lease)
        .where(eq(lease.id, input.leaseId))
        .limit(1);
      if (!storedLease) {
        throw leaseNotCurrent(input.leaseId, input.epoch);
      }

      await transaction
        .select({ id: workItem.id })
        .from(workItem)
        .where(eq(workItem.id, storedLease.workItemId))
        .for("update");

      const completedAt = await readDatabaseClock(transaction);

      const [completedLease] = await transaction
        .update(lease)
        .set({ endedAt: completedAt, outcome: input.outcome })
        .where(
          and(
            eq(lease.id, input.leaseId),
            eq(lease.workItemId, storedLease.workItemId),
            eq(lease.epoch, input.epoch),
            isNull(lease.endedAt),
            gt(lease.expiresAt, completedAt),
          ),
        )
        .returning();
      if (!completedLease) {
        throw leaseNotCurrent(input.leaseId, input.epoch);
      }

      const updated = await transaction
        .update(workItem)
        .set({ lifecycle: input.outcome })
        .where(
          and(
            eq(workItem.id, storedLease.workItemId),
            eq(workItem.lifecycle, "open"),
          ),
        )
        .returning({ id: workItem.id });
      if (updated.length === 0) {
        const [existing] = await transaction
          .select({ lifecycle: workItem.lifecycle })
          .from(workItem)
          .where(eq(workItem.id, storedLease.workItemId))
          .limit(1);
        throw new WorkGraphError(
          "work_item_already_terminal",
          `Work item ${storedLease.workItemId} is already ${existing?.lifecycle ?? "terminal"}.`,
        );
      }

      return completedLease;
    });
  }

  async listLeases(workItemId: string): Promise<readonly StoredLease[]> {
    requireIdentifier(workItemId, "invalid_work_item_id");
    return this.db
      .select()
      .from(lease)
      .where(eq(lease.workItemId, workItemId))
      .orderBy(lease.epoch);
  }

  async getCurrentLease(workItemId: string): Promise<StoredLease | null> {
    requireIdentifier(workItemId, "invalid_work_item_id");
    const [currentLease] = await this.db
      .select()
      .from(lease)
      .where(and(eq(lease.workItemId, workItemId), isNull(lease.endedAt)))
      .limit(1);
    return currentLease ?? null;
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
          and(
            eq(workItem.id, workItemId),
            eq(workItem.lifecycle, "open"),
            sql`not exists (
              select 1
              from ${lease}
              where ${lease.workItemId} = ${workItem.id}
                and ${lease.endedAt} is null
            )`,
          ),
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
      const [currentLease] = await transaction
        .select({ id: lease.id })
        .from(lease)
        .where(and(eq(lease.workItemId, workItemId), isNull(lease.endedAt)))
        .limit(1);
      if (currentLease) {
        throw new WorkGraphError(
          "work_item_has_current_lease",
          `Work item ${workItemId} has a current lease.`,
        );
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

  private async lockGraphSnapshot(transaction: DbTransaction): Promise<void> {
    const locked = await transaction
      .select({ id: graphMutationLock.id })
      .from(graphMutationLock)
      .where(eq(graphMutationLock.id, GRAPH_MUTATION_LOCK_ID))
      .for("share");
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
