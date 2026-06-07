import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export { schema };

export function createDb(connectionString: string) {
  // prepare: false required for Hyperdrive — it may route requests to different
  // backend servers, so named prepared statements won't be available across connections.
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, client };
}
