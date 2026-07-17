import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Journal {
  entries: Array<{ tag: string; when: number }>;
}

const recipeApiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const drizzleRoot = path.join(recipeApiRoot, "drizzle");
const journal = JSON.parse(
  await readFile(path.join(drizzleRoot, "meta/_journal.json"), "utf8"),
) as Journal;
const latest = journal.entries.at(-1);

if (!latest) throw new Error("The Drizzle migration journal is empty");

const latestSQL = await readFile(
  path.join(drizzleRoot, `${latest.tag}.sql`),
  "utf8",
);

if (
  !latestSQL
    .toLowerCase()
    .includes("create or replace view drizzle.__schema_migration_manifest")
) {
  throw new Error(
    `${latest.tag}.sql must refresh drizzle.__schema_migration_manifest`,
  );
}

for (const entry of journal.entries) {
  const manifestRow = `('${entry.tag}'::text, ${entry.when}::bigint)`;
  if (!latestSQL.includes(manifestRow)) {
    throw new Error(
      `${latest.tag}.sql migration manifest is missing ${entry.tag}`,
    );
  }
}

console.log(
  `Migration manifest covers ${journal.entries.length} journal entries.`,
);
