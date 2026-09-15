import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { LEASE_OUTCOMES, WORK_ITEM_LIFECYCLES } from "work-graph-domain";

export const workItemLifecycleEnum = pgEnum(
  "work_item_lifecycle",
  WORK_ITEM_LIFECYCLES,
);

export const leaseOutcomeEnum = pgEnum("lease_outcome", LEASE_OUTCOMES);

export const workItem = pgTable(
  "work_items",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    lifecycle: workItemLifecycleEnum().notNull().default("open"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("work_items_id_not_blank_check", sql`btrim(${table.id}) <> ''`),
    check(
      "work_items_title_not_blank_check",
      sql`btrim(${table.title}) <> ''`,
    ),
  ],
);

export const workItemHierarchy = pgTable(
  "work_item_hierarchy",
  {
    childWorkItemId: text()
      .primaryKey()
      .references(() => workItem.id, { onDelete: "restrict" }),
    parentWorkItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    rank: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("work_item_hierarchy_parent_work_item_id_idx").on(
      table.parentWorkItemId,
    ),
    uniqueIndex("work_item_hierarchy_parent_rank_uidx")
      .on(table.parentWorkItemId, table.rank)
      .where(sql`${table.rank} is not null`),
    check(
      "work_item_hierarchy_not_self_check",
      sql`${table.childWorkItemId} <> ${table.parentWorkItemId}`,
    ),
    check(
      "work_item_hierarchy_rank_positive_check",
      sql`${table.rank} is null or ${table.rank} > 0`,
    ),
  ],
);

export const workItemDependency = pgTable(
  "work_item_dependencies",
  {
    dependentWorkItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    blockerWorkItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "work_item_dependencies_pk",
      columns: [table.dependentWorkItemId, table.blockerWorkItemId],
    }),
    index("work_item_dependencies_blocker_work_item_id_idx").on(
      table.blockerWorkItemId,
    ),
    check(
      "work_item_dependencies_not_self_check",
      sql`${table.dependentWorkItemId} <> ${table.blockerWorkItemId}`,
    ),
  ],
);

export const graphMutationLock = pgTable("graph_mutation_locks", {
  id: text().primaryKey(),
});

export const idempotencyKey = pgTable(
  "idempotency_keys",
  {
    id: uuid().primaryKey(),
    operation: text().notNull(),
    requestFingerprint: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "idempotency_keys_operation_not_blank_check",
      sql`btrim(${table.operation}) <> ''`,
    ),
    check(
      "idempotency_keys_request_fingerprint_not_blank_check",
      sql`btrim(${table.requestFingerprint}) <> ''`,
    ),
  ],
);

export const lease = pgTable(
  "leases",
  {
    id: uuid().primaryKey(),
    workItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    workerId: text().notNull(),
    epoch: integer().notNull(),
    acquiredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }),
    outcome: leaseOutcomeEnum(),
  },
  (table) => [
    uniqueIndex("leases_id_work_item_id_uidx").on(table.id, table.workItemId),
    uniqueIndex("leases_work_item_id_epoch_uidx").on(
      table.workItemId,
      table.epoch,
    ),
    uniqueIndex("leases_one_current_per_work_item_uidx")
      .on(table.workItemId)
      .where(sql`${table.endedAt} is null`),
    check(
      "leases_worker_id_not_blank_check",
      sql`btrim(${table.workerId}) <> ''`,
    ),
    check("leases_epoch_positive_check", sql`${table.epoch} > 0`),
    check(
      "leases_expiry_after_acquisition_check",
      sql`${table.expiresAt} > ${table.acquiredAt}`,
    ),
    check(
      "leases_end_and_outcome_check",
      sql`(${table.endedAt} is null) = (${table.outcome} is null)`,
    ),
    check(
      "leases_end_after_acquisition_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.acquiredAt}`,
    ),
  ],
);

export const note = pgTable(
  "notes",
  {
    id: uuid().primaryKey(),
    workItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    leaseId: uuid().notNull(),
    content: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "notes_lease_work_item_fk",
      columns: [table.leaseId, table.workItemId],
      foreignColumns: [lease.id, lease.workItemId],
    }).onDelete("restrict"),
    index("notes_work_item_id_created_at_idx").on(
      table.workItemId,
      table.createdAt,
    ),
    check("notes_content_not_blank_check", sql`btrim(${table.content}) <> ''`),
  ],
);

export const attentionRequest = pgTable(
  "attention_requests",
  {
    id: uuid().primaryKey(),
    workItemId: text()
      .notNull()
      .references(() => workItem.id, { onDelete: "restrict" }),
    requestingLeaseId: uuid().notNull(),
    kind: text().notNull(),
    question: text().notNull(),
    note: text(),
    blocking: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "attention_requests_lease_work_item_fk",
      columns: [table.requestingLeaseId, table.workItemId],
      foreignColumns: [lease.id, lease.workItemId],
    }).onDelete("restrict"),
    index("attention_requests_work_item_id_created_at_idx").on(
      table.workItemId,
      table.createdAt,
    ),
    check(
      "attention_requests_kind_not_blank_check",
      sql`btrim(${table.kind}) <> ''`,
    ),
    check(
      "attention_requests_question_not_blank_check",
      sql`btrim(${table.question}) <> ''`,
    ),
    check(
      "attention_requests_note_not_blank_check",
      sql`${table.note} is null or btrim(${table.note}) <> ''`,
    ),
  ],
);

export const attentionResolution = pgTable(
  "attention_resolutions",
  {
    id: uuid().primaryKey(),
    attentionRequestId: uuid().notNull(),
    resolution: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "attention_resolutions_request_id_fk",
      columns: [table.attentionRequestId],
      foreignColumns: [attentionRequest.id],
    }).onDelete("restrict"),
    uniqueIndex("attention_resolutions_attention_request_id_uidx").on(
      table.attentionRequestId,
    ),
    check(
      "attention_resolutions_resolution_not_blank_check",
      sql`btrim(${table.resolution}) <> ''`,
    ),
  ],
);
