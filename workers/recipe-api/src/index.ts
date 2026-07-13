import { Hono, type Context } from "hono";
import { and, count, desc, eq, gt, gte, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";
import { createDb, schema } from "recipe-db";
import { RecipeContentSchema } from "recipe-domain";
import { createAuth } from "./auth";
import { verifyCloudflareAccess } from "./cloudflare-access";
import { hasPostgresErrorCode } from "./db/errors";
import {
  type AuthenticatedSession,
  type AuthorizationVariables,
  authorizationResponse,
  authorizeHouseholdMembershipManagement,
  authorizeOwnerOnly,
  authorizeRecipeRead,
  forbidden,
  loadBetterAuthSession,
  unauthenticated,
} from "./http/authorization";
import { enforceRateLimit, rateLimitedResponse } from "./http/rate-limit";
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
  ARTIFACTS?: R2Bucket;
  RECIPE_INGEST_WORKFLOW?: Workflow;
};

type Recipe = typeof schema.recipe.$inferSelect;
type RecipeImportJob = typeof schema.recipeImportJob.$inferSelect;
type Household = typeof schema.organization.$inferSelect;
type HouseholdMember = typeof schema.member.$inferSelect;
type HouseholdInvitation = typeof schema.invitation.$inferSelect;
type DbClient = ReturnType<typeof createDb>["client"];
type Db = ReturnType<typeof createDb>["db"];
type AuthSessionResult =
  | { success: true; session: AuthenticatedSession }
  | { success: false; response: Response };
type RecipeSessionContext = {
  db: Db;
  session: AuthenticatedSession;
};
type DietProfileResponse = {
  presetDietKeys: string[];
  excludedIngredientSlugs: string[];
  excludedGroupKeys: string[];
  recipeMatchMode: "hide" | "warn";
};
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
const dietRecipeMatchModeSchema = z.enum(["hide", "warn"]);

const dietKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "Diet keys must use lowercase letters, numbers, and single hyphens between words",
  });

const uniqueDietKeysSchema = z
  .array(dietKeySchema)
  .max(80)
  .transform((values) => Array.from(new Set(values)));

const MAX_RECIPE_BODY_BYTES = 100_000;
const savedRecipePayloadSchema = z
  .object({
    version: z.literal(1),
    source: z.string().trim().min(1).max(10_000),
    recipe: RecipeContentSchema,
  })
  .strict();

const savedRecipeBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_RECIPE_BODY_BYTES)
  .superRefine((value, context) => {
    if (new TextEncoder().encode(value).byteLength > MAX_RECIPE_BODY_BYTES) {
      context.addIssue({
        code: "custom",
        message: `Recipe body must be at most ${MAX_RECIPE_BODY_BYTES} bytes`,
      });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Recipe body must be valid JSON",
      });
      return;
    }

    const result = savedRecipePayloadSchema.safeParse(payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });

// Household invitations stay valid for 48 hours after they are created.
const INVITATION_EXPIRY_MS = 48 * 60 * 60 * 1000;

const HOUSEHOLD_INVITE_RATE_LIMIT = { max: 10, windowSeconds: 60 * 60 };

const createRecipeBodySchema = z.object({
  slug: recipeSlugSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500).optional(),
  body: savedRecipeBodySchema,
  visibility: recipeVisibilitySchema.default("private"),
});

const updateRecipeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(500).nullable().optional(),
    body: savedRecipeBodySchema.nullable().optional(),
    visibility: recipeVisibilitySchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one recipe field must be provided",
  });

const createHouseholdBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const updateHouseholdBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

const inviteHouseholdMemberBodySchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict();

const updateDietProfileBodySchema = z
  .object({
    presetDietKeys: uniqueDietKeysSchema.default([]),
    excludedIngredientSlugs: uniqueDietKeysSchema.default([]),
    excludedGroupKeys: uniqueDietKeysSchema.default([]),
    recipeMatchMode: dietRecipeMatchModeSchema.default("hide"),
  })
  .strict();

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

function householdResponse(household: Household) {
  const { metadata: _metadata, ...response } = household;
  return response;
}

function memberResponse(
  member: HouseholdMember & {
    user: Pick<typeof schema.user.$inferSelect, "id" | "email" | "name" | "image">;
  },
) {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt,
    user: member.user,
  };
}

