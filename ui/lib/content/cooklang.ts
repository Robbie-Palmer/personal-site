import type { Ingredient, Step, Timer } from "@cooklang/cooklang";
import { getQuantityUnit, getQuantityValue, Parser } from "@cooklang/cooklang";
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

function stepToText(
  step: Step,
  ingredients: Ingredient[],
  timers: Timer[],
): string {
  return step.items
    .map((item) => {
      switch (item.type) {
        case "text":
          return item.value;
        case "ingredient":
          return ingredients[item.index]!.name;
        case "timer": {
          const timer = timers[item.index]!;
          const qty = getQuantityValue(timer.quantity);
          const unit = getQuantityUnit(timer.quantity);
          return [qty !== null ? String(qty) : null, unit]
            .filter(Boolean)
            .join(" ")
            .trim();
        }
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
  const { sections, ingredients, timers } = recipe;

  type GroupAccumulator = {
    name: string | undefined;
    items: Array<{
      ingredient: IngredientSlug;
      amount?: number;
      unit?: string;
      preparation?: string;
      note?: string;
    }>;
  };

  let currentGroup: GroupAccumulator = { name: undefined, items: [] };
  const groups: GroupAccumulator[] = [currentGroup];
  const instructions: string[] = [];

  for (const section of sections) {
    // Cooklang `== Name ==` sections map to ingredient groups
    if (section.name !== null) {
      currentGroup = { name: section.name, items: [] };
      groups.push(currentGroup);
    }

    for (const content of section.content) {
      if (content.type === "text") continue;

      const step = content.value;

      if (isIngredientOnlyStep(step)) {
        for (const item of step.items) {
          if (item.type !== "ingredient") continue;
          const ing = ingredients[item.index]!;
          const ingSlug = normalizeSlug(ing.name) as IngredientSlug;
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
        }
        continue;
      }

      const text = stepToText(step, ingredients, timers);
      if (text) instructions.push(text);
    }
  }

  // Drop leading unnamed empty group (can happen if file starts with a section)
  const ingredientGroups = groups.filter((g) => g.items.length > 0);

  return RecipeContentSchema.parse({
    slug: slug,
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
