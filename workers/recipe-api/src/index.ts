import { Hono } from "hono";
import { createDb, schema } from "./db";

type Bindings = {
  // In production, HYPERDRIVE is the Cloudflare Hyperdrive binding (connection pooling).
  // For local dev, set DATABASE_URL in .dev.vars instead.
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/recipes", async (c) => {
  const connectionString =
    c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!connectionString) {
    return c.json({ error: "DATABASE_URL is not configured" }, 503);
  }
  try {
    const db = createDb(connectionString);
    const recipes = await db.select().from(schema.recipe);
    return c.json(recipes);
  } catch (e) {
    return c.json(
      { error: "Database query failed", message: String(e) },
      502,
    );
  }
});

export default app;
