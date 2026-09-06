import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export { schema };

export type DbClient = postgres.Sql;
export type Db = PostgresJsDatabase<typeof schema> & { $client: DbClient };

export type DatabaseConnectionEnv = {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
};

export function databaseConnection(
  env: DatabaseConnectionEnv,
): string | undefined {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
}

export function createDb(connectionString: string): { db: Db; client: DbClient } {
  // prepare: false required for Hyperdrive — it may route requests to different
  // backend servers, so named prepared statements won't be available across connections.
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, client };
}

export async function closeDbClient(client: DbClient | undefined): Promise<void> {
  if (!client) return;
  try {
    await client.end({ timeout: 5 });
  } catch (error) {
    console.error("client.end() cleanup failed", error);
  }
}

export async function withDb<T>(
  env: DatabaseConnectionEnv,
  operation: (db: Db) => Promise<T>,
): Promise<T> {
  const connectionString = databaseConnection(env);
  if (!connectionString) {
    throw new Error("No database connection configured");
  }
  const { db, client } = createDb(connectionString);
  try {
    return await operation(db);
  } finally {
    await closeDbClient(client);
  }
}