function invitationResponse(invitation: HouseholdInvitation) {
  return {
    id: invitation.id,
    householdId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function defaultDietProfile(userId: string) {
  return {
    userId,
    presetDietKeys: [],
    excludedIngredientSlugs: [],
    excludedGroupKeys: [],
    recipeMatchMode: "hide" as const,
  };
}

function dietProfileResponse(profile: DietProfileResponse) {
  return {
    presetDietKeys: profile.presetDietKeys,
    excludedIngredientSlugs: profile.excludedIngredientSlugs,
    excludedGroupKeys: profile.excludedGroupKeys,
    recipeMatchMode: profile.recipeMatchMode,
  };
}

function dietUnknownReferencesResponse(
  c: Context<AppEnv>,
  details: DietReferenceIssue[],
) {
  return c.json(
    {
      error: "Unknown diet reference",
      details,
    },
    400,
  );
}

type DietReferenceIssue = {
  path: string[];
  message: string;
};

class MissingDietReferencesError extends Error {
  constructor(readonly details: DietReferenceIssue[]) {
    super("Unknown diet reference");
  }
}

function createId() {
  return crypto.randomUUID();
}

function householdSlug() {
  return `household-${createId()}`;
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
  db: Db,
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

async function withRecipeSession(
  c: Context<AppEnv>,
  failureKind: "query" | "mutation",
  logMessage: string,
  action: (context: RecipeSessionContext) => Promise<Response> | Response,
): Promise<Response> {
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
    const session = await requireRecipeSession(c, connection.db);
    if (!session.success) return session.response;
    return await action({ db: connection.db, session: session.session });
  } catch (e) {
    console.error(logMessage, e);
    return c.json({ error: `Database ${failureKind} failed` }, 502);
  } finally {
    await closeDbClient(client);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return hasPostgresErrorCode(error, "23505");
}

function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresErrorCode(error, "23503");
}

async function findRecipeBySlug(
  db: ReturnType<typeof createDb>["db"],
  slug: string,
): Promise<Recipe | undefined> {
  const [recipe] = await db
    .select()
    .from(schema.recipe)
    .where(eq(schema.recipe.slug, slug))
    .limit(1);
  return recipe;
}

async function findReadableRecipes(
  db: ReturnType<typeof createDb>["db"],
  userId: string | undefined,
): Promise<Recipe[]> {
  if (!userId) {
    return db
      .select()
      .from(schema.recipe)
      .where(eq(schema.recipe.visibility, "public"));
  }

  const householdMembership = await findUserHouseholdMembership(db, userId);
  const householdMemberIds = householdMembership
    ? await findHouseholdMemberUserIds(
        db,
        householdMembership.organizationId,
      )
    : [];

  const householdFilter =
    householdMemberIds.length > 0
      ? and(
          eq(schema.recipe.visibility, "household"),
          inArray(schema.recipe.userId, householdMemberIds),
        )
      : undefined;

  return db
    .select()
    .from(schema.recipe)
    .where(
      householdFilter
        ? or(
            eq(schema.recipe.visibility, "public"),
            eq(schema.recipe.userId, userId),
            householdFilter,
          )
        : or(eq(schema.recipe.visibility, "public"), eq(schema.recipe.userId, userId)),
    );
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

async function usersShareHousehold(
  db: ReturnType<typeof createDb>["db"],
  firstUserId: string,
  secondUserId: string,
): Promise<boolean> {
  if (firstUserId === secondUserId) return true;

  const [firstMember, secondMember] = await Promise.all([
    findUserHouseholdMembership(db, firstUserId),
    findUserHouseholdMembership(db, secondUserId),
  ]);
  return Boolean(
    firstMember &&
      secondMember &&
      firstMember.organizationId === secondMember.organizationId,
  );
}

async function findUserHouseholdMembership(
  db: ReturnType<typeof createDb>["db"],
  userId: string,
): Promise<HouseholdMember | undefined> {
  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);
  return member;
}

async function findHouseholdMemberUserIds(
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
): Promise<string[]> {
  const members = await db
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .where(eq(schema.member.organizationId, householdId));
  return members.map((member) => member.userId);
}

async function findHouseholdById(
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
): Promise<Household | undefined> {
  const [household] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, householdId))
    .limit(1);
  return household;
}

async function findHouseholdOwner(
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
): Promise<HouseholdMember | undefined> {
  const [owner] = await db
    .select()
    .from(schema.member)
    .where(
      and(
        eq(schema.member.organizationId, householdId),
        eq(schema.member.role, "owner"),
      ),
    )
    .limit(1);
  return owner;
}

async function findHouseholdMembership(
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
  userId: string,
): Promise<HouseholdMember | undefined> {
  const [member] = await db
    .select()
    .from(schema.member)
    .where(
      and(
        eq(schema.member.organizationId, householdId),
        eq(schema.member.userId, userId),
      ),
    )
    .limit(1);
  return member;
}

async function findDietProfile(
  db: Db,
  userId: string,
): Promise<DietProfileResponse | undefined> {
  const [profile] = await db
    .select()
    .from(schema.userDietProfile)
    .where(eq(schema.userDietProfile.userId, userId))
    .limit(1);
  if (!profile) return undefined;

  const [presets, ingredients, groups] = await Promise.all([
    db
      .select({ key: schema.userDietPreset.presetKey })
      .from(schema.userDietPreset)
      .where(eq(schema.userDietPreset.userId, userId)),
    db
      .select({ slug: schema.userDietExcludedIngredient.ingredientSlug })
      .from(schema.userDietExcludedIngredient)
      .where(eq(schema.userDietExcludedIngredient.userId, userId)),
    db
      .select({ key: schema.userDietExcludedGroup.groupKey })
      .from(schema.userDietExcludedGroup)
      .where(eq(schema.userDietExcludedGroup.userId, userId)),
  ]);

  return {
    presetDietKeys: presets.map((preset) => preset.key),
    excludedIngredientSlugs: ingredients.map((ingredient) => ingredient.slug),
    excludedGroupKeys: groups.map((group) => group.key),
    recipeMatchMode: profile.recipeMatchMode,
  };
}

