import { RecipeSchema, type Recipe } from "../schemas/ground-truth.js";

function sanitizeOptionalFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  warnings: string[],
): void {
  const value = obj[key];
  if (value === undefined || value === null) return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  warnings.push(`${key}=${String(value)}`);
  delete obj[key];
}

export function sanitizeParsedRecipe(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  const root = raw as Record<string, unknown>;
  const warnings: string[] = [];

  sanitizeOptionalFiniteNumber(root, "prepTime", warnings);
  sanitizeOptionalFiniteNumber(root, "cookTime", warnings);

  const ingredientGroups = root.ingredientGroups;
  if (Array.isArray(ingredientGroups)) {
    for (const group of ingredientGroups) {
      if (!group || typeof group !== "object") continue;
      const groupObj = group as Record<string, unknown>;
      const items = groupObj.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        sanitizeOptionalFiniteNumber(item as Record<string, unknown>, "amount", warnings);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `Sanitized non-finite optional numeric fields from model output: ${warnings.join(", ")}`,
    );
  }
  return root;
}

export function parseRecipeJsonFromText(raw: string | null | undefined): Recipe {
  if (!raw) {
    throw new Error("Model returned empty content");
  }
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(withoutFence);
  return RecipeSchema.parse(sanitizeParsedRecipe(parsed));
}
