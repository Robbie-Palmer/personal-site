import { Hono, type Context } from "hono";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { createDb, schema } from "./db";
import { createAuth } from "./auth";
import { verifyCloudflareAccess } from "./cloudflare-access";
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
import {
  HOUSEHOLD_INVITE_RATE_LIMIT,
  enforceRateLimit,
  rateLimitedResponse,
} from "./http/rate-limit";
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
type Household = typeof schema.organization.$inferSelect;
type HouseholdMember = typeof schema.member.$inferSelect;
type HouseholdInvitation = typeof schema.invitation.$inferSelect;
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

// Household invitations stay valid for 48 hours after they are created.
const INVITATION_EXPIRY_MS = 48 * 60 * 60 * 1000;

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

const createHouseholdBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const inviteHouseholdMemberBodySchema = z
  .object({
    email: z.string().trim().email(),
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

    // Per-account abuse limit on invite frequency (ADR 035). Keyed by the
    // inviting user, on strongly consistent Postgres rather than KV.
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

export default app;
