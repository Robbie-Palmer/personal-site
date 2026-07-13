import type { ExtractionRecipe } from "../schemas/stage-artifacts.js";
import { buildCooklangDraftFromExtraction } from "./cooklang.js";

export type SchemaOrgRecipeImport = {
  title: string;
  description: string;
  cuisine: string;
  servings: number;
  prepTime?: number;
  cookTime?: number;
  source: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (isObject(value)) return text(value.name ?? value.text ?? value.value);
  return undefined;
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      let codePoint: number | undefined;
      if (entity.startsWith("#x")) {
        codePoint = Number.parseInt(entity.slice(2), 16);
      } else if (entity.startsWith("#")) {
        codePoint = Number.parseInt(entity.slice(1), 10);
      }
      if (codePoint !== undefined) {
        return Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return entities[entity.toLowerCase()] ?? match;
    },
  );
}

function plainText(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  return decodeHtml(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function isRecipeType(value: unknown): boolean {
  return values(value).some((entry) => {
    const type = text(entry)?.toLowerCase().replace(/\/$/, "");
    return type === "recipe" || type?.endsWith("schema.org/recipe");
  });
}

function findRecipe(value: unknown): JsonObject | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const recipe = findRecipe(entry);
      if (recipe) return recipe;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  if (isRecipeType(value["@type"])) return value;

  for (const key of [
    "@graph",
    "mainEntity",
    "mainEntityOfPage",
    "itemListElement",
  ]) {
    const recipe = findRecipe(value[key]);
    if (recipe) return recipe;
  }
  return undefined;
}

function durationMinutes(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const match = raw.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
  );
  if (!match) return undefined;
  const minutes =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0) +
    Number(match[4] ?? 0) / 60;
  return minutes > 0 ? Math.round(minutes) : undefined;
}

function servings(value: unknown): number {
  for (const entry of values(value)) {
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      return Math.max(1, Math.round(entry));
    }
    const match = text(entry)?.match(/\d+(?:\.\d+)?/);
    if (match) return Math.max(1, Math.round(Number(match[0])));
  }
  return 1;
}

function instructionLines(value: unknown): string[] {
  const lines: string[] = [];
  for (const entry of values(value)) {
    if (typeof entry === "string") {
      const line = plainText(entry);
      if (line) lines.push(line);
      continue;
    }
    if (!isObject(entry)) continue;
    const nested = entry.itemListElement ?? entry.steps;
    if (nested) lines.push(...instructionLines(nested));
    else {
      const line = plainText(entry.text ?? entry.name);
      if (line) lines.push(line);
    }
  }
  return lines;
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern =
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json(?:\s*;[^"']*)?["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    const source = match[1]?.trim();
    if (!source) continue;
    try {
      blocks.push(JSON.parse(source));
    } catch {
      // Pages commonly contain unrelated malformed JSON-LD. Keep looking for
      // a valid Recipe block before reporting that the page is unsupported.
    }
  }
  return blocks;
}

export function parseSchemaOrgRecipeHtml(
  html: string,
): SchemaOrgRecipeImport | null {
  let recipe: JsonObject | undefined;
  for (const block of jsonLdBlocks(html)) {
    recipe = findRecipe(block);
    if (recipe) break;
  }
  if (!recipe) return null;

  const title = plainText(recipe.name)?.slice(0, 120).trim();
  const ingredients = values(recipe.recipeIngredient ?? recipe.ingredients)
    .map(plainText)
    .filter((value): value is string => Boolean(value));
  const instructions = instructionLines(recipe.recipeInstructions);
  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return null;
  }

  const description =
    (
      plainText(recipe.description) ??
      `Recipe for ${title}, imported from the web.`
    )
      .slice(0, 500)
      .trim();
  const cuisine =
    values(recipe.recipeCuisine).map(plainText).find(Boolean) ?? "";
  const extraction: ExtractionRecipe = {
    title,
    description,
    cuisine: cuisine ? [cuisine] : [],
    servings: String(servings(recipe.recipeYield)),
    prepTime: durationMinutes(recipe.prepTime)?.toString(),
    cookTime: durationMinutes(recipe.cookTime)?.toString(),
    ingredientGroups: [{ lines: ingredients }],
    instructions,
    equipment: values(recipe.tool)
      .map(plainText)
      .filter((value): value is string => Boolean(value)),
  };
  const cooklang = buildCooklangDraftFromExtraction(extraction);
  if (!cooklang.derived) return null;

  return {
    title,
    description,
    cuisine,
    servings: cooklang.frontmatter.servings ?? 1,
    prepTime: cooklang.frontmatter.prepTime,
    cookTime: cooklang.frontmatter.cookTime,
    source: cooklang.body,
  };
}
