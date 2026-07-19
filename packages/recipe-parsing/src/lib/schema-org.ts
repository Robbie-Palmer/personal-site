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

function servings(value: string): string {
  return /\d+(?:\.\d+)?/.exec(value)?.[0] ?? "1";
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
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const entry of value) visit(entry);
          return;
        }
        if (!value || typeof value !== "object") return;
        const object = value as Record<string, unknown>;
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
        for (const child of Object.values(object)) visit(child);
      };
      visit(data);
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
