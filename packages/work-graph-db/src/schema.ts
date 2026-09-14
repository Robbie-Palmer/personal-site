import { sql } from "drizzle-orm";
import {
  check,
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("work_item_hierarchy_parent_work_item_id_idx").on(
      table.parentWorkItemId,
    ),
    check(
      "work_item_hierarchy_not_self_check",
      sql`${table.childWorkItemId} <> ${table.parentWorkItemId}`,
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
