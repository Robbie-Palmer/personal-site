import { numericQuantity } from "numeric-quantity";
import {
  CooklangParser,
  getQuantityValue,
  getQuantityUnit,
  ingredient_display_name,
  cookware_display_name,
  quantity_display,
} from "@cooklang/cooklang";
import type {
  Step,
  Ingredient as CkIngredient,
  CooklangRecipe as CkParsedRecipe,
} from "@cooklang/cooklang";
import {
  createIngredientGroupAccumulator,
  mergeIngredientIntoGroup,
} from "recipe-domain";
import type { ExtractionRecipe, Recipe } from "../schemas/ground-truth.js";
import { UnitSchema, type RecipeIngredient } from "recipe-domain";
import type {
  CooklangFrontmatter,
  CooklangRecipe,
  StructuredTextRecipe,
} from "../schemas/stage-artifacts.js";
import { postprocessRecipeOutput } from "./recipe-postprocess.js";

const _cooklangParser = new CooklangParser();

// Regex patterns still used by parseIngredientLine (for structured text → cooklang conversion)
const INGREDIENT_WITH_QUANTITY_RE =
  /@(?<name>[^@#~\{\}\n]+?)\{(?<amount>[^%{}]+)?(?:%(?<unit>[^{}]+))?\}/g;
const INGREDIENT_BARE_RE =
  /@(?<name>[^@#~\{\}\n]+?)(?=[\s.,;:()!?]|$)/g;
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

export function inferCooklangIngredientLine(line: string): string {
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

export function parseScalarTextNumber(value: string | undefined): number | undefined {
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

function normalizeCookwareList(values: string[] | undefined): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
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
  // Build ingredientAnnotations from items that have preparation or note
  const ingredientAnnotations: Record<string, { preparation?: string; note?: string }> = {};
  for (const group of recipe.ingredientGroups) {
    for (const item of group.items) {
      if (item.preparation || item.note) {
        ingredientAnnotations[item.ingredient] = {
          ...(item.preparation ? { preparation: item.preparation } : {}),
          ...(item.note ? { note: item.note } : {}),
        };
      }
    }
  }

  const frontmatter: CooklangFrontmatter = {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    tags: [],
    ...(Object.keys(ingredientAnnotations).length > 0
      ? { ingredientAnnotations }
      : {}),
  };
  // Separate instructions with blank lines so each becomes its own Cooklang step
  const instructionLines: string[] = [];
  for (let i = 0; i < recipe.instructions.length; i++) {
    if (i > 0) instructionLines.push("");
    instructionLines.push(recipe.instructions[i]!);
  }
  const bodyLines = [
    ...groupToCooklangLines(recipe),
    ...instructionLines,
  ];
  return {
    frontmatter,
    body: bodyLines.join("\n").trim(),
    diagnostics: [],
    derived: {
      ...postprocessRecipeOutput(recipe),
      cookware: normalizeCookwareList(recipe.cookware),
    },
  };
}

export function buildCooklangDraftFromExtraction(
  extracted: ExtractionRecipe,
): CooklangRecipe {
  const frontmatter: CooklangFrontmatter = {
    title: extracted.title,
    description:
      extracted.description ??
      `Recipe for ${extracted.title}.`,
    cuisine: extracted.cuisine ? [extracted.cuisine] : [],
    servings: parseScalarTextNumber(extracted.servings) ?? DEFAULT_INFERRED_SERVINGS,
    prepTime: parseScalarTextNumber(extracted.prepTime),
    cookTime: parseScalarTextNumber(extracted.cookTime),
    tags: [],
  };

  const bodyLines: string[] = [];
  for (const group of extracted.ingredientGroups) {
    if (group.name) {
      bodyLines.push(`== ${group.name} ==`);
    }
    for (const line of group.lines) {
      bodyLines.push(inferCooklangIngredientLine(line));
    }
    bodyLines.push("");
  }
  bodyLines.push(...extracted.instructions.map(normalizeInstructionLine));

  const cooklang: CooklangRecipe = {
    frontmatter,
    body: bodyLines.join("\n").trim(),
    diagnostics: [],
  };
  const derived = deriveRecipeFromCooklang(cooklang);
  if (!derived.derived) return derived;
  return {
    ...derived,
    derived: postprocessRecipeOutput({
      ...derived.derived,
      cookware: normalizeCookwareList(extracted.equipment),
    }),
  };
}

export function buildCooklangDraftFromStructuredText(
  extracted: StructuredTextRecipe,
): CooklangRecipe {
  const frontmatter: CooklangFrontmatter = {
    title: extracted.title,
    description: extracted.description,
    cuisine: extracted.cuisine ? [extracted.cuisine] : [],
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
  if (!derived.derived) return derived;
  return {
    ...derived,
    derived: postprocessRecipeOutput({
      ...derived.derived,
      cookware: normalizeCookwareList(extracted.equipment),
    }),
  };
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
          cuisine: extracted.cuisine ? [extracted.cuisine] : [],
          servings: inferredServings.servings,
          prepTime: parseScalarTextNumber(extracted.prepTimeText),
          cookTime: parseScalarTextNumber(extracted.cookTimeText),
          ingredientGroups,
          instructions,
          cookware: normalizeCookwareList(extracted.equipment),
        }
      : null;

  if (!recipe) {
    diagnostics.push(
      "Structured extraction fallback could not produce a normalized recipe.",
    );
  } else if (inferredServings.diagnostic) {
    diagnostics.push(inferredServings.diagnostic);
  }

  return { recipe: recipe ? postprocessRecipeOutput(recipe) : null, diagnostics };
}

export function parseIngredientLine(line: string): RecipeIngredient[] {
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

// ── Cooklang parser-based derivation ─────────────────────────────────────────

const STEP_PUNCTUATION_RE = /^[\s,;.]+$/;

function isIngredientOnlyStep(step: Step): boolean {
  let hasIngredient = false;
  for (const item of step.items) {
    if (item.type === "ingredient") {
      hasIngredient = true;
    } else if (item.type === "text") {
      if (!STEP_PUNCTUATION_RE.test(item.value)) return false;
    } else {
      return false;
    }
  }
  return hasIngredient;
}

function resolveQuantityValue(ingredient: CkIngredient): number | undefined {
  const value = getQuantityValue(ingredient.quantity);
  if (value !== null && !isNaN(value)) return value;
  // Fallback for fractions (getQuantityValue returns NaN for them)
  const inner = (ingredient.quantity as Record<string, unknown> | null)?.value;
  if (inner && typeof inner === "object" && "type" in inner) {
    const numObj = inner as { type: string; value: unknown };
    if (numObj.type === "number" && numObj.value && typeof numObj.value === "object") {
      const v = numObj.value as { type: string; value?: unknown };
      if (v.type === "fraction" && v.value && typeof v.value === "object") {
        const f = v.value as { whole: number; num: number; den: number };
        if (f.den !== 0) return f.whole + f.num / f.den;
      }
    }
  }
  return undefined;
}

function stepToInstructionText(step: Step, parsed: CkParsedRecipe): string {
  return step.items
    .map((item) => {
      switch (item.type) {
        case "text":
          return item.value;
        case "ingredient":
          return ingredient_display_name(parsed.ingredients[item.index]!);
        case "cookware":
          return cookware_display_name(parsed.cookware[item.index]!);
        case "timer": {
          const timer = parsed.timers[item.index]!;
          const amount = getQuantityValue(timer.quantity);
          const unit = getQuantityUnit(timer.quantity);
          return [amount != null ? String(amount) : null, unit]
            .filter(Boolean)
            .join(" ");
        }
        case "inlineQuantity": {
          const qty = parsed.inlineQuantities[item.index];
          return qty ? quantity_display(qty) : "";
        }
        default:
          return "";
      }
    })
    .join("")
    .trim();
}

/**
 * Fix bare multi-word `@ingredient` references that are missing braces.
 * The cooklang parser only captures a single word for `@name` without braces,
 * so `@long grain rice` is parsed as just `@long`. We detect known multi-word
 * ingredients (those already defined with braces earlier in the body) and add
 * empty braces to bare back-references.
 */
function fixBareMultiWordIngredients(body: string): string {
  // Collect multi-word ingredient names defined with braces: @name{...}
  const definedNames = new Set<string>();
  for (const m of body.matchAll(/@([^@#~{}\n]{2,}?)\{/g)) {
    const name = m[1]!.trimEnd();
    if (name.includes(" ")) definedNames.add(name);
  }
  if (definedNames.size === 0) return body;

  // Sort longest-first so we match "long grain rice" before "long grain"
  const sorted = [...definedNames].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `@(${sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=\\s|[.,;:()!?]|$)`,
    "g",
  );
  return body.replace(pattern, "@$1{}");
}

export function deriveRecipeFromCooklang(cooklang: CooklangRecipe): CooklangRecipe {
  const diagnostics = [...cooklang.diagnostics];
  const fixedBody = fixBareMultiWordIngredients(cooklang.body);
  const [parsed] = _cooklangParser.parse(fixedBody);

  const groups: ReturnType<typeof createIngredientGroupAccumulator>[] = [];
  const instructions: string[] = [];
  let currentGroup: ReturnType<typeof createIngredientGroupAccumulator> | null = null;
  const annotations = cooklang.frontmatter.ingredientAnnotations;
  const cookware = normalizeCookwareList(
    parsed.cookware.map((item) => cookware_display_name(item)),
  );

  for (const section of parsed.sections) {
    if (section.name !== null) {
      currentGroup = createIngredientGroupAccumulator(section.name);
      groups.push(currentGroup);
    }

    for (const content of section.content) {
      if (content.type === "text") continue;
      const step = content.value;

      // Collect ingredients from this step
      for (const item of step.items) {
        if (item.type !== "ingredient") continue;
        const ingredient = parsed.ingredients[item.index]!;
        const slug = normalizeIngredientName(ingredient.name);

        if (!currentGroup) {
          currentGroup = createIngredientGroupAccumulator();
          groups.push(currentGroup);
        }

        const amount = resolveQuantityValue(ingredient);
        const unit = normalizeUnitToken(
          getQuantityUnit(ingredient.quantity) ?? undefined,
        );
        const ann = annotations?.[slug];
        mergeIngredientIntoGroup(currentGroup, {
          ingredient: slug,
          ...(amount !== undefined ? { amount } : {}),
          ...(unit ? { unit } : {}),
          ...(ann?.preparation ? { preparation: ann.preparation } : {}),
          ...(ann?.note ? { note: ann.note } : {}),
        });
      }

      // Add instruction text for non-ingredient-only steps
      if (!isIngredientOnlyStep(step)) {
        const text = stepToInstructionText(step, parsed);
        if (text) instructions.push(text);
      }
    }
  }

  const ingredientGroups: Recipe["ingredientGroups"] = groups.map((g) => ({
    ...(g.name ? { name: g.name } : {}),
    items: g.items,
  }));

  if (ingredientGroups.length === 0) {
    diagnostics.push("No ingredient groups detected in Cooklang body.");
  }
  if (instructions.length === 0) {
    diagnostics.push("No instruction lines detected in Cooklang body.");
  }

  const derivedRecipe =
    cooklang.frontmatter.title &&
    cooklang.frontmatter.description != null &&
    cooklang.frontmatter.servings &&
    ingredientGroups.length > 0 &&
    instructions.length > 0
      ? {
          title: cooklang.frontmatter.title,
          description: cooklang.frontmatter.description,
          cuisine: cooklang.frontmatter.cuisine ?? [],
          servings: Math.round(cooklang.frontmatter.servings),
          prepTime: cooklang.frontmatter.prepTime != null ? Math.round(cooklang.frontmatter.prepTime) : undefined,
          cookTime: cooklang.frontmatter.cookTime != null ? Math.round(cooklang.frontmatter.cookTime) : undefined,
          ingredientGroups,
          instructions,
          cookware,
        }
      : undefined;

  if (!derivedRecipe) {
    diagnostics.push(
      "Derived normalized recipe is incomplete; title, description, servings, ingredients, and instructions are required.",
    );
  }

  const derived = derivedRecipe
    ? postprocessRecipeOutput(derivedRecipe)
    : undefined;

  return {
    ...cooklang,
    diagnostics,
    ...(derived ? { derived } : {}),
  };
}

/**
 * Extract unique ingredient slugs from a Cooklang body string.
 */
export function extractIngredientSlugsFromBody(body: string): string[] {
  const [parsed] = _cooklangParser.parse(body);
  return [...new Set(parsed.ingredients.map((i) => normalizeIngredientName(i.name)))];
}

/**
 * Extract unique cookware names from a Cooklang body string.
 */
export function extractCookwareFromBody(body: string): string[] {
  const [parsed] = _cooklangParser.parse(body);
  return [...new Set(parsed.cookware.map((c) => c.name))];
}
