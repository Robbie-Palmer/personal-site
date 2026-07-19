import { eq, inArray } from "drizzle-orm";
import { createAuth } from "../src/auth";
import { createDb, schema } from "recipe-db";
import { RecipeContentSchema } from "recipe-domain";
import { previewScenarios } from "../src/preview-scenarios";
import { syncCanonicalUserEmail } from "../src/user-emails";

function previewRecipeBody(
  slug: string,
  title: string,
  description: string,
  cookBody: string,
  ingredients: Array<{ ingredient: string; amount: number; unit?: string }>,
  instructions: string[],
): string {
  const recipe = RecipeContentSchema.parse({
    slug,
    title,
    description,
    cookBody,
    date: "2026-07-15",
    cuisine: [],
    servings: 2,
    tags: [],
    cookware: [],
    ingredientGroups: [{ items: ingredients }],
    instructions,
  });
  return JSON.stringify({ version: 1, source: cookBody, recipe });
}

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
    .select({
      id: schema.user.id,
      email: schema.user.email,
      emailVerified: schema.user.emailVerified,
    })
    .from(schema.user)
    .where(
      inArray(
        schema.user.email,
        previewScenarios.map((scenario) => scenario.email),
      ),
    );
  await Promise.all(
    seededUsers.map((seededUser) =>
      syncCanonicalUserEmail(db, seededUser),
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

  const previewRecipes: Array<typeof schema.recipe.$inferInsert> = [
    {
        slug: "preview-private-weeknight-pasta",
        title: "Preview Weeknight Pasta",
        description: "Private fixture for authenticated recipe QA.",
        body: previewRecipeBody(
          "preview-private-weeknight-pasta",
          "Preview Weeknight Pasta",
          "Private fixture for authenticated recipe QA.",
          "Cook the @pasta{200%g}, then combine with @tomato sauce{150%g}.",
          [
            { ingredient: "pasta", amount: 200, unit: "g" },
            { ingredient: "tomato-sauce", amount: 150, unit: "g" },
          ],
          ["Cook the pasta, then combine with tomato sauce."],
        ),
        userId: recipesUserId,
        visibility: "private",
    },
    {
        slug: "preview-public-tomato-toast",
        title: "Preview Tomato Toast",
        description: "Public fixture for visibility and listing QA.",
        body: previewRecipeBody(
          "preview-public-tomato-toast",
          "Preview Tomato Toast",
          "Public fixture for visibility and listing QA.",
          "Toast the @bread{2%slices} and top with @tomato{1}.",
          [
            { ingredient: "bread", amount: 2 },
            { ingredient: "tomato", amount: 1 },
          ],
          ["Toast the bread and top with tomato."],
        ),
        userId: recipesUserId,
        visibility: "public",
    },
    {
        slug: "preview-admin-soup",
        title: "Preview Admin Soup",
        description: "Administrator-owned fixture.",
        body: previewRecipeBody(
          "preview-admin-soup",
          "Preview Admin Soup",
          "Administrator-owned fixture.",
          "Simmer @stock{500%ml} with @vegetables{300%g}.",
          [
            { ingredient: "stock", amount: 500, unit: "ml" },
            { ingredient: "vegetables", amount: 300, unit: "g" },
          ],
          ["Simmer the stock with the vegetables."],
        ),
        userId: adminUserId,
        visibility: "private",
    },
  ];

  for (const previewRecipe of previewRecipes) {
    await db
      .insert(schema.recipe)
      .values(previewRecipe)
      .onConflictDoUpdate({
        target: schema.recipe.slug,
        set: previewRecipe,
      });
  }

  console.log(`Seeded ${previewScenarios.length} preview scenarios.`);
} finally {
  await client.end({ timeout: 5 });
}
