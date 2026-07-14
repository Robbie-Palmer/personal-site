import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "recipe-db";
import {
  dietCatalogIngredients,
  dietGroupMembers,
  dietPresetIngredientExclusions,
} from "./diet-catalog";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const { client } = createDb(databaseURL);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "seed-diet-catalog.sql");
const statement = await readFile(seedPath, "utf8");

try {
  await client.unsafe(statement);
  await client.begin(async (sql) => {
    for (const ingredient of dietCatalogIngredients) {
      await sql`
        insert into "ingredient" ("slug", "name", "category")
        values (${ingredient.slug}, ${ingredient.name}, ${ingredient.category ?? null})
        on conflict ("slug") do update set
          "name" = excluded."name",
          "category" = excluded."category",
          "updated_at" = now()
      `;
    }

    await sql`delete from "ingredient_group_member"`;
    for (const member of dietGroupMembers) {
      await sql`
        insert into "ingredient_group_member" ("group_key", "ingredient_slug")
        values (${member.groupKey}, ${member.ingredientSlug})
      `;
    }

    await sql`delete from "diet_preset_excluded_ingredient"`;
    for (const exclusion of dietPresetIngredientExclusions) {
      await sql`
        insert into "diet_preset_excluded_ingredient" ("preset_key", "ingredient_slug")
        values (${exclusion.presetKey}, ${exclusion.ingredientSlug})
        on conflict ("preset_key", "ingredient_slug") do nothing
      `;
    }
  });
  console.log("Seeded diet catalog.");
} finally {
  await client.end({ timeout: 5 });
}
