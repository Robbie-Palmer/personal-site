import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { WORK_ITEM_LIFECYCLES } from "work-graph-domain";

export const workItemLifecycleEnum = pgEnum(
  "work_item_lifecycle",
  WORK_ITEM_LIFECYCLES,
);

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
