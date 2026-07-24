import { CooklangParser } from "@cooklang/cooklang";
import { deriveRecipeFromCooklang } from "./cooklang.js";
import type { SchemaOrgRecipeFileImport } from "./schema-org.js";
import { parseSchemaOrgRecipeJson } from "./schema-org.js";

export type RecipeFileFormat = "cooklang" | "schema-org";

export type RecipeFileImport = SchemaOrgRecipeFileImport;

const parser = new CooklangParser();

function fileFormat(filename: string): RecipeFileFormat | undefined {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "cook" || extension === "cooklang") return "cooklang";
  if (extension === "json" || extension === "jsonld") return "schema-org";
  return undefined;
}

function cooklangBody(source: string): string {
  const normalized = source.replace(/^\uFEFF/, "");
  const frontmatter = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    normalized,
  );
  return (frontmatter ? normalized.slice(frontmatter[0].length) : normalized).trim();
}

function metadataValue(
  metadata: Map<unknown, unknown>,
  key: string,
): unknown {
  const normalizedKey = key.toLowerCase();
  for (const [candidate, value] of metadata) {
    if (String(candidate).toLowerCase() === normalizedKey) return value;
  }
  return undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed)
    : undefined;
}

function cuisineLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return typeof value === "string"
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function fallbackTitle(filename: string): string {
  const basename = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return basename || "Imported recipe";
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

function parseCooklangRecipeFile(
  source: string,
  filename: string,
): RecipeFileImport | null {
  const body = cooklangBody(source);
  if (!body) return null;

  const [parsed] = parser.parse(source.replace(/^\uFEFF/, ""));
  const title = (parsed.title?.trim() || fallbackTitle(filename)).slice(0, 120);
  const description = (
    parsed.description?.trim() ||
    `Recipe for ${title}, imported from a Cooklang file.`
  ).slice(0, 500);
  const servings = positiveNumber(parsed.servings) ?? 1;
  const parsedTime =
    parsed.time && typeof parsed.time === "object" ? parsed.time : undefined;
  const prepTime =
    nonNegativeNumber(metadataValue(parsed.rawMetadata, "prepTime")) ??
    nonNegativeNumber(parsedTime?.prep_time);
  const cookTime =
    nonNegativeNumber(metadataValue(parsed.rawMetadata, "cookTime")) ??
    nonNegativeNumber(parsedTime?.cook_time);
  const cuisine = cuisineLabels(parsed.cuisine);
  const derived = deriveRecipeFromCooklang({
    frontmatter: {
      title,
      description,
      servings,
      cuisine,
      prepTime,
      cookTime,
      tags: [],
    },
    body,
    diagnostics: [],
  });
  if (!derived.derived) return null;

  const canonical = httpUrl(metadataValue(parsed.rawMetadata, "canonical"));
  return {
    title,
    description,
    cuisine: cuisine.join(", "),
    servings,
    prepTime,
    cookTime,
    source: body,
    ...(canonical ? { url: canonical } : {}),
  };
}

export async function parseRecipeFile(
  filename: string,
  source: string,
): Promise<RecipeFileImport | null> {
  try {
    const format = fileFormat(filename);
    if (format === "cooklang") {
      return parseCooklangRecipeFile(source, filename);
    }
    if (format === "schema-org") {
      return parseSchemaOrgRecipeJson(source);
    }
    return null;
  } catch {
    return null;
  }
}
