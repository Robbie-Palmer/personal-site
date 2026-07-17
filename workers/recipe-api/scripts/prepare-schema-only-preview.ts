import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

interface JournalEntry {
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const baseRef = requiredEnv("MIGRATIONS_BASE_REF");

if (process.env.ALLOW_SCHEMA_ONLY_PREVIEW_HISTORY !== "1") {
  throw new Error(
    "ALLOW_SCHEMA_ONLY_PREVIEW_HISTORY=1 is required because this command writes migration history",
  );
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const journalPath = "workers/recipe-api/drizzle/meta/_journal.json";

try {
  execFileSync("git", ["cat-file", "-e", `${baseRef}^{commit}`], {
    cwd: repoRoot,
    stdio: "ignore",
  });
} catch {
  throw new Error(`MIGRATIONS_BASE_REF is not an available commit: ${baseRef}`);
}

function readFromGit(ref: string, filePath: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${ref}:${filePath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return undefined;
  }
}

const journalSource = readFromGit(baseRef, journalPath);
const journal: Journal = journalSource
  ? (JSON.parse(journalSource) as Journal)
  : { entries: [] };

const migrations = journal.entries.map((entry) => {
  const sqlPath = `workers/recipe-api/drizzle/${entry.tag}.sql`;
  const sql = readFromGit(baseRef, sqlPath);
  if (sql === undefined) {
    throw new Error(`Migration ${sqlPath} is missing at ${baseRef}`);
  }

  return {
    createdAt: entry.when,
    hash: createHash("sha256").update(sql).digest("hex"),
  };
});

const client = postgres(databaseURL, { max: 1 });

try {
  await client.begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext('recipe-site:preview-migration-history'))`;
    await sql.unsafe("create schema if not exists drizzle");
    await sql.unsafe(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    const [history] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from drizzle.__drizzle_migrations
    `;

    if (!history) throw new Error("Could not read Drizzle migration history");

    // A reused preview already has an accurate history. Marking a newer base
    // as applied would skip migrations that its older schema still needs.
    if (history.count > 0) {
      console.log(
        `Preview migration history already contains ${history.count} entries; leaving it unchanged.`,
      );
      return;
    }

    for (const migration of migrations) {
      await sql`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migration.hash}, ${migration.createdAt})
      `;
    }

    console.log(
      `Restored ${migrations.length} migration history entries from ${baseRef}.`,
    );
  });
} finally {
  await client.end({ timeout: 5 });
}
