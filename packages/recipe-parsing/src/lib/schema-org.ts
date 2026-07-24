import * as cheerio from "cheerio";
import { scrapeRecipe } from "recipe-scrapers";
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

export type SchemaOrgRecipeFileImport = SchemaOrgRecipeImport & {
  url?: string;
};

function servings(value: string): string {
  return /\d+(?:\.\d+)?/.exec(value)?.[0] ?? "1";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRecipeType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some(
    (type) =>
      typeof type === "string" && /(?:^|\/)Recipe\/?$/i.test(type.trim()),
  );
}

function findRecipeObject(value: unknown): Record<string, unknown> | undefined {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (Array.isArray(candidate)) {
      for (let index = candidate.length - 1; index >= 0; index--) {
        pending.push(candidate[index]);
      }
      continue;
    }
    if (!isRecord(candidate)) continue;
    if (isRecipeType(candidate["@type"])) return candidate;
    const children = Object.values(candidate);
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push(children[index]);
    }
  }
  return undefined;
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function recipeCanonicalUrl(
  recipe: Record<string, unknown> | undefined,
): string | undefined {
  if (!recipe) return undefined;
  const directUrl = httpUrl(recipe.url);
  if (directUrl) return directUrl;
  if (isRecord(recipe.isBasedOn)) return httpUrl(recipe.isBasedOn.url);
  return httpUrl(recipe.isBasedOn);
}

function unwrapJsonLd(source: string): string {
  let cleaned = source.trim();
  if (cleaned.startsWith("<!--")) cleaned = cleaned.slice(4).trimStart();
  if (cleaned.endsWith("--!>")) cleaned = cleaned.slice(0, -4).trimEnd();
  else if (cleaned.endsWith("-->")) cleaned = cleaned.slice(0, -3).trimEnd();
  if (cleaned.startsWith("//<![CDATA[")) {
    cleaned = cleaned.slice("//<![CDATA[".length).trimStart();
  }
  if (cleaned.endsWith("//]]>")) {
    cleaned = cleaned.slice(0, -"//]]>".length).trimEnd();
  }
  return cleaned;
}

function normalizeRecipeMarkup(html: string, url: string): string {
  const $ = cheerio.load(html);
  $("script[type='application/ld+json']").each((_, element) => {
    const rawSource = $(element).html();
    const source = rawSource ? unwrapJsonLd(rawSource) : "";
    if (!source) return;

    try {
      const data: unknown = JSON.parse(source);
      const pending: unknown[] = [data];
      while (pending.length > 0) {
        const value = pending.pop();
        if (Array.isArray(value)) {
          pending.push(...value);
          continue;
        }
        if (!isRecord(value)) continue;
        const object = value;
        const types = Array.isArray(object["@type"])
          ? object["@type"]
          : [object["@type"]];
        const recipeIndex = types.findIndex(
          (type) => typeof type === "string" && /(?:^|\/)Recipe\/?$/i.test(type),
        );
        if (recipeIndex >= 0) {
          object["@type"] = [
            "Recipe",
            ...types.filter(
              (type, index) => index !== recipeIndex && type !== "Recipe",
            ),
          ];
          object.author ??= "Imported recipe";
          const recipeName =
            typeof object.name === "string" ? object.name : "this dish";
          object.description ??= `Recipe for ${recipeName}, imported from the web.`;
          object.image ??= url;
          object.recipeYield ??= "1 serving";
        }
        pending.push(...Object.values(object));
      }
      $(element).text(JSON.stringify(data));
    } catch {
      // recipe-scrapers can recover some malformed JSON-LD itself.
    }
  });
  return $.html();
}

/**
 * Extract a recipe with recipe-scrapers, then convert its normalized fields to
 * the extraction shape shared by the rest of our Cooklang import pipeline.
 */
export async function parseSchemaOrgRecipeHtml(
  html: string,
  url = "https://example.com/recipe",
): Promise<SchemaOrgRecipeImport | null> {
  const result = await scrapeRecipe(normalizeRecipeMarkup(html, url), url, {
    safeParse: true,
  });
  if (!result.success) return null;

  const recipe = result.data;
  const ingredientGroups = recipe.ingredients
    .map((group) => ({
      name: group.name ?? undefined,
      lines: group.items.map((item) => item.value),
    }))
    .filter((group) => group.lines.length > 0);
  const instructions = recipe.instructions.flatMap((group) =>
    group.items.map((item) => item.value),
  );
  if (!recipe.title || ingredientGroups.length === 0 || instructions.length === 0) {
    return null;
  }

  const title = recipe.title.slice(0, 120).trim();
  const cuisine = recipe.cuisine[0] ?? "";
  const description =
    recipe.description || `Recipe for ${recipe.title}, imported from the web.`;
  const normalizedDescription = description.slice(0, 500).trim();
  const extraction: ExtractionRecipe = {
    title,
    description: normalizedDescription,
    cuisine: cuisine ? [cuisine] : [],
    servings: servings(recipe.yields),
    prepTime: recipe.prepTime?.toString(),
    cookTime: recipe.cookTime?.toString(),
    ingredientGroups,
    instructions,
    equipment: recipe.equipment,
  };
  const cooklang = buildCooklangDraftFromExtraction(extraction);
  if (!cooklang.derived) return null;

  return {
    title,
    description: normalizedDescription,
    cuisine,
    servings: cooklang.frontmatter.servings ?? 1,
    prepTime: cooklang.frontmatter.prepTime,
    cookTime: cooklang.frontmatter.cookTime,
    source: cooklang.body,
  };
}

/**
 * Parse a standalone schema.org JSON-LD document. Recipe apps commonly
 * exchange either a single Recipe object, a top-level array, or an @graph.
 */
export async function parseSchemaOrgRecipeJson(
  source: string,
): Promise<SchemaOrgRecipeFileImport | null> {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return null;
  }

  const recipeObject = findRecipeObject(data);
  if (!recipeObject) return null;
  const url = recipeCanonicalUrl(recipeObject);
  const safeJson = JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
  const parsed = await parseSchemaOrgRecipeHtml(
    `<script type="application/ld+json">${safeJson}</script>`,
    url ?? "https://example.com/imported-recipe",
  );
  return parsed ? { ...parsed, ...(url ? { url } : {}) } : null;
}
