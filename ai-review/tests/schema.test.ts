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
  failedStatement?: string,
): Pick<DurableObjectStorage, "sql" | "transactionSync"> {
  const sql = {
    exec(query: string, ...bindings: unknown[]) {
      if (ignoredStatement !== undefined && query.includes(ignoredStatement)) {
        return { toArray: () => [] };
      }
      if (failedStatement !== undefined && query.includes(failedStatement)) {
        throw new Error("injected migration failure");
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
  return {
    sql,
    transactionSync<T>(operation: () => T): T {
      database.exec("BEGIN");
      try {
        const result = operation();
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
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
      const storage = sqliteStorage(database);

      runMigrations(storage);
      runMigrations(storage);

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
      const storage = sqliteStorage(database);
      runMigrations(storage);
      database.exec("DELETE FROM _migrations");

      runMigrations(storage);

      expect(migrationHistory(database)).toEqual(SCHEMA_MIGRATION_HISTORY);
    });
  });

  it("rejects migration histories from newer code", () => {
    withDatabase((database) => {
      const storage = sqliteStorage(database);
      runMigrations(storage);
      database
        .prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)")
        .run(LATEST_SCHEMA_VERSION + 1, "future-migration");

      expect(() => runMigrations(storage)).toThrow(
        `newer than supported version ${LATEST_SCHEMA_VERSION}`,
      );
    });
  });

  it("rejects renamed migration history", () => {
    withDatabase((database) => {
      const storage = sqliteStorage(database);
      runMigrations(storage);
      database
        .prepare("UPDATE _migrations SET name = ? WHERE version = 1")
        .run("renamed-migration");

      expect(() => runMigrations(storage)).toThrow(
        "was recorded as renamed-migration, expected webhook-deliveries",
      );
    });
  });

  it("rejects recorded migrations whose schema is missing", () => {
    withDatabase((database) => {
      const storage = sqliteStorage(database);
      runMigrations(storage);
      database.exec("DROP TABLE review_hunks");

      expect(() => runMigrations(storage)).toThrow(
        "Recorded schema migration 4 (review-identities) does not satisfy",
      );
    });
  });

  it("fails when migration SQL does not produce the declared schema", () => {
    withDatabase((database) => {
      const storage = sqliteStorage(
        database,
        "CREATE TABLE IF NOT EXISTS review_finding_hunks",
      );

      expect(() => runMigrations(storage)).toThrow(
        "review-identities) did not produce its expected schema",
      );
      expect(
        database
          .prepare(
            `SELECT name FROM sqlite_schema
             WHERE type = 'table' AND name IN ('review_hunks', 'review_findings')`,
          )
          .all(),
      ).toEqual([]);
      expect(migrationHistory(database)).toEqual(
        SCHEMA_MIGRATION_HISTORY.slice(0, 3),
      );
    });
  });

  it("rolls back a partially applied migration", () => {
    withDatabase((database) => {
      const storage = sqliteStorage(
        database,
        undefined,
        "CREATE TABLE IF NOT EXISTS review_findings",
      );

      expect(() => runMigrations(storage)).toThrow(
        "injected migration failure",
      );
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'review_hunks'",
          )
          .all(),
      ).toEqual([]);
      expect(migrationHistory(database)).toEqual(
        SCHEMA_MIGRATION_HISTORY.slice(0, 3),
      );
    });
  });
});
