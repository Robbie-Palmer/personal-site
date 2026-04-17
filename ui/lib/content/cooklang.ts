import type { Cookware, Ingredient, Step, Timer } from "@cooklang/cooklang";
import {
  getQuantityUnit,
  getQuantityValue,
  ingredient_display_name,
  Parser,
} from "@cooklang/cooklang";
import { readdirSync, readFileSync } from "fs";
import matter from "gray-matter";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type { RecipeContent } from "@/lib/domain/recipe/recipe";
import { RecipeContentSchema } from "@/lib/domain/recipe/recipe";
import { UnitSchema } from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

interface CookFrontmatter {
  title: string;
  description: string;
  date: string;
  servings: number;
  cuisine?: string;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  image?: string;
  imageAlt?: string;
  // Cooklang has no annotation syntax, so these live in frontmatter.
  ingredientAnnotations?: Record<
    string,
    { preparation?: string; note?: string }
  >;
}

const _parser = new Parser();

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

function formatCookwareDisplay(cookware: Cookware): string {
  return cookware.name;
}

function formatIngredientDisplay(ingredient: Ingredient): string {
  return ingredient_display_name(ingredient);
}

function stepToText(
  step: Step,
  ingredients: Ingredient[],
  cookware: Cookware[],
  timers: Timer[],
): string {
  return step.items
    .map((item) => {
      switch (item.type) {
        case "text":
          return item.value;
        case "ingredient":
          return formatIngredientDisplay(ingredients[item.index]!);
        case "cookware":
          return formatCookwareDisplay(cookware[item.index]!);
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
  const fm = data as CookFrontmatter;
  const annotations = fm.ingredientAnnotations ?? {};

  const { recipe } = _parser.parse(body);
  const { sections, ingredients, cookware, timers } = recipe;

  type GroupAccumulator = {
    name: string | undefined;
    items: Array<{
      ingredient: IngredientSlug;
      amount?: number;
      unit?: string;
      preparation?: string;
      note?: string;
    }>;
    seen: Set<IngredientSlug>;
  };

  const getOrCreateNamedGroup = (
    name: string | undefined,
    groups: GroupAccumulator[],
    namedGroups: Map<string, GroupAccumulator>,
  ): GroupAccumulator => {
    if (name == null) {
      return groups[0]!;
    }

    const existing = namedGroups.get(name);
    if (existing) return existing;

    const group: GroupAccumulator = { name, items: [], seen: new Set() };
    groups.push(group);
    namedGroups.set(name, group);
    return group;
  };

  let currentGroup: GroupAccumulator = {
    name: undefined,
    items: [],
    seen: new Set(),
  };
  const groups: GroupAccumulator[] = [currentGroup];
  const namedGroups = new Map<string, GroupAccumulator>();
  const instructions: string[] = [];
  const ingredientNames = ingredients.map((ingredient) => ingredient.name);
  const ingredientDisplayValues = ingredients.map(formatIngredientDisplay);
  const cookwareDisplayValues = cookware.map(formatCookwareDisplay);
  const timerDisplayValues = timers.map(formatTimerDisplay);

  for (const section of sections) {
    // Cooklang `== Name ==` sections map to ingredient groups
    if (section.name !== null) {
      currentGroup = getOrCreateNamedGroup(section.name, groups, namedGroups);
    }

    for (const content of section.content) {
      if (content.type === "text") continue;

      const step = content.value;
      for (const item of step.items) {
        if (item.type !== "ingredient") continue;

        const ing = ingredients[item.index]!;
        const ingSlug = normalizeSlug(ing.name) as IngredientSlug;
        if (currentGroup.seen.has(ingSlug)) continue;

        const ann = annotations[ingSlug];
        const validAmount = resolveQuantityValue(ing.quantity);
        const unitStr = getQuantityUnit(ing.quantity);
        const unitResult = unitStr
          ? UnitSchema.safeParse(unitStr)
          : { success: false as const };
        const unit = unitResult.success ? unitResult.data : undefined;

        currentGroup.items.push({
          ingredient: ingSlug,
          ...(validAmount !== undefined && { amount: validAmount }),
          ...(unit !== undefined && { unit }),
          ...(ann?.preparation && { preparation: ann.preparation }),
          ...(ann?.note && { note: ann.note }),
        });
        currentGroup.seen.add(ingSlug);
      }

      if (isIngredientOnlyStep(step)) {
        continue;
      }

      const text = stepToText(step, ingredients, cookware, timers);
      if (text) instructions.push(text);
    }
  }

  // Drop leading unnamed empty group (can happen if file starts with a section)
  const ingredientGroups = groups
    .filter((g) => g.items.length > 0)
    .map(({ seen: _seen, ...group }) => group);

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
      cookwareDisplayValues,
      timerDisplayValues,
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
