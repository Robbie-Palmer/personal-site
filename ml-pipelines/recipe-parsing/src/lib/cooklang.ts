import { numericQuantity } from "numeric-quantity";
import type { Recipe } from "../schemas/ground-truth.js";
import { UnitSchema, type RecipeIngredient } from "recipe-domain";
import type {
  CooklangFrontmatter,
  CooklangRecipe,
  StructuredTextRecipe,
} from "../schemas/stage-artifacts.js";

const SECTION_HEADER_RE = /^==\s*(.+?)\s*==$/;
const INGREDIENT_WITH_QUANTITY_RE =
  /@(?<name>[^@#~\{\}\n]+?)\{(?<amount>[^%{}]+)?(?:%(?<unit>[^{}]+))?\}/g;
const INGREDIENT_BARE_RE =
  /@(?<name>[^@#~\{\}\n]+?)(?=[\s.,;:()!?]|$)/g;
const TIMER_RE =
  /~(?<name>[^@#~\{\}\n%]+)?\{(?<amount>[^%{}]+)?(?:%(?<unit>[^{}]+))?\}(?=[\s.,;:()!?]|$)/g;
const COOKWARE_RE =
  /#(?<name>[^@#~\{\}\n]+?)(?:\{[^}]*\})?(?=[\s.,;:()!?]|$)/g;
const DEFAULT_INFERRED_SERVINGS = 1;

function parseFractionOrNumber(value: string): number | undefined {
  const result = numericQuantity(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizeIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}

function toCooklangToken(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function inferCooklangIngredientLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("@")) return trimmed;

  const prefixedAmountWithUnit = trimmed.match(
    /^(?<amount>\d+(?:\.\d+)?(?:\/\d+)?)(?<unit>[A-Za-z]+)\s+(?<name>.+)$/u,
  );
  if (prefixedAmountWithUnit?.groups?.name) {
    const unit = normalizeUnitToken(prefixedAmountWithUnit.groups.unit);
    return `@${toCooklangToken(prefixedAmountWithUnit.groups.name)}{${prefixedAmountWithUnit.groups.amount}${unit ? `%${unit}` : ""}}`;
  }

  const prefixedAmountWithSpacedUnit = trimmed.match(
    /^(?<amount>\d+(?:\.\d+)?(?:\/\d+)?)\s+(?<unit>[A-Za-z]+)\s+(?<name>.+)$/u,
  );
  if (prefixedAmountWithSpacedUnit?.groups?.name) {
    const unit = normalizeUnitToken(prefixedAmountWithSpacedUnit.groups.unit);
    if (unit) {
      return `@${toCooklangToken(prefixedAmountWithSpacedUnit.groups.name)}{${prefixedAmountWithSpacedUnit.groups.amount}%${unit}}`;
    }
  }

  const prefixedAmount = trimmed.match(
    /^(?<amount>\d+(?:\.\d+)?)\s+(?<name>.+)$/u,
  );
  if (prefixedAmount?.groups?.name) {
    return `@${toCooklangToken(prefixedAmount.groups.name)}{${prefixedAmount.groups.amount}}`;
  }

  const match = trimmed.match(
    /^(?<name>.+?)(?:\s*[-:,]\s*|\s+)(?<amount>\d+(?:\.\d+)?(?:\/\d+)?)\s*(?<unit>[A-Za-z]+)?(?:\s+(?<rest>.*))?$/u,
  );
  if (!match?.groups?.name) {
    return `@${toCooklangToken(trimmed)}{}`;
  }

  const name = toCooklangToken(match.groups.name);
  const amount = match.groups.amount?.trim();
  const unit = normalizeUnitToken(match.groups.unit?.trim());
  const rest = match.groups.rest?.trim();
  const quantity =
    amount || unit ? `{${amount ?? ""}${unit ? `%${unit}` : ""}}` : "";
  const suffix = rest ? ` ${rest}` : "";
  return `@${name}${quantity}${suffix}`.trim();
}

function parseScalarTextNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return Math.round(direct);
  const match = trimmed.match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function normalizeInstructionLine(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, "").trim();
}

function inferStructuredTextServings(
  value: string | undefined,
): { servings: number; diagnostic?: string } {
  const parsed = parseScalarTextNumber(value);
  if (parsed && parsed > 0) {
    return { servings: Math.floor(parsed) };
  }
  return {
    servings: DEFAULT_INFERRED_SERVINGS,
    diagnostic:
      value && value.trim().length > 0
        ? `Structured extraction inferred unparseable servings as ${DEFAULT_INFERRED_SERVINGS}.`
        : `Structured extraction inferred missing servings as ${DEFAULT_INFERRED_SERVINGS}.`,
  };
}

function normalizeUnitToken(unit: string | undefined): RecipeIngredient["unit"] | undefined {
  if (!unit) return undefined;
  const normalized = unit.trim().toLowerCase();
  const aliases: Record<string, string> = {
    tbsp: "tbsp",
    tbsps: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tsp: "tsp",
    tsps: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    pk: "piece",
    pack: "piece",
    packs: "piece",
  };
  const candidate = aliases[normalized] ?? normalized;
  const parsed = UnitSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function ingredientToCooklang(item: RecipeIngredient): string {
  const name = item.ingredient.replace(/-/g, " ");
  const quantity =
    item.amount !== undefined || item.unit
      ? `{${item.amount !== undefined ? String(item.amount) : ""}${item.unit ? `%${item.unit}` : ""}}`
      : "";
  return `@${name}${quantity}`;
}

function groupToCooklangLines(recipe: Recipe): string[] {
  const lines: string[] = [];
  for (const group of recipe.ingredientGroups) {
    if (group.name) {
      lines.push(`== ${group.name} ==`);
    }
    for (const item of group.items) {
      lines.push(ingredientToCooklang(item));
    }
    lines.push("");
  }
  return lines;
}

export function recipeToCooklang(recipe: Recipe): CooklangRecipe {
  const frontmatter: CooklangFrontmatter = {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    tags: [],
  };
  const bodyLines = [
    ...groupToCooklangLines(recipe),
    ...recipe.instructions,
  ];
  return {
    frontmatter,
    body: bodyLines.join("\n").trim(),
    diagnostics: [],
    derived: recipe,
  };
}

export function buildCooklangDraftFromStructuredText(
  extracted: StructuredTextRecipe,
): CooklangRecipe {
  const frontmatter: CooklangFrontmatter = {
    title: extracted.title,
    description: extracted.description,
    cuisine: extracted.cuisine,
    servings: parseScalarTextNumber(extracted.servingsText),
    prepTime: parseScalarTextNumber(extracted.prepTimeText),
    cookTime: parseScalarTextNumber(extracted.cookTimeText),
    tags: [],
  };
  const bodyLines: string[] = [];

  for (const section of extracted.ingredientSections) {
    if (section.name) {
      bodyLines.push(`== ${section.name} ==`);
    }
    for (const line of section.lines) {
      bodyLines.push(inferCooklangIngredientLine(line));
    }
    bodyLines.push("");
  }

  bodyLines.push(...extracted.instructionLines.map(normalizeInstructionLine));

  const cooklang: CooklangRecipe = {
    frontmatter,
    body: bodyLines.join("\n").trim(),
    diagnostics: [],
  };

  const derived = deriveRecipeFromCooklang(cooklang);
  return derived;
}

export function deriveRecipeFromStructuredText(extracted: StructuredTextRecipe): {
  recipe: Recipe | null;
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  const ingredientGroups: Recipe["ingredientGroups"] = [];

  for (const section of extracted.ingredientSections) {
    const items: RecipeIngredient[] = [];
    for (const line of section.lines) {
      const parsedItems = parseIngredientLine(inferCooklangIngredientLine(line));
      if (parsedItems.length === 0) {
        diagnostics.push(`Could not normalize structured ingredient line: ${line}`);
        continue;
      }
      items.push(...parsedItems);
    }
    if (items.length > 0) {
      ingredientGroups.push({
        ...(section.name ? { name: section.name } : {}),
        items,
      });
    }
  }

  const instructions = extracted.instructionLines
    .map(normalizeInstructionLine)
    .filter((line) => line.length > 0);

  if (ingredientGroups.length === 0) {
    diagnostics.push("No ingredient groups could be derived from structured extraction.");
  }
  if (instructions.length === 0) {
    diagnostics.push("No instruction lines could be derived from structured extraction.");
  }

  const inferredServings = inferStructuredTextServings(extracted.servingsText);
  const recipe: Recipe | null =
    extracted.title &&
    ingredientGroups.length > 0 &&
    instructions.length > 0
      ? {
          title: extracted.title,
          description:
            extracted.description ??
            `Recipe imported from structured extraction for ${extracted.title}.`,
          cuisine: extracted.cuisine,
          servings: inferredServings.servings,
          prepTime: parseScalarTextNumber(extracted.prepTimeText),
          cookTime: parseScalarTextNumber(extracted.cookTimeText),
          ingredientGroups,
          instructions,
        }
      : null;

  if (!recipe) {
    diagnostics.push(
      "Structured extraction fallback could not produce a normalized recipe.",
    );
  } else if (inferredServings.diagnostic) {
    diagnostics.push(inferredServings.diagnostic);
  }

  return { recipe, diagnostics };
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
    (_full, name?: string, amount?: string, unit?: string) => {
      const pieces = [name?.trim(), amount?.trim(), unit?.trim()].filter(Boolean);
      return pieces.join(" ");
    },
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
    const amountRaw = match.groups?.amount;
    const amount =
      amountRaw && amountRaw.trim().length > 0
        ? parseFractionOrNumber(amountRaw)
        : undefined;
    const unit = normalizeUnitToken(match.groups?.unit?.trim());
    const normalized = normalizeIngredientName(name);
    seenNames.add(normalized);
    items.push({
      ingredient: normalized,
      ...(amount !== undefined ? { amount } : {}),
      ...(unit ? { unit } : {}),
    });
  }
  for (const match of remainder.matchAll(INGREDIENT_BARE_RE)) {
    const name = match.groups?.name?.trim();
    if (!name) continue;
    const normalized = normalizeIngredientName(name);
    if (seenNames.has(normalized)) continue;
    items.push({
      ingredient: normalized,
    });
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

export function deriveRecipeFromCooklang(cooklang: CooklangRecipe): CooklangRecipe {
  const diagnostics = [...cooklang.diagnostics];
  const lines = cooklang.body.split(/\r?\n/);
  const ingredientGroups: Recipe["ingredientGroups"] = [];
  const instructions: string[] = [];
  let currentGroup: Recipe["ingredientGroups"][number] | null = null;

  for (const rawLine of lines) {
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

  if (ingredientGroups.length === 0) {
    diagnostics.push("No ingredient groups detected in Cooklang body.");
  }
  if (instructions.length === 0) {
    diagnostics.push("No instruction lines detected in Cooklang body.");
  }

  const derived =
    cooklang.frontmatter.title &&
    cooklang.frontmatter.description &&
    cooklang.frontmatter.servings &&
    ingredientGroups.length > 0 &&
    instructions.length > 0
      ? {
          title: cooklang.frontmatter.title,
          description: cooklang.frontmatter.description,
          cuisine: cooklang.frontmatter.cuisine,
          servings: Math.round(cooklang.frontmatter.servings),
          prepTime: cooklang.frontmatter.prepTime != null ? Math.round(cooklang.frontmatter.prepTime) : undefined,
          cookTime: cooklang.frontmatter.cookTime != null ? Math.round(cooklang.frontmatter.cookTime) : undefined,
          ingredientGroups,
          instructions,
        }
      : undefined;

  if (!derived) {
    diagnostics.push(
      "Derived normalized recipe is incomplete; title, description, servings, ingredients, and instructions are required.",
    );
  }

  return {
    ...cooklang,
    diagnostics,
    ...(derived ? { derived } : {}),
  };
}
