type SqlStorage = DurableObjectStorage["sql"];

type SchemaRequirement =
  | { kind: "table"; name: string }
  | { kind: "column"; table: string; name: string };

interface SchemaMigration {
  version: number;
  name: string;
  up: readonly string[];
  requires: readonly SchemaRequirement[];
}

const migrations = [
  {
    version: 1,
    name: "webhook-deliveries",
    up: [
      `CREATE TABLE IF NOT EXISTS webhook_deliveries (
        delivery_id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        action TEXT NOT NULL,
        repository TEXT NOT NULL,
        pull_request_number INTEGER NOT NULL,
        head_sha TEXT,
        received_at TEXT NOT NULL
      )`,
    ],
    requires: [{ kind: "table", name: "webhook_deliveries" }],
  },
  {
    version: 2,
    name: "review-runs",
    up: [
      `CREATE TABLE IF NOT EXISTS review_runs (
        run_id TEXT PRIMARY KEY,
        head_sha TEXT NOT NULL,
        diff_fingerprint TEXT NOT NULL,
        config_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL,
        force_run INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        cost_usd REAL NOT NULL DEFAULT 0,
        comment_id INTEGER,
        findings_json TEXT,
        error TEXT
      )`,
    ],
    requires: [{ kind: "table", name: "review_runs" }],
  },
  {
    version: 3,
    name: "review-run-completion-hash",
    up: ["ALTER TABLE review_runs ADD COLUMN completion_hash TEXT"],
    requires: [
      { kind: "column", table: "review_runs", name: "completion_hash" },
    ],
  },
  {
    version: 4,
    name: "review-identities",
    up: [
      `CREATE TABLE IF NOT EXISTS review_hunks (
        hunk_id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        file_path TEXT NOT NULL,
        first_seen_head_sha TEXT NOT NULL,
        last_seen_head_sha TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS review_findings (
        finding_id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        first_seen_head_sha TEXT NOT NULL,
        last_seen_head_sha TEXT NOT NULL,
        first_seen_run_id TEXT NOT NULL,
        last_seen_run_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS review_finding_hunks (
        finding_id TEXT NOT NULL,
        hunk_id TEXT NOT NULL,
        PRIMARY KEY (finding_id, hunk_id)
      )`,
    ],
    requires: [
      { kind: "table", name: "review_hunks" },
      { kind: "table", name: "review_findings" },
      { kind: "table", name: "review_finding_hunks" },
    ],
  },
  {
    version: 5,
    name: "finding-disposition",
    up: ["ALTER TABLE review_findings ADD COLUMN disposition TEXT"],
    requires: [
      { kind: "column", table: "review_findings", name: "disposition" },
    ],
  },
  {
    version: 6,
    name: "finding-disposition-reason",
    up: ["ALTER TABLE review_findings ADD COLUMN disposition_reason TEXT"],
    requires: [
      {
        kind: "column",
        table: "review_findings",
        name: "disposition_reason",
      },
    ],
  },
  {
    version: 7,
    name: "finding-feedback",
    up: [
      `CREATE TABLE IF NOT EXISTS review_finding_comments (
        comment_id INTEGER PRIMARY KEY,
        finding_id TEXT NOT NULL UNIQUE,
        head_sha TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS review_finding_events (
        delivery_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        evidence_version INTEGER NOT NULL,
        finding_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        r2_recorded INTEGER NOT NULL DEFAULT 0
      )`,
    ],
    requires: [
      { kind: "table", name: "review_finding_comments" },
      { kind: "table", name: "review_finding_events" },
    ],
  },
  {
    version: 8,
    name: "review-run-hunks",
    up: [
      `CREATE TABLE IF NOT EXISTS review_run_hunks (
        run_id TEXT NOT NULL,
        hunk_id TEXT NOT NULL,
        reviewed INTEGER NOT NULL,
        PRIMARY KEY (run_id, hunk_id)
      )`,
    ],
    requires: [{ kind: "table", name: "review_run_hunks" }],
  },
  {
    version: 9,
    name: "finding-resolutions",
    up: ["ALTER TABLE review_runs ADD COLUMN finding_resolutions_json TEXT"],
    requires: [
      {
        kind: "column",
        table: "review_runs",
        name: "finding_resolutions_json",
      },
    ],
  },
  {
    version: 10,
    name: "finding-outcomes",
    up: [
      `CREATE TABLE IF NOT EXISTS review_finding_outcomes (
        finding_id TEXT NOT NULL,
        outcome_version INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        basis TEXT NOT NULL,
        source_id TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        r2_recorded INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (finding_id, outcome_version)
      )`,
    ],
    requires: [{ kind: "table", name: "review_finding_outcomes" }],
  },
  {
    version: 11,
    name: "finding-outcome-confidence",
    up: [
      "ALTER TABLE review_finding_outcomes ADD COLUMN confidence REAL NOT NULL DEFAULT 1",
    ],
    requires: [
      {
        kind: "column",
        table: "review_finding_outcomes",
        name: "confidence",
      },
    ],
  },
  {
    version: 12,
    name: "finding-outcome-evaluator",
    up: [
      `ALTER TABLE review_finding_outcomes
       ADD COLUMN evaluator_version TEXT NOT NULL DEFAULT 'legacy-v1'`,
    ],
    requires: [
      {
        kind: "column",
        table: "review_finding_outcomes",
        name: "evaluator_version",
      },
    ],
  },
  {
    version: 13,
    name: "finding-outcome-manual-override",
    up: [
      "ALTER TABLE review_finding_outcomes ADD COLUMN manual_override INTEGER NOT NULL DEFAULT 0",
    ],
    requires: [
      {
        kind: "column",
        table: "review_finding_outcomes",
        name: "manual_override",
      },
    ],
  },
  {
    version: 14,
    name: "finding-evaluations",
    up: [
      `CREATE TABLE IF NOT EXISTS review_finding_evaluations (
        evaluation_id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        evaluator_version TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        evaluated_at TEXT NOT NULL
      )`,
    ],
    requires: [{ kind: "table", name: "review_finding_evaluations" }],
  },
  {
    version: 15,
    name: "model-health",
    up: [
      `CREATE TABLE IF NOT EXISTS review_model_health (
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        total_failures INTEGER NOT NULL DEFAULT 0,
        total_successes INTEGER NOT NULL DEFAULT 0,
        cooldown_until_ms INTEGER,
        last_error TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider, model)
      )`,
      `CREATE TABLE IF NOT EXISTS review_model_health_observations (
        observation_id TEXT NOT NULL,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        ok INTEGER NOT NULL,
        error TEXT,
        observed_at TEXT NOT NULL,
        PRIMARY KEY (observation_id, provider, model)
      )`,
    ],
    requires: [
      { kind: "table", name: "review_model_health" },
      { kind: "table", name: "review_model_health_observations" },
    ],
  },
] as const satisfies readonly SchemaMigration[];

