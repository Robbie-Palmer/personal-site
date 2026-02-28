import { ingredients as definedIngredients } from "../../../content/recipes/ingredients";
import { loadRecipesFromCookFiles } from "../../content/cooklang";
import { normalizeSlug } from "../../generic/slugs";
import {
  type Ingredient,
  type IngredientSlug,
  resolveIngredientSlug,
} from "./ingredient";
import type { Recipe, RecipeSlug } from "./recipe";
import {
  buildRecipeContentGraph,
  type RecipeContentGraph,
} from "./recipeGraph";

export interface RecipeRepository {
  recipes: Map<RecipeSlug, Recipe>;
  ingredients: Map<IngredientSlug, Ingredient>;
  graph: RecipeContentGraph;
}

function loadIngredients(): Map<IngredientSlug, Ingredient> {
  const map = new Map<IngredientSlug, Ingredient>();
  for (const content of definedIngredients) {
    const slug = resolveIngredientSlug(content);
    const existing = map.get(slug);
    if (existing) {
      throw new Error(
        `Duplicate ingredient slug "${slug}": "${existing.name}" and "${content.name}" both resolve to the same slug`,
      );
    }
    map.set(slug, { ...content, slug });
  }
  return map;
}

function loadRecipes(): Map<RecipeSlug, Recipe> {
  const map = new Map<RecipeSlug, Recipe>();
  for (const content of loadRecipesFromCookFiles()) {
    const slug = (content.slug || normalizeSlug(content.title)) as RecipeSlug;
    const existing = map.get(slug);
    if (existing) {
      throw new Error(
        `Duplicate recipe slug "${slug}": "${existing.title}" and "${content.title}" both resolve to the same slug`,
      );
    }
    const recipe: Recipe = { ...content, slug };
    map.set(slug, recipe);
  }
  return map;
}

function extractIngredientSlugs(recipe: Recipe): IngredientSlug[] {
  const slugs = new Set<IngredientSlug>();
  for (const group of recipe.ingredientGroups) {
    for (const item of group.items) {
      slugs.add(item.ingredient);
    }
  }
  return Array.from(slugs);
}

function validateIngredientReferences(
  recipes: Map<RecipeSlug, Recipe>,
  ingredients: Map<IngredientSlug, Ingredient>,
): void {
  const missing = new Set<string>();

  for (const [recipeSlug, recipe] of recipes) {
    for (const group of recipe.ingredientGroups) {
      for (const item of group.items) {
        if (!ingredients.has(item.ingredient)) {
          missing.add(
            `"${item.ingredient}" (referenced in recipe: ${recipeSlug})`,
          );
        }
      }
    }
  }

  if (missing.size > 0) {
    const errorMessage = [
      "\n❌ ERROR: The following ingredients are referenced but not defined in content/recipes/ingredients.ts:",
      "",
      ...Array.from(missing)
        .sort()
        .map((item) => `  - ${item}`),
      "",
      "Please add these ingredients to content/recipes/ingredients.ts",
      "",
    ].join("\n");
    throw new Error(errorMessage);
  }
}

let cachedRepository: RecipeRepository | null = null;

export function loadRecipeRepository(): RecipeRepository {
  if (cachedRepository) return cachedRepository;

  const ingredients = loadIngredients();
  const recipes = loadRecipes();

  validateIngredientReferences(recipes, ingredients);

  const recipeIngredients = new Map<RecipeSlug, IngredientSlug[]>();
  const recipeCuisines = new Map<RecipeSlug, string>();

  for (const [slug, recipe] of recipes) {
    recipeIngredients.set(slug, extractIngredientSlugs(recipe));
    if (recipe.cuisine) {
      recipeCuisines.set(slug, recipe.cuisine);
    }
  }

  const graph = buildRecipeContentGraph({
    ingredientSlugs: ingredients.keys(),
    recipeIngredients,
    recipeCuisines,
  });

  cachedRepository = { recipes, ingredients, graph };
  return cachedRepository;
}
