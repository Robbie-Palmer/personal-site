import type {
  Cookware,
  Ingredient,
  Quantity,
  Step,
  Timer,
} from "@cooklang/cooklang";
import {
  CooklangParser,
  cookware_display_name,
  getQuantityUnit,
  getQuantityValue,
  ingredient_display_name,
  quantity_display,
} from "@cooklang/cooklang";
import { readdirSync, readFileSync } from "fs";
import matter from "gray-matter";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type {
  RecipeContent,
  RecipeFrontmatter,
} from "@/lib/domain/recipe/recipe";
import {
  RecipeContentSchema,
  RecipeFrontmatterSchema,
} from "@/lib/domain/recipe/recipe";
import { UNIT_LABELS, UnitSchema } from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

type IngredientGroupItem = {
  ingredient: IngredientSlug;
  amount?: number;
  unit?: string;
  preparation?: string;
  note?: string;
};

type GroupAccumulator = {
  name: string | undefined;
  items: IngredientGroupItem[];
  itemIndexByIngredient: Map<IngredientSlug, number>;
};

const _parser = new CooklangParser();

// getQuantityValue returns NaN for fractions — resolve them from the raw structure.
function resolveQuantityValue(
  quantity: Ingredient["quantity"],
): number | undefined {
  const value = getQuantityValue(quantity);
  if (value !== null && !isNaN(value)) return value;

  const inner = (quantity as Record<string, unknown> | null)?.value;
  if (inner && typeof inner === "object" && "type" in inner) {
    const numObj = inner as { type: string; value: unknown };
    if (
      numObj.type === "number" &&
      numObj.value &&
      typeof numObj.value === "object"
    ) {
      const v = numObj.value as { type: string; value?: unknown };
      if (v.type === "fraction" && v.value && typeof v.value === "object") {
        const f = v.value as { whole: number; num: number; den: number };
        if (f.den !== 0) return f.whole + f.num / f.den;
      }
    }
  }

  return undefined;
}

const PUNCTUATION_RE = /^[\s,;.]+$/;

function isIngredientOnlyStep(step: Step): boolean {
  let hasIngredient = false;
  for (const item of step.items) {
    if (item.type === "ingredient") {
      hasIngredient = true;
    } else if (item.type === "text") {
      if (!PUNCTUATION_RE.test(item.value)) return false;
    } else {
      return false;
    }
  }
  return hasIngredient;
}

