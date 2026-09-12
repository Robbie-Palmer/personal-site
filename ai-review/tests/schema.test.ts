import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  LATEST_SCHEMA_VERSION,
  runMigrations,
  SCHEMA_MIGRATION_HISTORY,
} from "../src/schema";

type SqlStorage = DurableObjectStorage["sql"];

function sqliteStorage(
  database: DatabaseSync,
  ignoredStatement?: string,
): SqlStorage {
  return {
    exec(query: string, ...bindings: unknown[]) {
      if (ignoredStatement !== undefined && query.includes(ignoredStatement)) {
        return { toArray: () => [] };
      }

      const returnsRows = /^(PRAGMA|SELECT)\b/i.test(query.trimStart());
      if (returnsRows) {
        const rows = database
          .prepare(query)
          .all(...(bindings as SQLInputValue[]));
        return { toArray: () => rows };
      }

      if (bindings.length > 0) {
        database.prepare(query).run(...(bindings as SQLInputValue[]));
      } else {
        database.exec(query);
      }
      return { toArray: () => [] };
    },
  } as unknown as SqlStorage;
}

function withDatabase(test: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(":memory:");
  try {
    test(database);
  } finally {
    database.close();
  }
}

function migrationHistory(database: DatabaseSync): unknown[] {
  return database
    .prepare("SELECT version, name FROM _migrations ORDER BY version")
    .all();
}

describe("runMigrations", () => {
  it("creates the current schema and stays idempotent", () => {
    withDatabase((database) => {
      const sql = sqliteStorage(database);

      runMigrations(sql);
      runMigrations(sql);

      expect(migrationHistory(database)).toEqual(SCHEMA_MIGRATION_HISTORY);
      const reviewRunColumns = database
        .prepare("PRAGMA table_info(review_runs)")
        .all()
        .map((row) => row.name);
      expect(reviewRunColumns).toEqual(
        expect.arrayContaining([
          "completion_hash",
          "finding_resolutions_json",
        ]),
      );
      const outcomeColumns = database
        .prepare("PRAGMA table_info(review_finding_outcomes)")
        .all()
        .map((row) => row.name);
      expect(outcomeColumns).toEqual(
        expect.arrayContaining([
          "confidence",
          "evaluator_version",
          "manual_override",
        ]),
      );
    });
  });

  it("adopts an existing current schema without replaying alterations", () => {
    withDatabase((database) => {
      const sql = sqliteStorage(database);
      runMigrations(sql);
      database.exec("DELETE FROM _migrations");

      runMigrations(sql);

      expect(migrationHistory(database)).toEqual(SCHEMA_MIGRATION_HISTORY);
    });
  });

  it("rejects migration histories from newer code", () => {
    withDatabase((database) => {
      const sql = sqliteStorage(database);
      runMigrations(sql);
      database
        .prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)")
        .run(LATEST_SCHEMA_VERSION + 1, "future-migration");

      expect(() => runMigrations(sql)).toThrow(
        `newer than supported version ${LATEST_SCHEMA_VERSION}`,
      );
    });
  });

  it("rejects renamed migration history", () => {
    withDatabase((database) => {
      const sql = sqliteStorage(database);
      runMigrations(sql);
      database
        .prepare("UPDATE _migrations SET name = ? WHERE version = 1")
        .run("renamed-migration");

      expect(() => runMigrations(sql)).toThrow(
        "was recorded as renamed-migration, expected webhook-deliveries",
      );
    });
  });

  it("fails when migration SQL does not produce the declared schema", () => {
    withDatabase((database) => {
      const sql = sqliteStorage(database, "ADD COLUMN completion_hash");

      expect(() => runMigrations(sql)).toThrow(
        "review-run-completion-hash) did not produce its expected schema",
      );
    });
  });
});
