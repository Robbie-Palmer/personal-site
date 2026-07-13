import type { CooklangRecipe as ParsedCooklangRecipe } from "@cooklang/cooklang";
import { buildRecipeContentFromParsed } from "@/lib/domain/recipe/cooklangTransform";
import {
  type RecipeContent,
  RecipeContentSchema,
} from "@/lib/domain/recipe/recipe";
import type {
  RecipeCardView,
  RecipeDetailView,
} from "@/lib/domain/recipe/recipeViews";
import { normalizeSlug } from "@/lib/generic/slugs";

export type RecipeDraftMetadata = {
  title: string;
  description: string;
  servings: number;
  prepTime?: number;
  cookTime?: number;
  cuisine?: string;
  canonical?: string;
};

export type SavedRecipePayload = {
  version: 1;
  source: string;
  recipe: RecipeContent;
};

export type SavedRecipeApiRecord = {
  slug: string;
  title: string;
  description: string | null;
  body: string | null;
  visibility: "public" | "private" | "household";
  createdAt: string;
  updatedAt: string;
};

export function normalizeRecipeSource(source: string): string {
  return source.trim();
}

function displayName(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildRecipeDraft(
  parsed: ParsedCooklangRecipe,
  metadata: RecipeDraftMetadata,
  source: string,
): RecipeDetailView {
  const slug = normalizeSlug(metadata.title);
  const cookBody = normalizeRecipeSource(source);
  const content: RecipeContent = buildRecipeContentFromParsed(
    parsed,
    {
      title: metadata.title.trim(),
      description: metadata.description.trim(),
      date: new Date().toISOString().slice(0, 10),
      cuisine: metadata.cuisine?.trim() ? [metadata.cuisine.trim()] : [],
      servings: metadata.servings,
      prepTime: metadata.prepTime,
      cookTime: metadata.cookTime,
      canonical: metadata.canonical,
      tags: [],
    },
    slug,
    cookBody,
  );
  return recipeContentToDetail(content, slug);
}

function recipeContentToDetail(
  content: RecipeContent,
  slug: string,
): RecipeDetailView {
  const ingredientNames = new Map<string, string>();
  content.instructionSdk?.ingredientNames.forEach((name, index) => {
    ingredientNames.set(
      normalizeSlug(name),
      content.instructionSdk?.ingredientDisplayValues[index] ?? name,
    );
  });
  const totalTime =
    content.prepTime != null && content.cookTime != null
      ? content.prepTime + content.cookTime
      : (content.prepTime ?? content.cookTime);

  return {
    slug,
    title: content.title,
    description: content.description,
    date: content.date,
    cuisine: content.cuisine,
    tags: content.tags,
    servings: content.servings,
    prepTime: content.prepTime,
    cookTime: content.cookTime,
    totalTime,
    cookBody: content.cookBody,
    cookware: content.cookware,
    ingredientGroups: content.ingredientGroups.map((group) => ({
      name: group.name,
      items: group.items.map((item) => ({
        ...item,
        name:
          ingredientNames.get(item.ingredient) ?? displayName(item.ingredient),
      })),
    })),
    instructions: content.instructions,
    instructionSdk: content.instructionSdk,
  };
}

export function serializeSavedRecipe(
  source: string,
  recipe: RecipeDetailView,
): string {
  return JSON.stringify({
    version: 1,
    source,
    recipe: RecipeContentSchema.parse(recipe),
  } satisfies SavedRecipePayload);
}

export function parseSavedRecipe(
  record: SavedRecipeApiRecord,
): RecipeDetailView | null {
  if (!record.body) return null;
  try {
    const payload = JSON.parse(record.body) as Partial<SavedRecipePayload>;
    if (payload.version !== 1 || !payload.recipe) return null;
    const parsed = RecipeContentSchema.safeParse(payload.recipe);
    if (!parsed.success) return null;
    return recipeContentToDetail(parsed.data, record.slug);
  } catch {
    return null;
  }
}

export type RecipeGridItem = RecipeCardView & {
  href?: string;
  saved?: boolean;
};

export function savedRecipeCard(
  record: SavedRecipeApiRecord,
): RecipeGridItem | null {
  const recipe = parseSavedRecipe(record);
  if (!recipe) return null;
  const ingredientNames = Array.from(
    new Set(
      recipe.ingredientGroups.flatMap((group) =>
        group.items.map((item) => item.name),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const ingredientSlugs = Array.from(
    new Set(
      recipe.ingredientGroups.flatMap((group) =>
        group.items.map((item) => item.ingredient),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  return {
    ...recipe,
    ingredientNames,
    ingredientSlugs,
    href: `/recipes/saved?slug=${encodeURIComponent(record.slug)}`,
    saved: true,
  };
}