export const SCHEMA_MIGRATION_HISTORY: readonly {
  version: number;
  name: string;
}[] = migrations.map(
  ({ version, name }) => ({ version, name }),
);
export const LATEST_SCHEMA_VERSION = migrations.length;

function tableExists(sql: SqlStorage, table: string): boolean {
  return (
    sql
      .exec<{ present: number }>(
        "SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ? LIMIT 1",
        table,
      )
      .toArray().length > 0
  );
}

function columnExists(
  sql: SqlStorage,
  table: string,
  column: string,
): boolean {
  return sql
    .exec<{ name: string }>(`PRAGMA table_info(${table})`)
    .toArray()
    .some(({ name }) => name === column);
}

function requirementMet(
  sql: SqlStorage,
  requirement: SchemaRequirement,
): boolean {
  if (requirement.kind === "table") {
    return tableExists(sql, requirement.name);
  }
  return columnExists(sql, requirement.table, requirement.name);
}

function migrationApplied(sql: SqlStorage, migration: SchemaMigration): boolean {
  return migration.requires.every(
    (requirement) => requirementMet(sql, requirement),
  );
}

function assertSupportedHistory(recorded: ReadonlyMap<number, string>): void {
  const newestRecordedVersion = Math.max(0, ...recorded.keys());
  if (newestRecordedVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${newestRecordedVersion} is newer than ` +
      `supported version ${LATEST_SCHEMA_VERSION}`,
    );
  }
}

function assertMigrationOrder(): void {
  for (const [index, migration] of migrations.entries()) {
    if (migration.version !== index + 1) {
      throw new Error(
        `Schema migration versions must be contiguous at ${migration.name}`,
      );
    }
  }
}

function assertRecordedName(
  migration: SchemaMigration,
  recordedName: string,
): void {
  if (recordedName !== migration.name) {
    throw new Error(
      `Schema migration ${migration.version} was recorded as ` +
        `${recordedName}, expected ${migration.name}`,
    );
  }
}

function applyUnrecordedMigration(
  sql: SqlStorage,
  migration: SchemaMigration,
): void {
  if (!migrationApplied(sql, migration)) {
    for (const statement of migration.up) sql.exec(statement);
  }
  if (!migrationApplied(sql, migration)) {
    throw new Error(
      `Schema migration ${migration.version} (${migration.name}) did not ` +
        "produce its expected schema",
    );
  }

  sql.exec(
    "INSERT INTO _migrations (version, name) VALUES (?, ?)",
    migration.version,
    migration.name,
  );
}

function applyMigration(
  sql: SqlStorage,
  migration: SchemaMigration,
  recordedName: string | undefined,
): void {
  if (recordedName !== undefined) {
    assertRecordedName(migration, recordedName);
    return;
  }
  applyUnrecordedMigration(sql, migration);
}

export function runMigrations(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const recorded = new Map(
    sql
      .exec<{ version: number; name: string }>(
        "SELECT version, name FROM _migrations ORDER BY version",
      )
      .toArray()
      .map(({ version, name }) => [Number(version), name]),
  );
  assertSupportedHistory(recorded);
  assertMigrationOrder();

  for (const migration of migrations) {
    applyMigration(sql, migration, recorded.get(migration.version));
  }
}
