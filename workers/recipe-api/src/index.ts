import { Hono, type Context } from "hono";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { createDb, schema } from "./db";
import { createAuth } from "./auth";
import { verifyCloudflareAccess } from "./cloudflare-access";
import {
  type AuthenticatedSession,
  type AuthorizationVariables,
  authorizationResponse,
  loadBetterAuthSession,
  unauthenticated,
} from "./http/authorization";
import { validateCsrf } from "./http/security";
import { parseJsonBody } from "./http/validation";
import {
  findPreviewScenario,
  previewScenarios,
} from "./preview-scenarios";

type Bindings = {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  DEPLOYMENT_ENV?: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET: string;
  PREVIEW_AUTH_PASSWORD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

type Recipe = typeof schema.recipe.$inferSelect;
type DbClient = ReturnType<typeof createDb>["client"];
type AuthSessionResult =
  | { success: true; session: AuthenticatedSession }
  | { success: false; response: Response };
type AppEnv = {
  Bindings: Bindings;
  Variables: Partial<AuthorizationVariables>;
};

const app = new Hono<AppEnv>();

const previewSignInBodySchema = z.object({
  scenario: z.string().trim().min(1),
});

const recipeSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "Slug must use lowercase letters, numbers, and single hyphens between words",
  });

const recipeVisibilitySchema = z.enum(["public", "private", "household"]);

const createRecipeBodySchema = z.object({
  slug: recipeSlugSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  visibility: recipeVisibilitySchema.default("private"),
});

const updateRecipeBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    body: z.string().trim().min(1).nullable().optional(),
    visibility: recipeVisibilitySchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one recipe field must be provided",
  });

app.get("/health", (c) => c.json({ status: "ok" }));

function isValidAuthURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function databaseConnection(env: Bindings): string | undefined {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
}

async function closeDbClient(client: DbClient | undefined) {
  if (!client) return;
  try {
    await client.end({ timeout: 5 });
  } catch (e) {
    console.error("client.end() cleanup failed", e);
  }
}

function recipeResponse(recipe: Recipe) {
  const { userId: _userId, ...response } = recipe;
  return response;
}

function invalidSlugResponse(c: Context<AppEnv>) {
  return c.json(
    {
      error: "Invalid recipe slug",
      details: [
        {
          path: ["slug"],
          message:
            "Slug must use lowercase letters, numbers, and single hyphens between words",
        },
      ],
    },
    400,
  );
}

function parseRecipeSlug(c: Context<AppEnv>) {
  const result = recipeSlugSchema.safeParse(c.req.param("slug"));
  if (!result.success) {
    return {
      success: false,
      response: invalidSlugResponse(c),
    } as const;
  }
  return { success: true, slug: result.data } as const;
}

function hasAuthConfiguration(env: Bindings): boolean {
  if (!env.BETTER_AUTH_URL || !env.BETTER_AUTH_SECRET) return false;
  if (env.DEPLOYMENT_ENV === "preview") {
    return Boolean(
      env.PREVIEW_AUTH_PASSWORD &&
        env.CF_ACCESS_TEAM_DOMAIN &&
        env.CF_ACCESS_AUD,
    );
  }
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET,
  );
}

function hasLoadableAuthConfiguration(env: Bindings): boolean {
  return hasAuthConfiguration(env) && isValidAuthURL(env.BETTER_AUTH_URL);
}

async function loadOptionalRecipeSession(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>["db"],
): Promise<AuthenticatedSession | null> {
  if (!hasLoadableAuthConfiguration(c.env)) return null;
  try {
    return await loadBetterAuthSession(c, db);
  } catch (error) {
    console.error("Recipe session lookup failed", error);
    return null;
  }
}

