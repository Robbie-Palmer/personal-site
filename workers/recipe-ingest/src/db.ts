import { createDb } from "recipe-db";
import type { Env } from "./env";

export type Db = ReturnType<typeof createDb>["db"];

export async function withDb<T>(
  env: Env,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("No database connection configured");
  }
  const { db, client } = createDb(connectionString);
  try {
    return await fn(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
