import type {
  Cookware,
  Ingredient,
  CooklangRecipe as ParsedCooklangRecipe,
  Quantity,
  Step,
  Timer,
} from "@cooklang/cooklang";
import {
  cookware_display_name,
  getQuantityUnit,
  getQuantityValue,
  ingredient_display_name,
  quantity_display,
} from "@cooklang/cooklang";
import type {
  IngredientGroupAccumulator,
  IngredientSlug,
} from "@/lib/domain/recipe/ingredient";
import {
  createIngredientGroupAccumulator,
  mergeIngredientIntoGroup,
} from "@/lib/domain/recipe/ingredient";
import type {
  IngredientGroup,
  RecipeContent,
  RecipeFrontmatter,
  RecipeIngredient,
  RecipeInstructionSdk,
} from "@/lib/domain/recipe/recipe";
import { RecipeContentSchema } from "@/lib/domain/recipe/recipe";
import { UNIT_LABELS, UnitSchema } from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

type GroupAccumulator = IngredientGroupAccumulator;
type IngredientAnnotations = NonNullable<
  RecipeFrontmatter["ingredientAnnotations"]
>;

export type ScaledRecipeParts = {
  ingredientGroups: IngredientGroup[];
  instructions: string[];
  instructionSdk: RecipeInstructionSdk;
  cookware: string[];
};

// cooklang-rs returns canonical short forms ("c") whenever parse() is called
// with a scale; UnitSchema only accepts the long forms.
const UNIT_ALIASES: Record<string, string> = {
  c: "cup",
};

function normalizeCookUnit(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return UNIT_ALIASES[raw] ?? raw;
}

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

  if (amount === undefined) return displayValue;

  const rawUnit = normalizeCookUnit(getQuantityUnit(ingredient.quantity));

  if (rawUnit === "piece") {
    return `${amount} ${displayValue}`;
  }

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

  return `${amount} ${displayValue}`;
}

function formatInlineQuantityDisplay(quantity: Quantity): string {
  return quantity_display(quantity);
}

function buildIngredientGroupItem(
  ingredient: Ingredient,
  annotations: IngredientAnnotations,
): RecipeIngredient {
  const ingSlug = normalizeSlug(ingredient.name) as IngredientSlug;
  const ann = annotations[ingSlug];
  const validAmount = resolveQuantityValue(ingredient.quantity);
  const unitStr = normalizeCookUnit(getQuantityUnit(ingredient.quantity));
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

function collectStepIngredients(
  step: Step,
  ingredients: Ingredient[],
  currentGroup: GroupAccumulator,
  annotations: IngredientAnnotations,
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

// Runs in both Node (build time) and the browser (after WASM scaling), so
// keep the module free of fs / gray-matter / other Node-only imports.
export function buildScaledRecipeParts(
  parsed: ParsedCooklangRecipe,
  annotations: IngredientAnnotations = {},
): ScaledRecipeParts {
  const inlineQuantities = parsed.inlineQuantities.map(
    formatInlineQuantityDisplay,
  );
  const { sections, ingredients, cookware, timers } = parsed;

  const getOrCreateNamedGroup = (
    name: string,
    groups: GroupAccumulator[],
    namedGroups: Map<string, GroupAccumulator>,
  ): GroupAccumulator => {
    const existing = namedGroups.get(name);
    if (existing) return existing;

    const group = createIngredientGroupAccumulator(name);
    groups.push(group);
    namedGroups.set(name, group);
    return group;
  };

  let currentGroup: GroupAccumulator = createIngredientGroupAccumulator();
  const groups: GroupAccumulator[] = [currentGroup];
  const namedGroups = new Map<string, GroupAccumulator>();
  const instructions: string[] = [];
  const ingredientNames = ingredients.map((ingredient) => ingredient.name);
  const ingredientDisplayValues = ingredients.map(formatIngredientDisplay);
  const ingredientAmounts = ingredients.map(
    (ingredient) => resolveQuantityValue(ingredient.quantity) ?? null,
  );
  const ingredientUnits = ingredients.map(
    (ingredient) =>
      normalizeCookUnit(getQuantityUnit(ingredient.quantity)) ?? null,
  );
  const cookwareDisplayValues = cookware.map(formatCookwareDisplay);
  const timerDisplayValues = timers.map(formatTimerDisplay);
  const timerDurations = timers.map(timerDurationSeconds);

  for (const section of sections) {
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

  const ingredientGroups: IngredientGroup[] = groups
    .filter((g) => g.items.length > 0)
    .map(
      ({ itemIndexByIngredient: _itemIndexByIngredient, ...group }) => group,
    );

  return {
    ingredientGroups,
    instructions,
    cookware: [
      ...new Set(cookwareDisplayValues.map((v) => v.trim().toLowerCase())),
    ],
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
      inlineQuantityDisplayValues: inlineQuantities,
      timerDisplayValues,
      timerDurationSeconds: timerDurations,
    },
  };
}

export function buildRecipeContentFromParsed(
  parsed: ParsedCooklangRecipe,
  frontmatter: RecipeFrontmatter,
  slug: string,
  cookBody: string,
): RecipeContent {
  const annotations = frontmatter.ingredientAnnotations ?? {};
  const parts = buildScaledRecipeParts(parsed, annotations);

  return RecipeContentSchema.parse({
    slug,
    cookBody,
    title: frontmatter.title,
    description: frontmatter.description,
    date: frontmatter.date,
    cuisine: frontmatter.cuisine,
    servings: frontmatter.servings,
    prepTime: frontmatter.prepTime,
    cookTime: frontmatter.cookTime,
    tags: frontmatter.tags ?? [],
    cookware: parts.cookware,
    image: frontmatter.image,
    imageAlt: frontmatter.imageAlt,
    ingredientGroups: parts.ingredientGroups,
    instructions: parts.instructions,
    instructionSdk: parts.instructionSdk,
  });
}
