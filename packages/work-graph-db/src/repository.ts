import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import {
  createWorkGraph,
  projectWorkItemStage,
  WorkGraphError,
  type NewWorkItemInput,
  type TerminalWorkItemState,
  type WorkGraph,
  type WorkItem,
  type WorkItemDependency,
  type WorkStage,
} from "work-graph-domain";
import type { Db, DbTransaction } from "./connection";
import { claimableWorkItemWhere } from "./queries/claimable-work-item";
import {
  graphCycleQuery,
  type GraphCycleRow,
} from "./queries/graph-cycle";
import {
  attentionRequest,
  attentionResolution,
  graphMutationLock,
  idempotencyKey,
  lease,
  note,
  workItem,
  workItemDependency,
  workItemHierarchy,
} from "./schema";

const GRAPH_MUTATION_LOCK_ID = "global";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoredLease = typeof lease.$inferSelect;
export type StoredNote = typeof note.$inferSelect;
export type StoredAttentionRequest = typeof attentionRequest.$inferSelect;
export type StoredAttentionResolution =
  typeof attentionResolution.$inferSelect;

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
  readonly workItemId: string;
  readonly outcome: TerminalWorkItemState;
}

export interface CreateNoteInput {
  readonly id: string;
  readonly workItemId: string;
  readonly leaseId: string;
  readonly epoch: number;
  readonly content: string;
}

export interface CreateAttentionRequestInput {
  readonly id: string;
  readonly workItemId: string;
  readonly leaseId: string;
  readonly epoch: number;
  readonly kind: string;
  readonly question: string;
  readonly note?: string;
  readonly blocking: boolean;
}

export interface CreateAttentionRequestResult {
  readonly attentionRequest: StoredAttentionRequest;
  readonly endedLease: StoredLease | null;
}

export interface ResolveAttentionRequestInput {
  readonly id: string;
  readonly attentionRequestId: string;
  readonly resolution: string;
}

export interface ResolveAttentionRequestResult {
  readonly resolution: StoredAttentionResolution;
  readonly workItemId: string;
}

export interface AttentionRequestReadModel extends StoredAttentionRequest {
  readonly resolution: StoredAttentionResolution | null;
}

export interface WorkItemReadModel extends WorkItem {
  readonly stage: WorkStage;
  readonly currentLease: StoredLease | null;
}

export interface IdempotentMutationOptions {
  readonly idempotencyKey?: string;
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

const requireIdempotencyKey = (key: string): void => {
  if (typeof key !== "string" || !UUID_PATTERN.test(key)) {
    throw new WorkGraphError(
      "invalid_idempotency_key",
      "An idempotency key must be a UUID.",
    );
  }
};

const requireUuid = (
  value: string,
  code:
    | "invalid_attention_request_id"
    | "invalid_attention_resolution_id"
    | "invalid_note_id",
  message: string,
): void => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new WorkGraphError(code, message);
  }
};

