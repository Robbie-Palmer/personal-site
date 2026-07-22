import {
  formatRecipeMarkdown,
  type SavedRecipePayload,
  SavedRecipePayloadSchema,
} from "recipe-domain/serialization";

export interface PublicRecipeEnv {
  RECIPE_API_URL?: string;
}

export type StoredRecipe = {
  slug: string;
  title: string;
  description: string | null;
  body: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RecipePayload = SavedRecipePayload;

const API_TIMEOUT_MS = 5_000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStoredRecipe(value: unknown): value is StoredRecipe {
  return (
    isRecord(value) &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    (value.description === null || typeof value.description === "string") &&
    (value.body === null || typeof value.body === "string") &&
    isOptionalString(value.createdAt) &&
    isOptionalString(value.updatedAt)
  );
}

async function fetchApiJson(url: URL): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function decodeRecipePayload(record: StoredRecipe): RecipePayload | null {
  if (!record.body) return null;
  try {
    const payload: unknown = JSON.parse(record.body);
    const parsed = SavedRecipePayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadPublicRecipe(
  env: PublicRecipeEnv,
  slug: string,
): Promise<{ record: StoredRecipe; payload: RecipePayload } | null> {
  if (!env.RECIPE_API_URL) return null;
  const result = await fetchApiJson(
    new URL(`/recipes/${slug}`, env.RECIPE_API_URL),
  );
  if (!isStoredRecipe(result)) return null;
  const payload = decodeRecipePayload(result);
  return payload ? { record: result, payload } : null;
}

export async function listPublicRecipes(
  env: PublicRecipeEnv,
): Promise<StoredRecipe[] | null> {
  if (!env.RECIPE_API_URL) return null;
  const recipes: StoredRecipe[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
    const apiUrl = new URL("/recipes", env.RECIPE_API_URL);
    apiUrl.searchParams.set("limit", String(PAGE_LIMIT));
    if (cursor) apiUrl.searchParams.set("cursor", cursor);
    const result = await fetchApiJson(apiUrl);
    if (!isRecord(result) || !Array.isArray(result.items)) return null;
    recipes.push(...result.items.filter(isStoredRecipe));

    const nextCursor = result.nextCursor;
    if (nextCursor === null) return recipes;
    if (typeof nextCursor !== "string" || seenCursors.has(nextCursor)) {
      return null;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  return null;
}

export function recipeMarkdown(payload: RecipePayload): string {
  return formatRecipeMarkdown(payload.recipe);
}
