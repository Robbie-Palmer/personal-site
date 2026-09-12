import { count, desc } from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";
import { SavedRecipePayloadSchema } from "recipe-domain/serialization";
import { readableRecipeFilter } from "./recipe-access";

type DatasetInspectionOptions = {
  sampleSize: number;
  top: number;
};

type Frequency = {
  label: string;
  recipes: Set<string>;
};

function recordFrequency(
  frequencies: Map<string, Frequency>,
  label: string,
  recipeId: string,
) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const key = trimmed.toLocaleLowerCase("en-US");
  const frequency = frequencies.get(key) ?? {
    label: trimmed,
    recipes: new Set<string>(),
  };
  frequency.recipes.add(recipeId);
  frequencies.set(key, frequency);
}

function topFrequencies(
  frequencies: Map<string, Frequency>,
  limit: number,
  labelKey: "cuisine" | "ingredient",
) {
  return [...frequencies.values()]
    .map(({ label, recipes }) => ({
      [labelKey]: label,
      recipeCount: recipes.size,
    }))
    .sort(
      (left, right) =>
        right.recipeCount - left.recipeCount ||
        String(left[labelKey]).localeCompare(String(right[labelKey])),
    )
    .slice(0, limit);
}

export async function inspectRecipeDataset(
  db: Db,
  userId: string,
  options: DatasetInspectionOptions,
) {
  return db.transaction(
    async (tx) => {
      const visibilityFilter = await readableRecipeFilter(tx, userId);
      const visibilityRows = await tx
        .select({ visibility: schema.recipe.visibility, value: count() })
        .from(schema.recipe)
        .where(visibilityFilter)
        .groupBy(schema.recipe.visibility);
      const visibility = { public: 0, household: 0, private: 0 };
      for (const row of visibilityRows) {
        visibility[row.visibility] = Number(row.value);
      }
      const visibleRecipes = Object.values(visibility).reduce(
        (total, value) => total + value,
        0,
      );

      const rows = await tx
        .select({
          id: schema.recipe.id,
          body: schema.recipe.body,
        })
        .from(schema.recipe)
        .where(visibilityFilter)
        .orderBy(desc(schema.recipe.updatedAt), desc(schema.recipe.id))
        .limit(options.sampleSize);

      const parseQuality = {
        validPayloads: 0,
        invalidPayloads: 0,
        withInstructionSdk: 0,
      };
      const provenance = { withCanonicalUrl: 0, withoutCanonicalUrl: 0 };
      const coverage = {
        withCuisine: 0,
        withIngredients: 0,
        withCookware: 0,
      };
      const ingredients = new Map<string, Frequency>();
      const cuisines = new Map<string, Frequency>();

      for (const row of rows) {
        let decoded: unknown;
        try {
          decoded = row.body ? JSON.parse(row.body) : undefined;
        } catch {
          parseQuality.invalidPayloads += 1;
          continue;
        }
        const payload = SavedRecipePayloadSchema.safeParse(decoded);
        if (!payload.success) {
          parseQuality.invalidPayloads += 1;
          continue;
        }

        parseQuality.validPayloads += 1;
        if (payload.data.recipe.instructionSdk) {
          parseQuality.withInstructionSdk += 1;
        }
        if (payload.data.recipe.canonical) provenance.withCanonicalUrl += 1;
        else provenance.withoutCanonicalUrl += 1;

        const recipeIngredients = new Set(
          payload.data.recipe.ingredientGroups.flatMap((group) =>
            group.items.map((item) => item.ingredient),
          ),
        );
        if (recipeIngredients.size > 0) coverage.withIngredients += 1;
        if (payload.data.recipe.cuisine.length > 0) coverage.withCuisine += 1;
        if (payload.data.recipe.cookware.length > 0) coverage.withCookware += 1;

        for (const ingredient of recipeIngredients) {
          recordFrequency(ingredients, ingredient, row.id);
        }
        for (const cuisine of new Set(payload.data.recipe.cuisine)) {
          recordFrequency(cuisines, cuisine, row.id);
        }
      }

      return {
        population: {
          visibleRecipes,
          sampledRecipes: rows.length,
          truncated: rows.length < visibleRecipes,
        },
        visibility,
        sample: {
          parseQuality,
          provenance,
          coverage,
          ingredients: {
            distinct: ingredients.size,
            top: topFrequencies(ingredients, options.top, "ingredient"),
          },
          cuisines: {
            distinct: cuisines.size,
            top: topFrequencies(cuisines, options.top, "cuisine"),
          },
        },
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}
