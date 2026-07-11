import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "recipe-db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const { client } = createDb(databaseURL);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "seed-diet-catalog.sql");
const statement = await readFile(seedPath, "utf8");

try {
  await client.unsafe(statement);
  console.log("Seeded diet catalog.");
} finally {
  await client.end({ timeout: 5 });
}
