import { and, eq } from "drizzle-orm";
import { createDb, schema } from "recipe-db";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createAuth } from "../../src/auth";
import { app, type Bindings } from "../../src/index";

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) throw new Error("DATABASE_URL is required for integration tests");

const authOrigin = "http://localhost:3000";
const authSecret = "integration-test-secret-that-is-at-least-thirty-two-characters";
const password = "integration-password-123";

const baseEnv: Bindings = {
  DATABASE_URL: databaseURL,
  DEPLOYMENT_ENV: "preview",
  BETTER_AUTH_URL: authOrigin,
  BETTER_AUTH_SECRET: authSecret,
  PREVIEW_AUTH_PASSWORD: password,
  CF_ACCESS_TEAM_DOMAIN: "integration.cloudflareaccess.test",
  CF_ACCESS_AUD: "integration-audience",
};

const { db, client } = createDb(databaseURL);

type TestUser = {
  cookie: string;
  email: string;
  id: string;
};

function savedRecipeBody(slug: string, title: string): string {
  const source = "Mix the @salt{1%tsp} into the dish.";
  return JSON.stringify({
    version: 1,
    source,
    recipe: {
      slug,
      title,
      description: `${title} integration fixture.`,
      cookBody: source,
      date: "2026-07-17",
      cuisine: [],
      servings: 2,
      tags: [],
      cookware: [],
      ingredientGroups: [
        {
          items: [{ ingredient: "salt", amount: 1, unit: "tsp" }],
        },
      ],
      instructions: ["Mix the salt into the dish."],
    },
  });
}

async function createUser(name: string, email: string): Promise<TestUser> {
  const auth = createAuth(db, baseEnv, { allowPreviewSignUp: true });
  await auth.api.signUpEmail({
    body: { name, email, password },
  });

  const [createdUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!createdUser) throw new Error(`Better Auth did not create ${email}`);

  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.id, createdUser.id));
  await db
    .update(schema.userEmail)
    .set({ verified: true })
    .where(eq(schema.userEmail.userId, createdUser.id));

  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  if (!response.ok) {
    throw new Error(`Better Auth sign-in failed for ${email}: ${response.status}`);
  }

  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie?.match(
    /(?:__Secure-)?better-auth[.-]session_token=[^;,\s]+/,
  )?.[0];
  if (!cookie) throw new Error(`Better Auth did not issue a session for ${email}`);

  return { cookie, email, id: createdUser.id };
}

function authenticatedRequest(
  user: TestUser,
  path: string,
  options: {
    body?: unknown;
    env?: Bindings;
    method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  } = {},
) {
  const method = options.method ?? "GET";
  const headers = new Headers({ cookie: user.cookie });
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }
  if (method !== "GET") headers.set("origin", authOrigin);

  return app.request(
    path,
    { method, headers, body },
    options.env ?? baseEnv,
  );
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

beforeAll(async () => {
  const [migrationCount] = await client<{ count: number }[]>`
    select count(*)::integer as count
    from drizzle.__drizzle_migrations
  `;
  const [tableCount] = await client<{ count: number }[]>`
    select count(*)::integer as count
    from information_schema.tables
    where table_schema = 'public'
  `;
  expect(migrationCount?.count).toBe(2);
  expect(tableCount?.count).toBe(29);
});