function formatTimerDisplay(timer: Timer): string {
  const qty = resolveQuantityValue(timer.quantity);
  const unit = getQuantityUnit(timer.quantity);
  return [qty !== undefined ? String(qty) : null, unit]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function timerDurationSeconds(timer: Timer): number | null {
  const qty = resolveQuantityValue(timer.quantity);
  if (qty === undefined) return null;
  const unit = getQuantityUnit(timer.quantity)?.toLowerCase();
  switch (unit) {
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return qty;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return qty * 60;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return qty * 3600;
    default:
      return null;
  }
}

function formatCookwareDisplay(cookware: Cookware): string {
  return cookware_display_name(cookware);
}

function formatIngredientDisplay(ingredient: Ingredient): string {
  return ingredient_display_name(ingredient);
}

function formatInstructionIngredient(
  ingredient: Ingredient,
  displayValue: string,
): string {
  const amount = resolveQuantityValue(ingredient.quantity);

  // When amount is undefined, simply return displayValue
  if (amount === undefined) return displayValue;

  const rawUnit = getQuantityUnit(ingredient.quantity);

  // Skip emitting any unit when it's "piece"
  if (rawUnit === "piece") {
    return `${amount} ${displayValue}`;
  }

  // For non-piece units, use UNIT_LABELS to get the proper label
  if (rawUnit) {
    const unitResult = UnitSchema.safeParse(rawUnit);
    if (unitResult.success) {
      const unit = unitResult.data;
      const unitLabel = UNIT_LABELS[unit];
      const label = amount === 1 ? unitLabel.singular : unitLabel.plural;
      const separator = unitLabel.noSpace ? "" : " ";
      return `${amount}${separator}${label} of ${displayValue}`;
    }
  }

  // Fallback for unknown units (shouldn't normally happen)
  return `${amount} ${displayValue}`;
}

function formatInlineQuantityDisplay(quantity: Quantity): string {
  return quantity_display(quantity);
}

function buildIngredientGroupItem(
  ingredient: Ingredient,
  annotations: RecipeFrontmatter["ingredientAnnotations"],
): IngredientGroupItem {
  const ingSlug = normalizeSlug(ingredient.name) as IngredientSlug;
  const ann = annotations?.[ingSlug];
  const validAmount = resolveQuantityValue(ingredient.quantity);
  const unitStr = getQuantityUnit(ingredient.quantity);
  const unitResult = unitStr
    ? UnitSchema.safeParse(unitStr)
    : { success: false as const };
  const unit = unitResult.success ? unitResult.data : undefined;

  return {
    ingredient: ingSlug,
    ...(validAmount !== undefined && { amount: validAmount }),
    ...(unit !== undefined && { unit }),
    ...(ann?.preparation && { preparation: ann.preparation }),
    ...(ann?.note && { note: ann.note }),
  };
}

function mergeIngredientIntoGroup(
  group: GroupAccumulator,
  nextItem: IngredientGroupItem,
): void {
  const existingIndex = group.itemIndexByIngredient.get(nextItem.ingredient);
  if (existingIndex === undefined) {
    group.items.push(nextItem);
    group.itemIndexByIngredient.set(
      nextItem.ingredient,
      group.items.length - 1,
    );
    return;
  }

  const existing = group.items[existingIndex]!;
  const duplicateConflict = (reason: string): never => {
    throw new Error(
      `Conflicting duplicate ingredient "${nextItem.ingredient}" in group "${group.name ?? "unnamed"}": ${reason}`,
    );
  };

  if (existing.preparation !== nextItem.preparation) {
    duplicateConflict("preparation annotations differ");
  }

  if (existing.note !== nextItem.note) {
    duplicateConflict("notes differ");
  }

  // Repeated inline tags for the same ingredient within a group are allowed
  // when they reinforce the same ingredient or contribute an additional
  // compatible quantity we can safely sum.
  if (
    existing.unit === nextItem.unit &&
    existing.amount !== undefined &&
    nextItem.amount !== undefined
  ) {
    existing.amount += nextItem.amount;
    return;
  }

  if (existing.amount === undefined && nextItem.amount !== undefined) {
    existing.amount = nextItem.amount;
    existing.unit = nextItem.unit;
    return;
  }

  if (existing.amount !== undefined && nextItem.amount === undefined) {
    if (nextItem.unit !== undefined && nextItem.unit !== existing.unit) {
      duplicateConflict("unit differs from the existing quantified entry");
    }
    return;
  }

  if (existing.amount === undefined && nextItem.amount === undefined) {
    if (existing.unit !== nextItem.unit) {
      duplicateConflict("unit differs between unquantified duplicate entries");
    }
    return;
  }

  if (existing.unit !== nextItem.unit) {
    duplicateConflict("units differ");
  }

  duplicateConflict("duplicate quantities could not be merged safely");
}

function collectStepIngredients(
  step: Step,
  ingredients: Ingredient[],
  currentGroup: GroupAccumulator,
  annotations: RecipeFrontmatter["ingredientAnnotations"],
): void {
  for (const item of step.items) {
    if (item.type !== "ingredient") continue;

    const ingredient = ingredients[item.index]!;
    mergeIngredientIntoGroup(
      currentGroup,
      buildIngredientGroupItem(ingredient, annotations),
    );
  }
}

function createGroupAccumulator(name?: string): GroupAccumulator {
  return {
    name,
    items: [],
    itemIndexByIngredient: new Map(),
  };
}

function stepToText(
  step: Step,
  ingredients: Ingredient[],
  cookware: Cookware[],
  inlineQuantities: string[],
  timers: Timer[],
): string {
  return step.items
    .map((item) => {
      switch (item.type) {
        case "text":
          return item.value;
        case "ingredient":
          return formatInstructionIngredient(
            ingredients[item.index]!,
            formatIngredientDisplay(ingredients[item.index]!),
          );
        case "cookware":
          return formatCookwareDisplay(cookware[item.index]!);
        case "inlineQuantity":
          return inlineQuantities[item.index] ?? "";
        case "timer":
          return formatTimerDisplay(timers[item.index]!);
        default:
          return "";
      }
    })
    .join("")
    .trim();
}

export function parseCookFile(
  fileContent: string,
  slug: string,
): RecipeContent {
  const { data, content: body } = matter(fileContent);
  const fm = RecipeFrontmatterSchema.parse(data) as RecipeFrontmatter;
  const annotations = fm.ingredientAnnotations ?? {};

  const [recipe] = _parser.parse(body);
  const inlineQuantities = recipe.inlineQuantities.map(
    formatInlineQuantityDisplay,
  );
  const { sections, ingredients, cookware, timers } = recipe;

  const getOrCreateNamedGroup = (
    name: string,
    groups: GroupAccumulator[],
    namedGroups: Map<string, GroupAccumulator>,
  ): GroupAccumulator => {
    const existing = namedGroups.get(name);
    if (existing) return existing;

    const group = createGroupAccumulator(name);
    groups.push(group);
    namedGroups.set(name, group);
    return group;
  };

  let currentGroup: GroupAccumulator = createGroupAccumulator();
  const groups: GroupAccumulator[] = [currentGroup];
  const namedGroups = new Map<string, GroupAccumulator>();
  const instructions: string[] = [];
  const ingredientNames = ingredients.map((ingredient) => ingredient.name);
  const ingredientDisplayValues = ingredients.map(formatIngredientDisplay);
  const ingredientAmounts = ingredients.map(
    (ingredient) => resolveQuantityValue(ingredient.quantity) ?? null,
  );
  const ingredientUnits = ingredients.map(
    (ingredient) => getQuantityUnit(ingredient.quantity) ?? null,
  );
  const cookwareDisplayValues = cookware.map(formatCookwareDisplay);
  const inlineQuantityDisplayValues = inlineQuantities;
  const timerDisplayValues = timers.map(formatTimerDisplay);
  const timerDurations = timers.map(timerDurationSeconds);

  for (const section of sections) {
    // Cooklang `== Name ==` sections map to ingredient groups
    if (section.name !== null) {
      currentGroup = getOrCreateNamedGroup(section.name, groups, namedGroups);
    }

    for (const content of section.content) {
      if (content.type === "text") continue;

      const step = content.value;
      collectStepIngredients(step, ingredients, currentGroup, annotations);

      if (isIngredientOnlyStep(step)) {
        continue;
      }

      const text = stepToText(
        step,
        ingredients,
        cookware,
        inlineQuantities,
        timers,
      );
      if (text) instructions.push(text);
    }
  }

  // Drop leading unnamed empty group (can happen if file starts with a section)
  const ingredientGroups = groups
    .filter((g) => g.items.length > 0)
    .map(
      ({ itemIndexByIngredient: _itemIndexByIngredient, ...group }) => group,
    );

  return RecipeContentSchema.parse({
    slug: slug,
    cookBody: body,
    title: fm.title,
    description: fm.description,
    date: fm.date,
    cuisine: fm.cuisine,
    servings: fm.servings,
    prepTime: fm.prepTime,
    cookTime: fm.cookTime,
    tags: fm.tags ?? [],
    cookware: [
      ...new Set(cookwareDisplayValues.map((v) => v.trim().toLowerCase())),
    ],
    image: fm.image,
    imageAlt: fm.imageAlt,
    ingredientGroups,
    instructions,
    instructionSdk: {
      sections: sections.map((s) => ({
        ...s,
        content: s.content.filter(
          (c) => c.type !== "step" || !isIngredientOnlyStep(c.value),
        ),
      })),
      ingredientNames,
      ingredientDisplayValues,
      ingredientAmounts,
      ingredientUnits,
      cookwareDisplayValues,
      inlineQuantityDisplayValues,
      timerDisplayValues,
      timerDurationSeconds: timerDurations,
    },
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(__dirname, "..", "..", "content", "recipes");

export function loadRecipesFromCookFiles(): RecipeContent[] {
  const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".cook"));
  return files.map((file) => {
    const slug = file.replace(/\.cook$/, "");
    const content = readFileSync(join(RECIPES_DIR, file), "utf-8");
    return parseCookFile(content, slug);
  });
}
