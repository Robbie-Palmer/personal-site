import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const { client } = createDb(databaseURL);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(
  __dirname,
  "..",
  "drizzle",
  "0001_seed_diet_catalog.sql",
);
const statements = fs
  .readFileSync(seedPath, "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

try {
  for (const statement of statements) {
    await client.unsafe(statement);
  }
  console.log("Seeded diet catalog.");
} finally {
  await client.end({ timeout: 5 });
}