beforeEach(async () => {
  // Keep the migration journal and reference catalog installed by migrations.
  // These five roots cover every mutable application table through CASCADE.
  await client.unsafe(`
    truncate table
      "user",
      "organization",
      "notification_event",
      "app_rate_limit",
      "verification"
    restart identity cascade
  `);
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("recipe API PostgreSQL integration", () => {
  it("persists recipe CRUD and cascades a deleted user aggregate", async () => {
    const cook = await createUser("Recipe Cook", "recipe-cook@example.test");

    const boxResponse = await authenticatedRequest(cook, "/api/profile/recipe-box", {
      method: "PUT",
      body: { staticRecipeSlugs: ["breakfast-flatbreads"] },
    });
    expect(boxResponse.status).toBe(200);

    const createResponse = await authenticatedRequest(cook, "/recipes", {
      method: "POST",
      body: {
        slug: "integration-stew",
        title: "Integration Stew",
        description: "Created through the real API and database.",
        body: savedRecipeBody("integration-stew", "Integration Stew"),
        visibility: "private",
      },
    });
    expect(createResponse.status).toBe(201);

    const getResponse = await authenticatedRequest(
      cook,
      "/recipes/integration-stew",
    );
    expect(getResponse.status).toBe(200);
    expect(await json<{ title: string }>(getResponse)).toMatchObject({
      title: "Integration Stew",
    });

    const patchResponse = await authenticatedRequest(
      cook,
      "/recipes/integration-stew",
      {
        method: "PATCH",
        body: { title: "Updated Integration Stew" },
      },
    );
    expect(patchResponse.status).toBe(200);
    expect(await json<{ title: string }>(patchResponse)).toMatchObject({
      title: "Updated Integration Stew",
    });

    const deleteResponse = await authenticatedRequest(
      cook,
      "/recipes/integration-stew",
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(204);

    const retainedResponse = await authenticatedRequest(cook, "/recipes", {
      method: "POST",
      body: {
        slug: "cascade-soup",
        title: "Cascade Soup",
        body: savedRecipeBody("cascade-soup", "Cascade Soup"),
        visibility: "private",
      },
    });
    expect(retainedResponse.status).toBe(201);

    await db.delete(schema.user).where(eq(schema.user.id, cook.id));

    expect(
      await db.select().from(schema.account).where(eq(schema.account.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(schema.session).where(eq(schema.session.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(schema.userEmail).where(eq(schema.userEmail.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(schema.recipe).where(eq(schema.recipe.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.userRecipeBox)
        .where(eq(schema.userRecipeBox.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.userRecipeBoxItem)
        .where(eq(schema.userRecipeBoxItem.userId, cook.id)),
    ).toHaveLength(0);
  });

  it("persists household membership and preserves notification snapshots", async () => {
    const owner = await createUser("Household Owner", "owner@example.test");
    const invitee = await createUser("Household Member", "member@example.test");

    const householdResponse = await authenticatedRequest(owner, "/households", {
      method: "POST",
      body: { name: "Integration Household" },
    });
    expect(householdResponse.status).toBe(201);
    const household = await json<{ id: string }>(householdResponse);

    const invitationResponse = await authenticatedRequest(
      owner,
      `/households/${household.id}/invitations`,
      { method: "POST", body: { email: invitee.email } },
    );
    expect(invitationResponse.status).toBe(201);
    const invitation = await json<{ id: string }>(invitationResponse);

    const [invitedEvent] = await db
      .select({ id: schema.notificationEvent.id })
      .from(schema.notificationEvent)
      .innerJoin(
        schema.notificationHouseholdInvitationEvent,
        eq(
          schema.notificationHouseholdInvitationEvent.eventId,
          schema.notificationEvent.id,
        ),
      )
      .where(
        and(
          eq(schema.notificationEvent.kind, "household_invited"),
          eq(
            schema.notificationHouseholdInvitationEvent.invitationId,
            invitation.id,
          ),
        ),
      )
      .limit(1);
    expect(invitedEvent).toBeDefined();

    const acceptResponse = await authenticatedRequest(
      invitee,
      `/households/invitations/${invitation.id}/accept`,
      { method: "POST" },
    );
    expect(acceptResponse.status).toBe(200);
    expect(
      await json<{ membershipCreated: boolean }>(acceptResponse),
    ).toMatchObject({ membershipCreated: true });

    const recipeResponse = await authenticatedRequest(invitee, "/recipes", {
      method: "POST",
      body: {
        slug: "shared-casserole",
        title: "Shared Casserole",
        body: savedRecipeBody("shared-casserole", "Shared Casserole"),
        visibility: "household",
      },
    });
    expect(recipeResponse.status).toBe(201);

    const deleteResponse = await authenticatedRequest(
      owner,
      `/households/${household.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(204);

    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, household.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.organizationId, household.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, invitation.id)),
    ).toHaveLength(0);

    const [privateRecipe] = await db
      .select({ visibility: schema.recipe.visibility })
      .from(schema.recipe)
      .where(eq(schema.recipe.slug, "shared-casserole"));
    expect(privateRecipe?.visibility).toBe("private");

    if (!invitedEvent) throw new Error("Invitation event was not created");
    const [householdSnapshot] = await db
      .select()
      .from(schema.notificationHouseholdEvent)
      .where(eq(schema.notificationHouseholdEvent.eventId, invitedEvent.id));
    const [invitationSnapshot] = await db
      .select()
      .from(schema.notificationHouseholdInvitationEvent)
      .where(
        eq(schema.notificationHouseholdInvitationEvent.eventId, invitedEvent.id),
      );
    expect(householdSnapshot).toMatchObject({
      householdId: null,
      householdNameSnapshot: "Integration Household",
    });
    expect(invitationSnapshot?.invitationId).toBeNull();

    const retainedDeliveries = await db
      .select({ recipientUserId: schema.notificationDelivery.recipientUserId })
      .from(schema.notificationDelivery)
      .where(eq(schema.notificationDelivery.eventId, invitedEvent.id));
    expect(retainedDeliveries).toEqual([{ recipientUserId: invitee.id }]);

    const [deletedEvent] = await db
      .select({ id: schema.notificationEvent.id })
      .from(schema.notificationEvent)
      .innerJoin(
        schema.notificationDelivery,
        eq(schema.notificationDelivery.eventId, schema.notificationEvent.id),
      )
      .where(
        and(
          eq(schema.notificationEvent.kind, "household_deleted"),
          eq(schema.notificationDelivery.recipientUserId, invitee.id),
        ),
      )
      .limit(1);
    expect(deletedEvent).toBeDefined();
    if (!deletedEvent) throw new Error("Household deletion event was not created");

    const [deletedSnapshot] = await db
      .select()
      .from(schema.notificationHouseholdEvent)
      .where(eq(schema.notificationHouseholdEvent.eventId, deletedEvent.id));
    expect(deletedSnapshot).toMatchObject({
      householdId: null,
      householdNameSnapshot: "Integration Household",
    });

    await db
      .delete(schema.notificationEvent)
      .where(eq(schema.notificationEvent.id, invitedEvent.id));
    expect(
      await db
        .select()
        .from(schema.notificationDelivery)
        .where(eq(schema.notificationDelivery.eventId, invitedEvent.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.notificationHouseholdEvent)
        .where(eq(schema.notificationHouseholdEvent.eventId, invitedEvent.id)),
    ).toHaveLength(0);
  });

  it("persists diet settings and cascades an import job graph", async () => {
    const cook = await createUser("Import Cook", "import-cook@example.test");

    const optionsResponse = await authenticatedRequest(
      cook,
      "/api/profile/diet/options",
    );
    expect(optionsResponse.status).toBe(200);
    const options = (await optionsResponse.json()) as {
      groups: Array<{ ingredientSlugs: string[]; key: string }>;
      ingredients: Array<{ slug: string }>;
      presets: Array<{
        excludedGroupKeys: string[];
        excludedIngredientSlugs: string[];
        key: string;
      }>;
    };
    expect(options.ingredients.length).toBeGreaterThan(100);
    expect(options.presets.find((preset) => preset.key === "vegan")).toEqual(
      expect.objectContaining({
        excludedGroupKeys: expect.arrayContaining([
          "meat",
          "poultry",
          "fish",
          "shellfish",
          "dairy",
          "egg",
        ]),
        excludedIngredientSlugs: ["honey"],
      }),
    );
    expect(options.presets.map((preset) => preset.key)).toEqual(
      expect.arrayContaining([
        "vegetarian",
        "vegan",
        "pescatarian",
        "dairy-free",
        "gluten-free",
        "low-fodmap",
      ]),
    );
    const wheat = options.groups.find((group) => group.key === "wheat");
    const gluten = options.groups.find((group) => group.key === "gluten");
    expect(
      options.groups.find((group) => group.key === "poultry")
        ?.ingredientSlugs,
    ).toContain("chicken-breast");
    expect(
      options.groups.find((group) => group.key === "dairy")?.ingredientSlugs,
    ).not.toContain("coconut-milk");
    expect(
      options.groups.find((group) => group.key === "dairy")?.ingredientSlugs,
    ).toEqual(
      expect.arrayContaining([
        "milk-chocolate",
        "white-chocolate",
        "white-chocolate-chips",
      ]),
    );
    expect(
      options.groups.find((group) => group.key === "onion")?.ingredientSlugs,
    ).toContain("shallots");
    expect(
      options.groups.find((group) => group.key === "garlic")?.ingredientSlugs,
    ).toContain("garlic-powder");
    expect(
      options.groups.find((group) => group.key === "peanut")
        ?.ingredientSlugs,
    ).toContain("crunchy-peanut-butter");
    expect(wheat?.ingredientSlugs).toContain("spaghetti");
    expect(gluten?.ingredientSlugs).toContain("spaghetti");

    const diet = {
      presetDietKeys: ["vegan"],
      excludedIngredientSlugs: ["honey"],
      excludedGroupKeys: ["shellfish"],
      recipeMatchMode: "warn",
    };
    const putDietResponse = await authenticatedRequest(
      cook,
      "/api/profile/diet",
      { method: "PUT", body: diet },
    );
    expect(putDietResponse.status).toBe(200);
    expect(await putDietResponse.json()).toEqual(diet);

    const getDietResponse = await authenticatedRequest(
      cook,
      "/api/profile/diet",
    );
    expect(getDietResponse.status).toBe(200);
    expect(await getDietResponse.json()).toEqual(diet);
    expect(
      await db
        .select()
        .from(schema.userDietPreset)
        .where(eq(schema.userDietPreset.userId, cook.id)),
    ).toEqual([
      expect.objectContaining({ presetKey: "vegan", userId: cook.id }),
    ]);
    expect(
      await db
        .select()
        .from(schema.userDietExcludedIngredient)
        .where(eq(schema.userDietExcludedIngredient.userId, cook.id)),
    ).toEqual([
      expect.objectContaining({ ingredientSlug: "honey", userId: cook.id }),
    ]);
    expect(
      await db
        .select()
        .from(schema.userDietExcludedGroup)
        .where(eq(schema.userDietExcludedGroup.userId, cook.id)),
    ).toEqual([
      expect.objectContaining({ groupKey: "shellfish", userId: cook.id }),
    ]);

    const artifactPut = vi.fn(async () => undefined);
    const workflowCreate = vi.fn(async () => undefined);
    const importEnv: Bindings = {
      ...baseEnv,
      ARTIFACTS: {
        put: artifactPut,
      } as unknown as R2Bucket,
      RECIPE_INGEST_WORKFLOW: {
        create: workflowCreate,
      } as unknown as Workflow,
    };
    const form = new FormData();
    form.append(
      "images",
      new File(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
          ]),
        ],
        "recipe.png",
        { type: "image/png" },
      ),
    );
    const importResponse = await app.request(
      "/recipe-imports",
      {
        method: "POST",
        headers: { cookie: cook.cookie, origin: authOrigin },
        body: form,
      },
      importEnv,
    );
    expect(importResponse.status).toBe(202);
    const importJob = await json<{ id: string }>(importResponse);
    expect(artifactPut).toHaveBeenCalledOnce();
    expect(workflowCreate).toHaveBeenCalledWith({
      id: importJob.id,
      params: { jobId: importJob.id },
    });
    expect(
      await db
        .select({ count: schema.appRateLimit.count })
        .from(schema.appRateLimit)
        .where(eq(schema.appRateLimit.key, `recipe-photo-import:${cook.id}`)),
    ).toEqual([{ count: 1 }]);

    await db.insert(schema.recipeImportArtifact).values({
      jobId: importJob.id,
      stage: "extract",
      kind: "source-manifest",
      r2Key: `imports/${importJob.id}/extract/source-manifest.json`,
      checksum: "integration-checksum",
    });
    await db.insert(schema.recipeImportAttempt).values({
      jobId: importJob.id,
      stage: "extract",
      attempt: 1,
      succeeded: true,
    });

    const importStatusResponse = await authenticatedRequest(
      cook,
      `/recipe-imports/${importJob.id}`,
    );
    expect(importStatusResponse.status).toBe(200);
    expect(
      await json<{ artifacts: Array<{ kind: string }> }>(importStatusResponse),
    ).toMatchObject({ artifacts: [{ kind: "source-manifest" }] });

    await db
      .delete(schema.recipeImportJob)
      .where(eq(schema.recipeImportJob.id, importJob.id));
    expect(
      await db
        .select()
        .from(schema.recipeImportArtifact)
        .where(eq(schema.recipeImportArtifact.jobId, importJob.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.recipeImportAttempt)
        .where(eq(schema.recipeImportAttempt.jobId, importJob.id)),
    ).toHaveLength(0);

    await db.delete(schema.user).where(eq(schema.user.id, cook.id));
    expect(
      await db
        .select()
        .from(schema.userDietProfile)
        .where(eq(schema.userDietProfile.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.userDietPreset)
        .where(eq(schema.userDietPreset.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.userDietExcludedIngredient)
        .where(eq(schema.userDietExcludedIngredient.userId, cook.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.userDietExcludedGroup)
        .where(eq(schema.userDietExcludedGroup.userId, cook.id)),
    ).toHaveLength(0);
  });
});