const requireText = (
  value: string,
  code:
    | "invalid_attention_kind"
    | "invalid_attention_question"
    | "invalid_attention_resolution"
    | "invalid_note_content",
  message: string,
): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkGraphError(code, message);
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
      (transaction) => this.loadGraph(transaction),
      {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      },
    );
  }

  async listWorkItems(): Promise<readonly WorkItemReadModel[]> {
    return this.db.transaction(
      async (transaction) => {
        const graph = await this.loadGraph(transaction);
        const currentLeases = await transaction
          .select()
          .from(lease)
          .where(isNull(lease.endedAt));
        const unresolvedBlockingAttention = await transaction
          .select({ workItemId: attentionRequest.workItemId })
          .from(attentionRequest)
          .leftJoin(
            attentionResolution,
            eq(
              attentionResolution.attentionRequestId,
              attentionRequest.id,
            ),
          )
          .where(
            and(
              eq(attentionRequest.blocking, true),
              isNull(attentionResolution.id),
            ),
          );
        const now = await readDatabaseClock(transaction);
        const leasesByWorkItemId = new Map(
          currentLeases.map((storedLease) => [
            storedLease.workItemId,
            storedLease,
          ]),
        );
        const workItemIdsNeedingAttention = new Set(
          unresolvedBlockingAttention.map(({ workItemId }) => workItemId),
        );

        return graph.workItems.map((item) => {
          const currentLease = leasesByWorkItemId.get(item.id) ?? null;
          return {
            ...item,
            stage: projectWorkItemStage(graph, item.id, {
              currentLease: currentLease
                ? { expiresAt: currentLease.expiresAt.getTime() }
                : null,
              now: now.getTime(),
              hasUnresolvedBlockingAttention:
                workItemIdsNeedingAttention.has(item.id),
            }),
            currentLease,
          };
        });
      },
      {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      },
    );
  }

  async getWorkItem(workItemId: string): Promise<WorkItemReadModel> {
    requireIdentifier(workItemId, "invalid_work_item_id");
    const found = (await this.listWorkItems()).find(
      (item) => item.id === workItemId,
    );
    if (!found) throw workItemNotFound(workItemId);
    return found;
  }

  async createWorkItem(
    input: NewWorkItemInput,
    options: IdempotentMutationOptions = {},
  ): Promise<WorkItem> {
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
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    try {
      return await this.db.transaction(async (transaction) => {
        if (options.idempotencyKey !== undefined) {
          const replayed = await this.beginIdempotentMutation(
            transaction,
            options.idempotencyKey,
            "create-work-item",
            JSON.stringify([normalized.id, normalized.title, parentId]),
          );
          if (replayed) return { ...normalized, parentId };
        }

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

        return { ...normalized, parentId };
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
      return translateForeignKeyError(error, parentId ?? normalized.id);
    }
  }

  async createNote(
    input: CreateNoteInput,
    options: IdempotentMutationOptions = {},
  ): Promise<StoredNote> {
    requireUuid(input.id, "invalid_note_id", "A note ID must be a UUID.");
    requireIdentifier(input.workItemId, "invalid_work_item_id");
    requireLeaseId(input.leaseId);
    requireLeaseEpoch(input.epoch);
    requireText(
      input.content,
      "invalid_note_content",
      "A note cannot be empty.",
    );
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    try {
      return await this.db.transaction(async (transaction) => {
        if (options.idempotencyKey !== undefined) {
          const replayed = await this.beginIdempotentMutation(
            transaction,
            options.idempotencyKey,
            "create-note",
            JSON.stringify([
              input.id,
              input.workItemId,
              input.leaseId,
              input.epoch,
              input.content,
            ]),
          );
          if (replayed) {
            return this.requireStoredNote(transaction, input.id);
          }
        }

        await this.lockWorkItemAndRequireLease(transaction, input);
        const [created] = await transaction
          .insert(note)
          .values({
            id: input.id,
            workItemId: input.workItemId,
            leaseId: input.leaseId,
            content: input.content,
          })
          .returning();
        if (!created) throw new Error("Note creation returned no note.");
        return created;
      });
    } catch (error) {
      if (getDatabaseError(error)?.code === "23505") {
        throw new WorkGraphError(
          "duplicate_note",
          `Note ${input.id} already exists.`,
        );
      }
      throw error;
    }
  }

  async listNotes(workItemId: string): Promise<readonly StoredNote[]> {
    requireIdentifier(workItemId, "invalid_work_item_id");
    return this.db
      .select()
      .from(note)
      .where(eq(note.workItemId, workItemId))
      .orderBy(note.createdAt, note.id);
  }

  async listAttentionRequests(): Promise<
    readonly AttentionRequestReadModel[]
  > {
    const rows = await this.db
      .select({
        attentionRequest,
        resolution: attentionResolution,
      })
      .from(attentionRequest)
      .leftJoin(
        attentionResolution,
        eq(attentionResolution.attentionRequestId, attentionRequest.id),
      )
      .orderBy(attentionRequest.id);
    return rows.map((row) => ({
      ...row.attentionRequest,
      resolution: row.resolution,
    }));
  }

  async createAttentionRequest(
    input: CreateAttentionRequestInput,
    options: IdempotentMutationOptions = {},
  ): Promise<CreateAttentionRequestResult> {
    requireUuid(
      input.id,
      "invalid_attention_request_id",
      "An attention request ID must be a UUID.",
    );
    requireIdentifier(input.workItemId, "invalid_work_item_id");
    requireLeaseId(input.leaseId);
    requireLeaseEpoch(input.epoch);
    requireText(
      input.kind,
      "invalid_attention_kind",
      "An attention kind cannot be empty.",
    );
    requireText(
      input.question,
      "invalid_attention_question",
      "An attention question cannot be empty.",
    );
    if (input.note !== undefined) {
      requireText(
        input.note,
        "invalid_note_content",
        "An attention note cannot be empty.",
      );
    }
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    try {
      return await this.db.transaction(async (transaction) => {
        if (options.idempotencyKey !== undefined) {
          const replayed = await this.beginIdempotentMutation(
            transaction,
            options.idempotencyKey,
            "create-attention-request",
            JSON.stringify([
              input.id,
              input.workItemId,
              input.leaseId,
              input.epoch,
              input.kind,
              input.question,
              input.note ?? null,
              input.blocking,
            ]),
          );
          if (replayed) {
            const storedRequest = await this.requireStoredAttentionRequest(
              transaction,
              input.id,
            );
            return {
              attentionRequest: storedRequest,
              endedLease: storedRequest.blocking
                ? await this.requireStoredLease(transaction, input.leaseId)
                : null,
            };
          }
        }

        const { storedLease, now } =
          await this.lockWorkItemAndRequireLease(transaction, input);
        const [created] = await transaction
          .insert(attentionRequest)
          .values({
            id: input.id,
            workItemId: input.workItemId,
            requestingLeaseId: input.leaseId,
            kind: input.kind,
            question: input.question,
            note: input.note ?? null,
            blocking: input.blocking,
          })
          .returning();
        if (!created) {
          throw new Error("Attention request creation returned no request.");
        }

        if (!input.blocking) {
          return { attentionRequest: created, endedLease: null };
        }
        const [endedLease] = await transaction
          .update(lease)
          .set({ endedAt: now, outcome: "attention_requested" })
          .where(
            and(
              eq(lease.id, storedLease.id),
              eq(lease.epoch, input.epoch),
              isNull(lease.endedAt),
              gt(lease.expiresAt, now),
            ),
          )
          .returning();
        if (!endedLease) throw leaseNotCurrent(input.leaseId, input.epoch);
        return { attentionRequest: created, endedLease };
      });
    } catch (error) {
      if (getDatabaseError(error)?.code === "23505") {
        throw new WorkGraphError(
          "duplicate_attention_request",
          `Attention request ${input.id} already exists.`,
        );
      }
      throw error;
    }
  }

  async resolveAttentionRequest(
    input: ResolveAttentionRequestInput,
    options: IdempotentMutationOptions = {},
  ): Promise<ResolveAttentionRequestResult> {
    requireUuid(
      input.id,
      "invalid_attention_resolution_id",
      "An attention resolution ID must be a UUID.",
    );
    requireUuid(
      input.attentionRequestId,
      "invalid_attention_request_id",
      "An attention request ID must be a UUID.",
    );
    requireText(
      input.resolution,
      "invalid_attention_resolution",
      "An attention resolution cannot be empty.",
    );
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    try {
      return await this.db.transaction(async (transaction) => {
        if (options.idempotencyKey !== undefined) {
          const replayed = await this.beginIdempotentMutation(
            transaction,
            options.idempotencyKey,
            "resolve-attention-request",
            JSON.stringify([
              input.id,
              input.attentionRequestId,
              input.resolution,
            ]),
          );
          if (replayed) {
            const resolution = await this.requireStoredAttentionResolution(
              transaction,
              input.id,
            );
            const request = await this.requireStoredAttentionRequest(
              transaction,
              input.attentionRequestId,
            );
            return { resolution, workItemId: request.workItemId };
          }
        }

        const [lockedRequest] = await transaction
          .select({
            id: attentionRequest.id,
            workItemId: attentionRequest.workItemId,
          })
          .from(attentionRequest)
          .where(eq(attentionRequest.id, input.attentionRequestId))
          .for("update");
        if (!lockedRequest) {
          throw new WorkGraphError(
            "attention_request_not_found",
            `Attention request ${input.attentionRequestId} does not exist.`,
          );
        }
        const [created] = await transaction
          .insert(attentionResolution)
          .values(input)
          .returning();
        if (!created) {
          throw new Error("Attention resolution creation returned no row.");
        }
        return { resolution: created, workItemId: lockedRequest.workItemId };
      });
    } catch (error) {
      const databaseError = getDatabaseError(error);
      if (
        databaseError?.code === "23505" &&
        databaseError.constraint_name === "attention_resolutions_pkey"
      ) {
        throw new WorkGraphError(
          "duplicate_attention_resolution",
          `Attention resolution ${input.id} already exists.`,
        );
      }
      if (databaseError?.code === "23505") {
        throw new WorkGraphError(
          "attention_request_already_resolved",
          `Attention request ${input.attentionRequestId} is already resolved.`,
        );
      }
      throw error;
    }
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
            if (!candidate) {
              if (input.workItemId !== undefined) {
                const [existing] = await transaction
                  .select({ id: workItem.id })
                  .from(workItem)
                  .where(eq(workItem.id, input.workItemId))
                  .limit(1);
                if (!existing) throw workItemNotFound(input.workItemId);
              }
              return null;
            }

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
    requireIdentifier(input.workItemId, "invalid_work_item_id");

    return this.db.transaction(async (transaction) => {
      const [lockedWorkItem] = await transaction
        .select({ id: workItem.id })
        .from(workItem)
        .where(eq(workItem.id, input.workItemId))
        .for("update");
      if (!lockedWorkItem) throw workItemNotFound(input.workItemId);

      const completedAt = await readDatabaseClock(transaction);

      const [completedLease] = await transaction
        .update(lease)
        .set({ endedAt: completedAt, outcome: input.outcome })
        .where(
          and(
            eq(lease.id, input.leaseId),
            eq(lease.workItemId, input.workItemId),
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
            eq(workItem.id, input.workItemId),
            eq(workItem.lifecycle, "open"),
          ),
        )
        .returning({ id: workItem.id });
      if (updated.length === 0) {
        const [existing] = await transaction
          .select({ lifecycle: workItem.lifecycle })
          .from(workItem)
          .where(eq(workItem.id, input.workItemId))
          .limit(1);
        throw new WorkGraphError(
          "work_item_already_terminal",
          `Work item ${input.workItemId} is already ${existing?.lifecycle ?? "terminal"}.`,
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

  async addDependency(
    dependency: WorkItemDependency,
    options: IdempotentMutationOptions = {},
  ): Promise<void> {
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    try {
      await this.db.transaction(async (transaction) => {
        if (options.idempotencyKey !== undefined) {
          const replayed = await this.beginIdempotentMutation(
            transaction,
            options.idempotencyKey,
            "add-dependency",
            JSON.stringify([
              dependency.dependentWorkItemId,
              dependency.blockerWorkItemId,
            ]),
          );
          if (replayed) return;
        }

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

  async removeDependency(
    dependency: WorkItemDependency,
    options: IdempotentMutationOptions = {},
  ): Promise<void> {
    if (options.idempotencyKey !== undefined) {
      requireIdempotencyKey(options.idempotencyKey);
    }

    await this.db.transaction(async (transaction) => {
      if (options.idempotencyKey !== undefined) {
        const replayed = await this.beginIdempotentMutation(
          transaction,
          options.idempotencyKey,
          "remove-dependency",
          JSON.stringify([
            dependency.dependentWorkItemId,
            dependency.blockerWorkItemId,
          ]),
        );
        if (replayed) return;
      }

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
      const [existing] = await transaction
        .select({ lifecycle: workItem.lifecycle })
        .from(workItem)
        .where(eq(workItem.id, workItemId))
        .limit(1)
        .for("update");
      if (!existing) {
        throw workItemNotFound(workItemId);
      }

      const terminatedAt = await readDatabaseClock(transaction);
      await transaction
        .update(lease)
        .set({ endedAt: terminatedAt, outcome: "expired" })
        .where(
          and(
            eq(lease.workItemId, workItemId),
            isNull(lease.endedAt),
            lte(lease.expiresAt, terminatedAt),
          ),
        );

      // Claims serialize on the same row. Check for a lease in a fresh
      // READ COMMITTED statement after acquiring the lock.
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
      if (existing.lifecycle !== "open") {
        throw new WorkGraphError(
          "work_item_already_terminal",
          `Work item ${workItemId} is already ${existing.lifecycle}.`,
        );
      }

      await transaction
        .update(workItem)
        .set({ lifecycle })
        .where(eq(workItem.id, workItemId));
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

  private async lockWorkItemAndRequireLease(
    transaction: DbTransaction,
    input: {
      readonly workItemId: string;
      readonly leaseId: string;
      readonly epoch: number;
    },
  ): Promise<{ storedLease: StoredLease; now: Date }> {
    const [lockedWorkItem] = await transaction
      .select({ id: workItem.id })
      .from(workItem)
      .where(eq(workItem.id, input.workItemId))
      .for("update");
    if (!lockedWorkItem) throw workItemNotFound(input.workItemId);

    const now = await readDatabaseClock(transaction);
    const [storedLease] = await transaction
      .select()
      .from(lease)
      .where(
        and(
          eq(lease.id, input.leaseId),
          eq(lease.workItemId, input.workItemId),
          eq(lease.epoch, input.epoch),
          isNull(lease.endedAt),
          gt(lease.expiresAt, now),
        ),
      )
      .limit(1);
    if (!storedLease) throw leaseNotCurrent(input.leaseId, input.epoch);
    return { storedLease, now };
  }

  private async requireStoredNote(
    transaction: DbTransaction,
    noteId: string,
  ): Promise<StoredNote> {
    const [stored] = await transaction
      .select()
      .from(note)
      .where(eq(note.id, noteId))
      .limit(1);
    if (!stored) throw new Error(`Idempotent note ${noteId} is missing.`);
    return stored;
  }

  private async requireStoredAttentionRequest(
    transaction: DbTransaction,
    attentionRequestId: string,
  ): Promise<StoredAttentionRequest> {
    const [stored] = await transaction
      .select()
      .from(attentionRequest)
      .where(eq(attentionRequest.id, attentionRequestId))
      .limit(1);
    if (!stored) {
      throw new Error(
        `Idempotent attention request ${attentionRequestId} is missing.`,
      );
    }
    return stored;
  }

  private async requireStoredAttentionResolution(
    transaction: DbTransaction,
    attentionResolutionId: string,
  ): Promise<StoredAttentionResolution> {
    const [stored] = await transaction
      .select()
      .from(attentionResolution)
      .where(eq(attentionResolution.id, attentionResolutionId))
      .limit(1);
    if (!stored) {
      throw new Error(
        `Idempotent attention resolution ${attentionResolutionId} is missing.`,
      );
    }
    return stored;
  }

  private async requireStoredLease(
    transaction: DbTransaction,
    leaseId: string,
  ): Promise<StoredLease> {
    const [stored] = await transaction
      .select()
      .from(lease)
      .where(eq(lease.id, leaseId))
      .limit(1);
    if (!stored) throw new Error(`Idempotent lease ${leaseId} is missing.`);
    return stored;
  }

  private async beginIdempotentMutation(
    transaction: DbTransaction,
    key: string,
    operation: string,
    requestFingerprint: string,
  ): Promise<boolean> {
    const inserted = await transaction
      .insert(idempotencyKey)
      .values({ id: key, operation, requestFingerprint })
      .onConflictDoNothing()
      .returning({ id: idempotencyKey.id });
    if (inserted.length === 1) return false;

    const [receipt] = await transaction
      .select({
        operation: idempotencyKey.operation,
        requestFingerprint: idempotencyKey.requestFingerprint,
      })
      .from(idempotencyKey)
      .where(eq(idempotencyKey.id, key))
      .limit(1);
    if (
      receipt?.operation === operation &&
      receipt.requestFingerprint === requestFingerprint
    ) {
      return true;
    }

    throw new WorkGraphError(
      "idempotency_key_reused",
      `Idempotency key ${key} was already used for a different mutation.`,
    );
  }

  private async loadGraph(transaction: DbTransaction): Promise<WorkGraph> {
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
