import { numericQuantity } from "numeric-quantity";
import type { ParsedRecipe, RecipeIngredient } from "recipe-domain";
import type { CooklangRecipe } from "../types/extraction";

const SECTION_HEADER_RE = /^==\s*(.+?)\s*==$/;
const INGREDIENT_WITH_QUANTITY_RE =
  /@(?<name>[^@#~\{\}\n]+?)\{(?<amount>[^%{}]+)?(?:%(?<unit>[^{}]+))?\}/g;
const INGREDIENT_BARE_RE =
  /@(?<name>[^@#~\{\}\n]+?)(?=[\s.,;:()!?]|$)/g;
const TIMER_RE =
  /~(?<name>[^@#~\{\}\n%]+)?\{(?<amount>[^%{}]+)?(?:%(?<unit>[^{}]+))?\}(?=[\s.,;:()!?]|$)/g;
const COOKWARE_RE =
  /#(?<name>[^@#~\{\}\n]+?)(?:\{[^}]*\})?(?=[\s.,;:()!?]|$)/g;

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const result = numericQuantity(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizeIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}

function replaceTokensForPreview(line: string): string {
  const withQuantities = line.replaceAll(
    INGREDIENT_WITH_QUANTITY_RE,
    (_full, name: string, amount?: string, unit?: string) => {
      const quantity = [amount?.trim(), unit?.trim()].filter(Boolean).join(" ");
      return [name.trim(), quantity].filter(Boolean).join(" ");
    },
  );
  const ingredients = withQuantities.replaceAll(
    INGREDIENT_BARE_RE,
    (_full, name: string) => name.trim(),
  );
  const timers = ingredients.replaceAll(
    TIMER_RE,
    (_full, name?: string, amount?: string, unit?: string) =>
      [name?.trim(), amount?.trim(), unit?.trim()].filter(Boolean).join(" "),
  );
  return timers.replaceAll(COOKWARE_RE, (_full, name: string) => name.trim());
}

function parseIngredientLine(line: string): RecipeIngredient[] {
  const items: RecipeIngredient[] = [];
  const seenNames = new Set<string>();
  const remainder = line.replaceAll(INGREDIENT_WITH_QUANTITY_RE, "");
  for (const match of line.matchAll(INGREDIENT_WITH_QUANTITY_RE)) {
    const name = match.groups?.name?.trim();
    if (!name) continue;
    const amount = parseNumber(match.groups?.amount);
    const unit = match.groups?.unit?.trim();
    seenNames.add(name);
    items.push({
      ingredient: normalizeIngredientName(name),
      ...(amount !== undefined ? { amount } : {}),
      ...(unit ? { unit: unit as RecipeIngredient["unit"] } : {}),
    });
  }
  for (const match of remainder.matchAll(INGREDIENT_BARE_RE)) {
    const name = match.groups?.name?.trim();
    if (!name || seenNames.has(name)) continue;
    items.push({ ingredient: normalizeIngredientName(name) });
  }
  return items;
}

function isIngredientOnlyLine(line: string): boolean {
  const withoutIngredients = line
    .replaceAll(INGREDIENT_WITH_QUANTITY_RE, "")
    .replaceAll(INGREDIENT_BARE_RE, "")
    .replace(/[,\s.;:()-]/g, "");
  return withoutIngredients.length === 0 && line.includes("@");
}

export function deriveNormalizedRecipe(
  cooklang: CooklangRecipe,
): { recipe: ParsedRecipe | null; diagnostics: string[] } {
  const diagnostics = [...cooklang.diagnostics];
  const ingredientGroups: ParsedRecipe["ingredientGroups"] = [];
  const instructions: string[] = [];
  let currentGroup: ParsedRecipe["ingredientGroups"][number] | null = null;

  for (const rawLine of cooklang.body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = SECTION_HEADER_RE.exec(line);
    if (section) {
      currentGroup = { name: section[1]!.trim(), items: [] };
      ingredientGroups.push(currentGroup);
      continue;
    }

    if (isIngredientOnlyLine(line)) {
      const items = parseIngredientLine(line);
      if (items.length === 0) {
        diagnostics.push(`Could not parse ingredient line: ${line}`);
        continue;
      }
      if (!currentGroup) {
        currentGroup = { items: [] };
        ingredientGroups.push(currentGroup);
      }
      currentGroup.items.push(...items);
      continue;
    }

    instructions.push(replaceTokensForPreview(line));
  }

  if (
    !cooklang.frontmatter.title ||
    !cooklang.frontmatter.description ||
    !cooklang.frontmatter.servings ||
    ingredientGroups.length === 0 ||
    instructions.length === 0
  ) {
    diagnostics.push(
      "Derived preview incomplete; title, description, servings, ingredients, and instructions are required.",
    );
    return { recipe: null, diagnostics };
  }

  return {
    recipe: {
      title: cooklang.frontmatter.title,
      description: cooklang.frontmatter.description,
      cuisine: cooklang.frontmatter.cuisine,
      servings: cooklang.frontmatter.servings,
      prepTime: cooklang.frontmatter.prepTime,
      cookTime: cooklang.frontmatter.cookTime,
      ingredientGroups,
      instructions,
    },
    diagnostics,
  };
}