async function listDietOptions(db: Db) {
  const [
    ingredients,
    groups,
    groupMembers,
    presets,
    presetGroups,
    presetIngredients,
  ] = await Promise.all([
      db
        .select({
          slug: schema.ingredient.slug,
          name: schema.ingredient.name,
          category: schema.ingredient.category,
        })
        .from(schema.ingredient),
      db
        .select({
          key: schema.ingredientGroup.key,
          label: schema.ingredientGroup.label,
          sub: schema.ingredientGroup.description,
        })
        .from(schema.ingredientGroup),
      db
        .select({
          groupKey: schema.ingredientGroupMember.groupKey,
          ingredientSlug: schema.ingredientGroupMember.ingredientSlug,
        })
        .from(schema.ingredientGroupMember),
      db
        .select({
          key: schema.dietPreset.key,
          label: schema.dietPreset.label,
          sub: schema.dietPreset.description,
        })
        .from(schema.dietPreset),
      db
        .select({
          presetKey: schema.dietPresetExcludedGroup.presetKey,
          groupKey: schema.dietPresetExcludedGroup.groupKey,
        })
        .from(schema.dietPresetExcludedGroup),
      db
        .select({
          presetKey: schema.dietPresetExcludedIngredient.presetKey,
          ingredientSlug: schema.dietPresetExcludedIngredient.ingredientSlug,
        })
        .from(schema.dietPresetExcludedIngredient),
    ]);

  const groupKeysByPreset = new Map<string, string[]>();
  for (const row of presetGroups) {
    const groupKeys = groupKeysByPreset.get(row.presetKey) ?? [];
    groupKeys.push(row.groupKey);
    groupKeysByPreset.set(row.presetKey, groupKeys);
  }

  const ingredientSlugsByPreset = new Map<string, string[]>();
  for (const row of presetIngredients) {
    const ingredientSlugs = ingredientSlugsByPreset.get(row.presetKey) ?? [];
    ingredientSlugs.push(row.ingredientSlug);
    ingredientSlugsByPreset.set(row.presetKey, ingredientSlugs);
  }

  const ingredientSlugsByGroup = new Map<string, string[]>();
  for (const row of groupMembers) {
    const ingredientSlugs = ingredientSlugsByGroup.get(row.groupKey) ?? [];
    ingredientSlugs.push(row.ingredientSlug);
    ingredientSlugsByGroup.set(row.groupKey, ingredientSlugs);
  }

  return {
    presets: presets
      .map((preset) => ({
        key: preset.key,
        label: preset.label,
        sub: preset.sub ?? "",
        excludedGroupKeys: groupKeysByPreset.get(preset.key) ?? [],
        excludedIngredientSlugs:
          ingredientSlugsByPreset.get(preset.key) ?? [],
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    groups: groups
      .map((group) => ({
        key: group.key,
        label: group.label,
        sub: group.sub ?? "",
        ingredientSlugs: ingredientSlugsByGroup.get(group.key) ?? [],
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ingredients: ingredients
      .map((ingredient) => ({
        slug: ingredient.slug,
        name: ingredient.name,
        category: ingredient.category ?? undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function findMissingDietReferences(
  db: Pick<Db, "select">,
  body: z.infer<typeof updateDietProfileBodySchema>,
) {
  const [presets, ingredients, groups] = await Promise.all([
    body.presetDietKeys.length > 0
      ? db
          .select({ key: schema.dietPreset.key })
          .from(schema.dietPreset)
          .where(inArray(schema.dietPreset.key, body.presetDietKeys))
      : [],
    body.excludedIngredientSlugs.length > 0
      ? db
          .select({ slug: schema.ingredient.slug })
          .from(schema.ingredient)
          .where(
            inArray(
              schema.ingredient.slug,
              body.excludedIngredientSlugs,
            ),
          )
      : [],
    body.excludedGroupKeys.length > 0
      ? db
          .select({ key: schema.ingredientGroup.key })
          .from(schema.ingredientGroup)
          .where(inArray(schema.ingredientGroup.key, body.excludedGroupKeys))
      : [],
  ]);

  const presetKeys = new Set(presets.map((preset) => preset.key));
  const ingredientSlugs = new Set(
    ingredients.map((ingredient) => ingredient.slug),
  );
  const groupKeys = new Set(groups.map((group) => group.key));

  return [
    ...body.presetDietKeys
      .filter((key) => !presetKeys.has(key))
      .map((key) => ({
        path: ["presetDietKeys"],
        message: `Unknown diet preset: ${key}`,
      })),
    ...body.excludedIngredientSlugs
      .filter((slug) => !ingredientSlugs.has(slug))
      .map((slug) => ({
        path: ["excludedIngredientSlugs"],
        message: `Unknown ingredient: ${slug}`,
      })),
    ...body.excludedGroupKeys
      .filter((key) => !groupKeys.has(key))
      .map((key) => ({
        path: ["excludedGroupKeys"],
        message: `Unknown ingredient group: ${key}`,
      })),
  ];
}

async function authorizeHouseholdOwnerResponse(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
  session: AuthenticatedSession,
): Promise<Response | undefined> {
  const household = await findHouseholdById(db, householdId);
  if (!household) return c.notFound();

  const owner = await findHouseholdOwner(db, householdId);
  const decision = owner
    ? authorizeHouseholdMembershipManagement(session.user, {
        ownerId: owner.userId,
      })
    : forbidden();
  if (!decision.allowed) return authorizationResponse(c, decision);
  return undefined;
}

async function requireHouseholdMemberResponse(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>["db"],
  householdId: string,
  session: AuthenticatedSession,
): Promise<Response | undefined> {
  const household = await findHouseholdById(db, householdId);
  if (!household) return c.notFound();

  const membership = await findHouseholdMembership(
    db,
    householdId,
    session.user.id,
  );
  if (!membership) return authorizationResponse(c, forbidden());
  return undefined;
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
  // Households reuse Better Auth's organization tables but are managed entirely
  // through our own authorization-checked endpoints. Better Auth's organization
  // plugin is intentionally not registered; block these paths defensively so the
  // raw organization API can never be exposed.
  if (/^\/api\/auth\/organization(?:\/|$)/.test(c.req.path)) {
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

app.get("/api/profile/diet", async (c) => {
  return withRecipeSession(
    c,
    "query",
    "GET /api/profile/diet query failed",
    async ({ db, session }) => {
      const profile =
        (await findDietProfile(db, session.user.id)) ??
        defaultDietProfile(session.user.id);
      return c.json(dietProfileResponse(profile));
    },
  );
});

app.get("/api/profile/diet/options", async (c) => {
  return withRecipeSession(
    c,
    "query",
    "GET /api/profile/diet/options query failed",
    async ({ db }) => c.json(await listDietOptions(db)),
  );
});

app.put("/api/profile/diet", async (c) => {
  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const body = await parseJsonBody(c, updateDietProfileBodySchema);
  if (!body.success) return body.response;

  return withRecipeSession(
    c,
    "mutation",
    "PUT /api/profile/diet mutation failed",
    async ({ db, session }) => {
      try {
        const profile = await db.transaction(async (tx) => {
          const missingReferences = await findMissingDietReferences(tx, body.data);
          if (missingReferences.length > 0) {
            throw new MissingDietReferencesError(missingReferences);
          }

          const [savedProfile] = await tx
            .insert(schema.userDietProfile)
            .values({
              userId: session.user.id,
              recipeMatchMode: body.data.recipeMatchMode,
            })
            .onConflictDoUpdate({
              target: schema.userDietProfile.userId,
              set: {
                recipeMatchMode: body.data.recipeMatchMode,
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!savedProfile) throw new Error("Diet profile upsert failed");

          await Promise.all([
            tx
              .delete(schema.userDietPreset)
              .where(eq(schema.userDietPreset.userId, session.user.id)),
            tx
              .delete(schema.userDietExcludedIngredient)
              .where(
                eq(schema.userDietExcludedIngredient.userId, session.user.id),
              ),
            tx
              .delete(schema.userDietExcludedGroup)
              .where(eq(schema.userDietExcludedGroup.userId, session.user.id)),
          ]);

          if (body.data.presetDietKeys.length > 0) {
            await tx.insert(schema.userDietPreset).values(
              body.data.presetDietKeys.map((presetKey) => ({
                userId: session.user.id,
                presetKey,
              })),
            );
          }

          if (body.data.excludedIngredientSlugs.length > 0) {
            await tx.insert(schema.userDietExcludedIngredient).values(
              body.data.excludedIngredientSlugs.map((ingredientSlug) => ({
                userId: session.user.id,
                ingredientSlug,
              })),
            );
          }

          if (body.data.excludedGroupKeys.length > 0) {
            await tx.insert(schema.userDietExcludedGroup).values(
              body.data.excludedGroupKeys.map((groupKey) => ({
                userId: session.user.id,
                groupKey,
              })),
            );
          }

          return {
            presetDietKeys: body.data.presetDietKeys,
            excludedIngredientSlugs: body.data.excludedIngredientSlugs,
            excludedGroupKeys: body.data.excludedGroupKeys,
            recipeMatchMode: savedProfile.recipeMatchMode,
          };
        });

        return c.json(dietProfileResponse(profile));
      } catch (error) {
        if (error instanceof MissingDietReferencesError) {
          return dietUnknownReferencesResponse(c, error.details);
        }
        if (isForeignKeyViolation(error)) {
          return dietUnknownReferencesResponse(c, [
            {
              path: [],
              message: "Diet reference was removed before the profile could be saved",
            },
          ]);
        }
        throw error;
      }
    },
  );
});

app.get("/households", async (c) => {
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

    const households = await db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        logo: schema.organization.logo,
        createdAt: schema.organization.createdAt,
        updatedAt: schema.organization.updatedAt,
        memberId: schema.member.id,
        role: schema.member.role,
      })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id),
      )
      .where(eq(schema.member.userId, session.session.user.id));

    return c.json(
      households.map(({ memberId, role, ...household }) => ({
        ...household,
        membership: { id: memberId, role },
      })),
    );
  } catch (e) {
    console.error("GET /households query failed", e);
    return c.json({ error: "Database query failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.get("/households/invitations", async (c) => {
  return withRecipeSession(
    c,
    "query",
    "GET /households/invitations failed",
    async ({ db, session }) => {
      const invitations = await db
        .select({
          invitation: schema.invitation,
          household: {
            id: schema.organization.id,
            name: schema.organization.name,
          },
        })
        .from(schema.invitation)
        .innerJoin(
          schema.organization,
          eq(schema.invitation.organizationId, schema.organization.id),
        )
        .where(
          and(
            eq(schema.invitation.email, session.user.email.toLowerCase()),
            eq(schema.invitation.status, "pending"),
            gt(schema.invitation.expiresAt, new Date()),
          ),
        );

      return c.json(
        invitations.map(({ invitation, household }) => ({
          ...invitationResponse(invitation),
          household,
        })),
      );
    },
  );
});

app.post("/households", async (c) => {
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

    const existingMembership = await findUserHouseholdMembership(
      db,
      session.session.user.id,
    );
    if (existingMembership) {
      return c.json({ error: "User already belongs to a household" }, 409);
    }

    const body = await parseJsonBody(c, createHouseholdBodySchema);
    if (!body.success) return body.response;

    const householdId = createId();
    const household = await db.transaction(async (tx) => {
      const [createdHousehold] = await tx
        .insert(schema.organization)
        .values({
          id: householdId,
          name: body.data.name ?? `${session.session.user.name}'s household`,
          slug: householdSlug(),
        })
        .returning();
      if (!createdHousehold) throw new Error("Household insert failed");

      await tx.insert(schema.member).values({
        id: createId(),
        organizationId: householdId,
        userId: session.session.user.id,
        role: "owner",
      });

      return createdHousehold;
    });

    return c.json(householdResponse(household), 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "User already belongs to a household" }, 409);
    }
    console.error("POST /households mutation failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.patch("/households/:householdId", async (c) => {
  const householdId = c.req.param("householdId");
  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  return withRecipeSession(
    c,
    "mutation",
    "PATCH /households/:householdId failed",
    async ({ db, session }) => {
      const ownerFailure = await authorizeHouseholdOwnerResponse(
        c,
        db,
        householdId,
        session,
      );
      if (ownerFailure) return ownerFailure;

      const body = await parseJsonBody(c, updateHouseholdBodySchema);
      if (!body.success) return body.response;

      const [household] = await db
        .update(schema.organization)
        .set({ name: body.data.name })
        .where(eq(schema.organization.id, householdId))
        .returning();
      if (!household) return c.notFound();

      return c.json(householdResponse(household));
    },
  );
});

app.delete("/households/:householdId", async (c) => {
  const householdId = c.req.param("householdId");
  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  return withRecipeSession(
    c,
    "mutation",
    "DELETE /households/:householdId failed",
    async ({ db, session }) => {
      const ownerFailure = await authorizeHouseholdOwnerResponse(
        c,
        db,
        householdId,
        session,
      );
      if (ownerFailure) return ownerFailure;

      await db.transaction(async (tx) => {
        const memberRows = await tx
          .select({ userId: schema.member.userId })
          .from(schema.member)
          .where(eq(schema.member.organizationId, householdId));
        const memberUserIds = memberRows.map((member) => member.userId);

        if (memberUserIds.length > 0) {
          await tx
            .update(schema.recipe)
            .set({ visibility: "private" })
            .where(
              and(
                eq(schema.recipe.visibility, "household"),
                inArray(schema.recipe.userId, memberUserIds),
              ),
            );
        }
        await tx
          .delete(schema.organization)
          .where(eq(schema.organization.id, householdId));
      });

      return c.body(null, 204);
    },
  );
});

app.get("/households/:householdId/members", async (c) => {
  const householdId = c.req.param("householdId");
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

    const memberFailure = await requireHouseholdMemberResponse(
      c,
      db,
      householdId,
      session.session,
    );
    if (memberFailure) return memberFailure;

    const members = await db
      .select({
        id: schema.member.id,
        organizationId: schema.member.organizationId,
        userId: schema.member.userId,
        role: schema.member.role,
        createdAt: schema.member.createdAt,
        user: {
          id: schema.user.id,
          email: schema.user.email,
          name: schema.user.name,
          image: schema.user.image,
        },
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.member.organizationId, householdId));

    return c.json(members.map(memberResponse));
  } catch (e) {
    console.error("GET /households/:householdId/members query failed", e);
    return c.json({ error: "Database query failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.get("/households/:householdId/invitations", async (c) => {
  const householdId = c.req.param("householdId");
  return withRecipeSession(
    c,
    "query",
    "GET /households/:householdId/invitations failed",
    async ({ db, session }) => {
      const ownerFailure = await authorizeHouseholdOwnerResponse(
        c,
        db,
        householdId,
        session,
      );
      if (ownerFailure) return ownerFailure;

      const invitations = await db
        .select()
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.organizationId, householdId),
            eq(schema.invitation.status, "pending"),
            gt(schema.invitation.expiresAt, new Date()),
          ),
        );

      return c.json(invitations.map(invitationResponse));
    },
  );
});

app.post("/households/:householdId/invitations", async (c) => {
  const householdId = c.req.param("householdId");
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

    const ownerFailure = await authorizeHouseholdOwnerResponse(
      c,
      db,
      householdId,
      session.session,
    );
    if (ownerFailure) return ownerFailure;

    const inviteLimit = await enforceRateLimit(
      db,
      `household-invite:${session.session.user.id}`,
      HOUSEHOLD_INVITE_RATE_LIMIT,
    );
    if (!inviteLimit.allowed) {
      return rateLimitedResponse(c, inviteLimit.retryAfter);
    }

    const body = await parseJsonBody(c, inviteHouseholdMemberBodySchema);
    if (!body.success) return body.response;

    const email = body.data.email.toLowerCase();

    const [existingInvitation] = await db
      .select()
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.organizationId, householdId),
          eq(schema.invitation.email, email),
          eq(schema.invitation.status, "pending"),
        ),
      )
      .limit(1);
    if (existingInvitation) {
      return c.json(
        { error: "A pending invitation already exists for this email" },
        409,
      );
    }

    const [invitation] = await db
      .insert(schema.invitation)
      .values({
        id: createId(),
        organizationId: householdId,
        email,
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + INVITATION_EXPIRY_MS),
        inviterId: session.session.user.id,
      })
      .returning();

    if (!invitation) return c.json({ error: "Database mutation failed" }, 502);
    return c.json(invitationResponse(invitation), 201);
  } catch (e) {
    console.error("POST /households/:householdId/invitations failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.post("/households/invitations/:invitationId/accept", async (c) => {
  const invitationId = c.req.param("invitationId");
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

    const [invitation] = await db
      .select()
      .from(schema.invitation)
      .where(eq(schema.invitation.id, invitationId))
      .limit(1);
    if (!invitation) return c.notFound();
    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is not pending" }, 409);
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return c.json({ error: "Invitation has expired" }, 410);
    }
    if (invitation.email.toLowerCase() !== session.session.user.email.toLowerCase()) {
      return authorizationResponse(c, forbidden());
    }

    const existingMembership = await findUserHouseholdMembership(
      db,
      session.session.user.id,
    );
    if (existingMembership) {
      return c.json({ error: "User already belongs to a household" }, 409);
    }

    const member = await db.transaction(async (tx) => {
      const [accepted] = await tx
        .update(schema.invitation)
        .set({ status: "accepted" })
        .where(
          and(
            eq(schema.invitation.id, invitationId),
            eq(schema.invitation.status, "pending"),
          ),
        )
        .returning();
      if (!accepted) throw new Error("Invitation is not pending");

      const [createdMember] = await tx
        .insert(schema.member)
        .values({
          id: createId(),
          organizationId: invitation.organizationId,
          userId: session.session.user.id,
          role: "member",
        })
        .returning();
      if (!createdMember) throw new Error("Member insert failed");
      return createdMember;
    });

    return c.json({
      invitation: { ...invitationResponse(invitation), status: "accepted" },
      membershipCreated: Boolean(member),
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "User already belongs to a household" }, 409);
    }
    if (e instanceof Error && e.message === "Invitation is not pending") {
      return c.json({ error: "Invitation is not pending" }, 409);
    }
    console.error("POST /households/invitations/:invitationId/accept failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.post("/households/invitations/:invitationId/decline", async (c) => {
  const invitationId = c.req.param("invitationId");
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

    const [invitation] = await db
      .select()
      .from(schema.invitation)
      .where(eq(schema.invitation.id, invitationId))
      .limit(1);
    if (!invitation) return c.notFound();
    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is not pending" }, 409);
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return c.json({ error: "Invitation has expired" }, 410);
    }
    if (invitation.email.toLowerCase() !== session.session.user.email.toLowerCase()) {
      return authorizationResponse(c, forbidden());
    }

    const [declined] = await db
      .update(schema.invitation)
      .set({ status: "rejected" })
      .where(
        and(
          eq(schema.invitation.id, invitationId),
          eq(schema.invitation.status, "pending"),
        ),
      )
      .returning();

    if (!declined) {
      return c.json({ error: "Invitation is not pending" }, 409);
    }
    return c.json(invitationResponse(declined));
  } catch (e) {
    console.error("POST /households/invitations/:invitationId/decline failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.delete(
  "/households/:householdId/invitations/:invitationId",
  async (c) => {
    const householdId = c.req.param("householdId");
    const invitationId = c.req.param("invitationId");
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

      const ownerFailure = await authorizeHouseholdOwnerResponse(
        c,
        db,
        householdId,
        session.session,
      );
      if (ownerFailure) return ownerFailure;

      const [invitation] = await db
        .select()
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.id, invitationId),
            eq(schema.invitation.organizationId, householdId),
          ),
        )
        .limit(1);
      if (!invitation) return c.notFound();
      if (invitation.status !== "pending") {
        return c.json({ error: "Invitation is not pending" }, 409);
      }

      const [revoked] = await db
        .update(schema.invitation)
        .set({ status: "canceled" })
        .where(
          and(
            eq(schema.invitation.id, invitationId),
            eq(schema.invitation.organizationId, householdId),
            eq(schema.invitation.status, "pending"),
          ),
        )
        .returning();
      if (!revoked) {
        return c.json({ error: "Invitation is not pending" }, 409);
      }
      return c.json(invitationResponse(revoked));
    } catch (e) {
      console.error(
        "DELETE /households/:householdId/invitations/:invitationId failed",
        e,
      );
      return c.json({ error: "Database mutation failed" }, 502);
    } finally {
      await closeDbClient(client);
    }
  },
);

app.delete("/households/:householdId/members/:memberId", async (c) => {
  const householdId = c.req.param("householdId");
  const memberId = c.req.param("memberId");
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

    const ownerFailure = await authorizeHouseholdOwnerResponse(
      c,
      db,
      householdId,
      session.session,
    );
    if (ownerFailure) return ownerFailure;

    const [member] = await db
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.id, memberId),
          eq(schema.member.organizationId, householdId),
        ),
      )
      .limit(1);
    if (!member) return c.notFound();
    if (member.role === "owner") {
      return c.json({ error: "Household owner cannot be revoked" }, 400);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.recipe)
        .set({ visibility: "private" })
        .where(
          and(
            eq(schema.recipe.visibility, "household"),
            eq(schema.recipe.userId, member.userId),
          ),
        );
      await tx.delete(schema.member).where(eq(schema.member.id, memberId));
    });
    return c.body(null, 204);
  } catch (e) {
    console.error("DELETE /households/:householdId/members/:memberId failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.post("/households/:householdId/leave", async (c) => {
  const householdId = c.req.param("householdId");
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

    const household = await findHouseholdById(db, householdId);
    if (!household) return c.notFound();

    const member = await findHouseholdMembership(
      db,
      householdId,
      session.session.user.id,
    );
    if (!member) return authorizationResponse(c, forbidden());
    if (member.role === "owner") {
      return c.json({ error: "Household owner cannot leave" }, 400);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.recipe)
        .set({ visibility: "private" })
        .where(
          and(
            eq(schema.recipe.visibility, "household"),
            eq(schema.recipe.userId, session.session.user.id),
          ),
        );
      await tx.delete(schema.member).where(eq(schema.member.id, member.id));
    });
    return c.body(null, 204);
  } catch (e) {
    console.error("POST /households/:householdId/leave failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
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
    const session = await loadOptionalRecipeSession(c, db);
    const recipes = await findReadableRecipes(db, session?.user.id);
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
    const recipe = await findRecipeBySlug(db, slug.slug);
    if (!recipe) return c.notFound();

    if (recipe.visibility !== "public") {
      if (!session) return c.notFound();
      const household = {
        userSharesHouseholdWithOwner: await usersShareHousehold(
          db,
          recipe.userId,
          session.user.id,
        ),
      };
      const decision = authorizeRecipeRead(session.user, recipe, household);
      if (!decision.allowed) return c.notFound();
    }

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

    if (body.data.visibility === "household") {
      const membership = await findUserHouseholdMembership(
        db,
        session.session.user.id,
      );
      if (!membership) return authorizationResponse(c, forbidden());
    }

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
      return c.json(
        {
          error:
            "A recipe with this name already exists. Choose a different name.",
        },
        409,
      );
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

    const ownerDecision = authorizeOwnerOnly(session.session.user, recipe);
    if (!ownerDecision.allowed) return authorizationResponse(c, ownerDecision);

    if (body.data.visibility === "household") {
      const membership = await findUserHouseholdMembership(
        db,
        session.session.user.id,
      );
      if (!membership) return authorizationResponse(c, forbidden());
    }

    const updates = {
      ...body.data,
    };

    const [updatedRecipe] = await db
      .update(schema.recipe)
      .set(updates)
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

app.post("/recipes/:slug/household-share", async (c) => {
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

    const membership = await findUserHouseholdMembership(
      db,
      session.session.user.id,
    );
    if (!membership) return authorizationResponse(c, forbidden());

    const memberFailure = await requireHouseholdMemberResponse(
      c,
      db,
      membership.organizationId,
      session.session,
    );
    if (memberFailure) return memberFailure;

    const [updatedRecipe] = await db
      .update(schema.recipe)
      .set({
        visibility: "household",
      })
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
    console.error("POST /recipes/:slug/household-share failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.delete("/recipes/:slug/household-share", async (c) => {
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

    const ownerDecision = authorizeOwnerOnly(session.session.user, recipe);
    if (!ownerDecision.allowed) {
      return authorizationResponse(c, ownerDecision);
    }

    const [updatedRecipe] = await db
      .update(schema.recipe)
      .set({
        visibility: "private",
      })
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
    console.error("DELETE /recipes/:slug/household-share failed", e);
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

// This API owns recipe photo import auth, quotas, job creation,
// and status reads; the recipe-ingest Workflow owns the parsing chain.

const RECIPE_IMPORT_MAX_IMAGES = 6;
const RECIPE_IMPORT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RECIPE_IMPORT_MAX_ACTIVE_JOBS = 2;
const RECIPE_IMPORT_DAILY_JOB_LIMIT = 10;
const RECIPE_IMPORT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const recipeImportIdSchema = z.string().uuid();

function importJobResponse(job: RecipeImportJob) {
  return {
    id: job.id,
    status: job.status,
    currentStage: job.currentStage,
    progressLabel: job.progressLabel,
    imageCount: job.imageCount,
    error: job.errorMessage
      ? { type: job.errorType, message: job.errorMessage }
      : undefined,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

function parseImportImages(
  c: Context<AppEnv>,
  form: FormData,
):
  | { success: true; images: { file: File; extension: string }[] }
  | { success: false; response: Response } {
  // workers-types declares FormData entries as string, but the runtime
  // returns File objects for file uploads — widen and narrow via instanceof.
  const entries: unknown[] = form.getAll("images");
  if (entries.length === 0) {
    return {
      success: false,
      response: c.json({ error: "At least one image is required" }, 400),
    };
  }
  if (entries.length > RECIPE_IMPORT_MAX_IMAGES) {
    return {
      success: false,
      response: c.json(
        { error: `At most ${RECIPE_IMPORT_MAX_IMAGES} images are allowed` },
        400,
      ),
    };
  }

  const images: { file: File; extension: string }[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      return {
        success: false,
        response: c.json({ error: "images must be file uploads" }, 400),
      };
    }
    const extension = RECIPE_IMPORT_IMAGE_EXTENSIONS[entry.type];
    if (!extension) {
      return {
        success: false,
        response: c.json(
          { error: "Images must be JPEG, PNG, or WebP" },
          415,
        ),
      };
    }
    if (entry.size === 0) {
      return {
        success: false,
        response: c.json({ error: "Images must not be empty" }, 400),
      };
    }
    if (entry.size > RECIPE_IMPORT_MAX_IMAGE_BYTES) {
      return {
        success: false,
        response: c.json(
          { error: "Each image must be 10MB or smaller" },
          413,
        ),
      };
    }
    images.push({ file: entry, extension });
  }
  return { success: true, images };
}

app.post("/recipe-imports", async (c) => {
  const csrfFailure = validateCsrf(c);
  if (csrfFailure) return csrfFailure;

  const artifacts = c.env.ARTIFACTS;
  const workflow = c.env.RECIPE_INGEST_WORKFLOW;
  if (!artifacts || !workflow) {
    return c.json({ error: "Recipe import is not configured" }, 503);
  }

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
    const userId = session.session.user.id;

    const form = await c.req.formData().catch(() => undefined);
    if (!form) {
      return c.json(
        { error: "Request body must be multipart/form-data" },
        415,
      );
    }
    const parsed = parseImportImages(c, form);
    if (!parsed.success) return parsed.response;
    const { images } = parsed;

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    type QuotaOutcome =
      | { ok: true; job: RecipeImportJob }
      | { ok: false; reason: "active" | "daily" };

    const outcome = await db.transaction(async (tx): Promise<QuotaOutcome> => {
      // Serialize per-user job creation so concurrent uploads cannot slip past the limits.
      await tx
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .for("update");

      const [active] = await tx
        .select({ value: count() })
        .from(schema.recipeImportJob)
        .where(
          and(
            eq(schema.recipeImportJob.userId, userId),
            inArray(schema.recipeImportJob.status, ["queued", "running"]),
          ),
        );
      if ((active?.value ?? 0) >= RECIPE_IMPORT_MAX_ACTIVE_JOBS) {
        return { ok: false, reason: "active" };
      }

      const [today] = await tx
        .select({ value: count() })
        .from(schema.recipeImportJob)
        .where(
          and(
            eq(schema.recipeImportJob.userId, userId),
            gte(schema.recipeImportJob.createdAt, dayStart),
          ),
        );
      if ((today?.value ?? 0) >= RECIPE_IMPORT_DAILY_JOB_LIMIT) {
        return { ok: false, reason: "daily" };
      }

      const [job] = await tx
        .insert(schema.recipeImportJob)
        .values({ userId, imageCount: images.length })
        .returning();
      if (!job) throw new Error("Recipe import job insert returned no row");
      return { ok: true, job };
    });

    if (!outcome.ok) {
      return c.json(
        {
          error:
            outcome.reason === "active"
              ? "Too many imports in progress"
              : "Daily import limit reached",
        },
        429,
      );
    }
    const job = outcome.job;

    try {
      await Promise.all(
        images.map(({ file, extension }, index) =>
          artifacts.put(
            `imports/${job.id}/source/${index}.${extension}`,
            file,
            { httpMetadata: { contentType: file.type } },
          ),
        ),
      );
      await workflow.create({ id: job.id, params: { jobId: job.id } });
    } catch (error) {
      console.error("POST /recipe-imports failed to start workflow", error);
      // Best-effort cleanup so partially uploaded images don't accumulate.
      try {
        const uploaded = await artifacts.list({
          prefix: `imports/${job.id}/`,
        });
        await Promise.all(
          uploaded.objects.map((object) => artifacts.delete(object.key)),
        );
      } catch (cleanupError) {
        console.error(
          `Failed to clean up R2 objects for import ${job.id}`,
          cleanupError,
        );
      }
      await db
        .update(schema.recipeImportJob)
        .set({
          status: "failed",
          progressLabel: "Import failed",
          errorType: "StartError",
          errorMessage: "Failed to start the import",
          finishedAt: new Date(),
        })
        .where(eq(schema.recipeImportJob.id, job.id));
      return c.json({ error: "Failed to start the import" }, 502);
    }

    return c.json(importJobResponse(job), 202);
  } catch (e) {
    console.error("POST /recipe-imports mutation failed", e);
    return c.json({ error: "Database mutation failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.get("/recipe-imports", async (c) => {
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

    const jobs = await db
      .select()
      .from(schema.recipeImportJob)
      .where(eq(schema.recipeImportJob.userId, session.session.user.id))
      .orderBy(desc(schema.recipeImportJob.createdAt))
      .limit(20);

    return c.json({ imports: jobs.map(importJobResponse) });
  } catch (e) {
    console.error("GET /recipe-imports lookup failed", e);
    return c.json({ error: "Database lookup failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

app.get("/recipe-imports/:jobId", async (c) => {
  const jobId = recipeImportIdSchema.safeParse(c.req.param("jobId"));
  if (!jobId.success) return c.json({ error: "Import not found" }, 404);

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

    const [job] = await db
      .select()
      .from(schema.recipeImportJob)
      .where(eq(schema.recipeImportJob.id, jobId.data))
      .limit(1);
    if (!job || job.userId !== session.session.user.id) {
      return c.json({ error: "Import not found" }, 404);
    }

    const artifacts = await db
      .select({
        stage: schema.recipeImportArtifact.stage,
        kind: schema.recipeImportArtifact.kind,
        r2Key: schema.recipeImportArtifact.r2Key,
        checksum: schema.recipeImportArtifact.checksum,
        schemaVersion: schema.recipeImportArtifact.schemaVersion,
        model: schema.recipeImportArtifact.model,
        provider: schema.recipeImportArtifact.provider,
        createdAt: schema.recipeImportArtifact.createdAt,
      })
      .from(schema.recipeImportArtifact)
      .where(eq(schema.recipeImportArtifact.jobId, job.id))
      .orderBy(schema.recipeImportArtifact.createdAt);

    const draft =
      job.status === "succeeded"
        ? (
            await db
              .select({ preview: schema.recipeImportArtifact.preview })
              .from(schema.recipeImportArtifact)
              .where(
                and(
                  eq(schema.recipeImportArtifact.jobId, job.id),
                  eq(schema.recipeImportArtifact.stage, "finalize"),
                  eq(schema.recipeImportArtifact.kind, "draft"),
                ),
              )
              .limit(1)
          )[0]?.preview
        : undefined;

    return c.json({ ...importJobResponse(job), artifacts, draft });
  } catch (e) {
    console.error("GET /recipe-imports/:jobId lookup failed", e);
    return c.json({ error: "Database lookup failed" }, 502);
  } finally {
    await closeDbClient(client);
  }
});

export { app };

// Rows reset in place on each request, so only keys that fall idle linger. A
// daily sweep past the longest window keeps the table bounded.
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

async function cleanupRateLimits(env: Bindings): Promise<void> {
  const connectionString = databaseConnection(env);
  if (!connectionString) return;

  const { db, client } = createDb(connectionString);
  try {
    const cutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_MS);
    await db
      .delete(schema.appRateLimit)
      .where(lt(schema.appRateLimit.windowStart, cutoff));
  } catch (e) {
    console.error("Rate limit cleanup failed", e);
  } finally {
    await closeDbClient(client);
  }
}

export default {
  fetch: app.fetch,
  scheduled: (_event, env, ctx) => {
    ctx.waitUntil(cleanupRateLimits(env));
  },
} satisfies ExportedHandler<Bindings>;
