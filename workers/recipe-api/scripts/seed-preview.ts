import { eq, inArray } from "drizzle-orm";
import { createAuth } from "../src/auth";
import { createDb, schema } from "recipe-db";
import { previewScenarios } from "../src/preview-scenarios";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const betterAuthURL = requiredEnv("BETTER_AUTH_URL");
const betterAuthSecret = requiredEnv("BETTER_AUTH_SECRET");
const previewPassword = requiredEnv("PREVIEW_AUTH_PASSWORD");

const { db, client } = createDb(databaseURL);

try {
  const auth = createAuth(
    db,
    {
      DEPLOYMENT_ENV: "preview",
      BETTER_AUTH_URL: betterAuthURL,
      BETTER_AUTH_SECRET: betterAuthSecret,
    },
    { allowPreviewSignUp: true },
  );

  for (const scenario of previewScenarios) {
    const [existingUser] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, scenario.email))
      .limit(1);

    if (!existingUser) {
      await auth.api.signUpEmail({
        body: {
          name: scenario.name,
          email: scenario.email,
          password: previewPassword,
        },
      });
    }

    await db
      .update(schema.user)
      .set({
        name: scenario.name,
        role: scenario.role,
        emailVerified: true,
      })
      .where(eq(schema.user.email, scenario.email));
  }

  const seededUsers = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(
      inArray(
        schema.user.email,
        previewScenarios.map((scenario) => scenario.email),
      ),
    );
  const userIdByEmail = new Map(
    seededUsers.map((seededUser) => [seededUser.email, seededUser.id]),
  );
  const recipesUserId = userIdByEmail.get("recipes-user@preview.invalid");
  const adminUserId = userIdByEmail.get("admin-user@preview.invalid");
  if (!recipesUserId || !adminUserId) {
    throw new Error("Preview users were not created correctly");
  }

  await db
    .insert(schema.recipe)
    .values([
      {
        slug: "preview-private-weeknight-pasta",
        title: "Preview Weeknight Pasta",
        description: "Private fixture for authenticated recipe QA.",
        body: "Cook the @pasta{200%g}, then combine with @tomato sauce{150%g}.",
        userId: recipesUserId,
        visibility: "private",
      },
      {
        slug: "preview-public-tomato-toast",
        title: "Preview Tomato Toast",
        description: "Public fixture for visibility and listing QA.",
        body: "Toast the @bread{2%slices} and top with @tomato{1}.",
        userId: recipesUserId,
        visibility: "public",
      },
      {
        slug: "preview-admin-soup",
        title: "Preview Admin Soup",
        description: "Administrator-owned fixture.",
        body: "Simmer @stock{500%ml} with @vegetables{300%g}.",
        userId: adminUserId,
        visibility: "private",
      },
    ])
    .onConflictDoNothing({ target: schema.recipe.slug });

  console.log(`Seeded ${previewScenarios.length} preview scenarios.`);
} finally {
  await client.end({ timeout: 5 });
}
