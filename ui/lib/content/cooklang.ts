import type { Ingredient, Step, Timer } from "@cooklang/cooklang";
import { getQuantityUnit, getQuantityValue, Parser } from "@cooklang/cooklang";
import { readdirSync, readFileSync } from "fs";
import matter from "gray-matter";
import { join } from "path";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type { RecipeContent } from "@/lib/domain/recipe/recipe";
import { RecipeContentSchema } from "@/lib/domain/recipe/recipe";
import { UnitSchema } from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

// Frontmatter shape for .cook files.
// Fields not standardised by Cooklang are stored here.
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
  /** Per-ingredient overrides for `preparation` and `note` fields,
   *  keyed by ingredient slug, since Cooklang has no standard annotation. */
  ingredientAnnotations?: Record<
    string,
    { preparation?: string; note?: string }
  >;
}

const _parser = new Parser();

// ── Ingredient-only step detection ───────────────────────────────────────────

/** Text that is only whitespace or punctuation between ingredient annotations. */
const PUNCTUATION_RE = /^[\s,;.]+$/;

/**
 * Returns true when a step consists only of ingredient annotations and
 * connecting punctuation.  Such steps define the ingredient group's contents
 * but should NOT be added to the recipe's instruction list.
 */
function isIngredientOnlyStep(step: Step): boolean {
  let hasIngredient = false;
  for (const item of step.items) {
    if (item.type === "ingredient") {
      hasIngredient = true;
    } else if (item.type === "text") {
      if (!PUNCTUATION_RE.test(item.value)) return false;
    } else {
      // cookware / timer / inlineQuantity → not an ingredient-only step
      return false;
    }
  }
  return hasIngredient;
}

// ── Step-text reconstruction ──────────────────────────────────────────────────

/**
 * Rebuilds the human-readable instruction text from a parsed step, replacing
 * `@ingredient{…}` annotations with the ingredient's plain name, and `~timer`
 * annotations with `quantity units`.
 */
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

// ── Core parser ───────────────────────────────────────────────────────────────

/**
 * Parses a `.cook` file (frontmatter + Cooklang body) and returns a validated
 * `RecipeContent` object that matches the existing Zod schema exactly.
 *
 * File layout expected:
 * ```
 * ---
 * title: …
 * date: "YYYY-MM-DD"
 * servings: N
 * ingredientAnnotations:
 *   chicken-breast:
 *     preparation: chopped
 * ---
 *
 * @olive oil{1%tbsp}, @chicken breast{2%piece}.
 *
 * First instruction step.
 *
 * Second instruction step.
 *
 * == Extras ==
 *
 * @garlic bread{}.
 * ```
 */
export function parseCookFile(
  fileContent: string,
  slug: string,
): RecipeContent {
  const { data, content: body } = matter(fileContent);
  const fm = data as CookFrontmatter;
  const annotations = fm.ingredientAnnotations ?? {};

  const { recipe } = _parser.parse(body);
  const { sections, ingredients, timers } = recipe;

  // ── Build ingredientGroups ────────────────────────────────────────────────
  //
  // Strategy:
  //  - Iterate sections in order. Each section's name (from `== Name ==`)
  //    starts a new named group; the first unnamed section uses the default
  //    unnamed group.
  //  - An ingredient-only step (no meaningful text, only @annotations and
  //    punctuation) populates the current group's ingredient list.
  //  - All other steps contribute to the instruction list.

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
    // Named sections (from `== Name ==`) start a new ingredient group
    if (section.name !== null) {
      currentGroup = { name: section.name, items: [] };
      groups.push(currentGroup);
    }

    for (const content of section.content) {
      // Plain text blocks between steps — skip
      if (content.type === "text") continue;

      const step = content.value;

      // Ingredient-only step — populate the current group
      if (isIngredientOnlyStep(step)) {
        for (const item of step.items) {
          if (item.type !== "ingredient") continue;
          const ing = ingredients[item.index]!;
          const ingSlug = normalizeSlug(ing.name) as IngredientSlug;
          const ann = annotations[ingSlug];

          const amount = getQuantityValue(ing.quantity);
          const validAmount =
            amount !== null && !isNaN(amount) ? amount : undefined;

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

      // Normal instruction step
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

// ── Repository loader ─────────────────────────────────────────────────────────

const RECIPES_DIR = join(process.cwd(), "content", "recipes");

/**
 * Reads all `.cook` files from `content/recipes/` and returns an array of
 * validated `RecipeContent` objects, preserving filename-derived slugs.
 */
export function loadRecipesFromCookFiles(): RecipeContent[] {
  const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".cook"));
  return files.map((file) => {
    const slug = file.replace(/\.cook$/, "");
    const content = readFileSync(join(RECIPES_DIR, file), "utf-8");
    return parseCookFile(content, slug);
  });
}