async function requireRecipeSession(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>["db"],
): Promise<AuthSessionResult> {
  if (!hasAuthConfiguration(c.env)) {
    return {
      success: false,
      response: c.json({ error: "Auth configuration is incomplete" }, 503),
    };
  }
  if (!isValidAuthURL(c.env.BETTER_AUTH_URL)) {
    return {
      success: false,
      response: c.json({ error: "Auth configuration is invalid" }, 503),
    };
  }

  try {
    const session = await loadBetterAuthSession(c, db);
    if (!session) {
      return {
        success: false,
        response: authorizationResponse(c, unauthenticated()),
      };
    }
    return { success: true, session };
  } catch (error) {
    console.error("Recipe session lookup failed", error);
    return {
      success: false,
      response: c.json({ error: "Auth session lookup failed" }, 503),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function findReadableRecipeBySlug(
  db: ReturnType<typeof createDb>["db"],
  slug: string,
  userId: string | undefined,
): Promise<Recipe | undefined> {
  const visibilityFilter = userId
    ? or(eq(schema.recipe.visibility, "public"), eq(schema.recipe.userId, userId))
    : eq(schema.recipe.visibility, "public");
  const [recipe] = await db
    .select()
    .from(schema.recipe)
    .where(and(eq(schema.recipe.slug, slug), visibilityFilter))
    .limit(1);
  return recipe;
}

async function findOwnedRecipeBySlug(
  db: ReturnType<typeof createDb>["db"],
  slug: string,
  userId: string,
): Promise<Recipe | undefined> {
  const [recipe] = await db
    .select()
    .from(schema.recipe)
    .where(and(eq(schema.recipe.slug, slug), eq(schema.recipe.userId, userId)))
    .limit(1);
  return recipe;
}

async function hasPreviewAccess(request: Request, env: Bindings) {
  return (
    env.DEPLOYMENT_ENV === "preview" &&
    (await verifyCloudflareAccess(request, env))
  );
}

app.get("/api/auth/preview/scenarios", async (c) => {
  if (c.env.DEPLOYMENT_ENV !== "preview") return c.notFound();
  if (!hasAuthConfiguration(c.env)) {
    return c.json({ error: "Preview auth configuration is incomplete" }, 503);
  }
  if (!(await hasPreviewAccess(c.req.raw, c.env))) {
    return c.json({ error: "Cloudflare Access authorization required" }, 403);
  }

  return c.json(
    previewScenarios.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
  );
});

app.post("/api/auth/preview/sign-in", async (c) => {
  if (c.env.DEPLOYMENT_ENV !== "preview") return c.notFound();
  if (!hasAuthConfiguration(c.env)) {
    return c.json({ error: "Preview auth configuration is incomplete" }, 503);
  }
  if (!(await hasPreviewAccess(c.req.raw, c.env))) {
    return c.json({ error: "Cloudflare Access authorization required" }, 403);
  }

  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const body = await parseJsonBody(c, previewSignInBodySchema);
  if (!body.success) return body.response;

  const scenario = findPreviewScenario(body.data.scenario);
  if (!scenario) return c.json({ error: "Unknown preview scenario" }, 400);

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json({ error: "No database connection configured" }, 503);
  }

  const { db, client } = createDb(connectionString);
  try {
    const auth = createAuth(db, c.env);
    return await auth.api.signInEmail({
      body: {
        email: scenario.email,
        password: c.env.PREVIEW_AUTH_PASSWORD!,
      },
      headers: c.req.raw.headers,
      asResponse: true,
    });
  } catch (error) {
    console.error("Preview sign-in failed", error);
    return c.json({ error: "Preview sign-in failed" }, 401);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (error) {
      console.error("client.end() cleanup failed", error);
    }
  }
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  // Preview credentials are server-owned. Only the Access-protected scenario
  // endpoint above may invoke Better Auth's email/password API.
  const blockedPasswordRoute = /^\/api\/auth\/sign-(in|up)\/email\/?$/;
  if (blockedPasswordRoute.test(c.req.path)) {
    return c.notFound();
  }

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json({ error: "No database connection configured" }, 503);
  }
  if (!hasAuthConfiguration(c.env)) {
    return c.json({ error: "Auth configuration is incomplete" }, 503);
  }
  if (!isValidAuthURL(c.env.BETTER_AUTH_URL)) {
    return c.json({ error: "Auth configuration is invalid" }, 503);
  }

  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const { db, client } = createDb(connectionString);
  try {
    const auth = createAuth(db, c.env);
    return await auth.handler(c.req.raw);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (e) {
      console.error("client.end() cleanup failed", e);
    }
  }
});

app.get("/recipes", async (c) => {
  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }
  let client: DbClient | undefined;
  try {
    const connection = createDb(connectionString);
    client = connection.client;
    const { db } = connection;
    const recipes = await db
      .select()
      .from(schema.recipe)
      .where(eq(schema.recipe.visibility, "public"));
    return c.json(recipes.map(recipeResponse));
  } catch (e) {
    console.error("GET /recipes query failed", e);
    return c.json({ error: "Database query failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.get("/recipes/:slug", async (c) => {
  const slug = parseRecipeSlug(c);
  if (!slug.success) return slug.response;

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }

  let client: DbClient | undefined;
  try {
    const connection = createDb(connectionString);
    client = connection.client;
    const { db } = connection;
    const session = await loadOptionalRecipeSession(c, db);
    const recipe = await findReadableRecipeBySlug(
      db,
      slug.slug,
      session?.user.id,
    );
    if (!recipe) return c.notFound();

    return c.json(recipeResponse(recipe));
  } catch (e) {
    console.error("GET /recipes/:slug query failed", e);
    return c.json({ error: "Database query failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.post("/recipes", async (c) => {
  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }

  let client: DbClient | undefined;
  try {
    const connection = createDb(connectionString);
    client = connection.client;
    const { db } = connection;
    const session = await requireRecipeSession(c, db);
    if (!session.success) return session.response;

    const body = await parseJsonBody(c, createRecipeBodySchema);
    if (!body.success) return body.response;

    const [recipe] = await db
      .insert(schema.recipe)
      .values({
        ...body.data,
        userId: session.session.user.id,
      })
      .returning();

    if (!recipe) return c.json({ error: "Database mutation failed" }, 502);

    return c.json(recipeResponse(recipe), 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "Recipe slug already exists" }, 409);
    }
    console.error("POST /recipes mutation failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.patch("/recipes/:slug", async (c) => {
  const slug = parseRecipeSlug(c);
  if (!slug.success) return slug.response;

  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }

  let client: DbClient | undefined;
  try {
    const connection = createDb(connectionString);
    client = connection.client;
    const { db } = connection;
    const session = await requireRecipeSession(c, db);
    if (!session.success) return session.response;

    const recipe = await findOwnedRecipeBySlug(
      db,
      slug.slug,
      session.session.user.id,
    );
    if (!recipe) return c.notFound();

    const body = await parseJsonBody(c, updateRecipeBodySchema);
    if (!body.success) return body.response;

    const [updatedRecipe] = await db
      .update(schema.recipe)
      .set(body.data)
      .where(
        and(
          eq(schema.recipe.id, recipe.id),
          eq(schema.recipe.userId, session.session.user.id),
        ),
      )
      .returning();

    if (!updatedRecipe) return c.notFound();

    return c.json(recipeResponse(updatedRecipe));
  } catch (e) {
    console.error("PATCH /recipes/:slug mutation failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.delete("/recipes/:slug", async (c) => {
  const slug = parseRecipeSlug(c);
  if (!slug.success) return slug.response;

  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const connectionString = databaseConnection(c.env);
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }

  let client: DbClient | undefined;
  try {
    const connection = createDb(connectionString);
    client = connection.client;
    const { db } = connection;
    const session = await requireRecipeSession(c, db);
    if (!session.success) return session.response;

    const recipe = await findOwnedRecipeBySlug(
      db,
      slug.slug,
      session.session.user.id,
    );
    if (!recipe) return c.notFound();

    const [deletedRecipe] = await db
      .delete(schema.recipe)
      .where(
        and(
          eq(schema.recipe.id, recipe.id),
          eq(schema.recipe.userId, session.session.user.id),
        ),
      )
      .returning({ id: schema.recipe.id });
    if (!deletedRecipe) return c.notFound();

    return c.body(null, 204);
  } catch (e) {
    console.error("DELETE /recipes/:slug mutation failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

export default app;
