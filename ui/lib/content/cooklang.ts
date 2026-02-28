import type { Ingredient, Step, Text } from "@cooklang/cooklang-ts";
import { Recipe } from "@cooklang/cooklang-ts";
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

// ── Section detection ─────────────────────────────────────────────────────────

const SECTION_RE = /^==\s*(.+?)\s*==\s*$/;

/**
 * If the step is a Cooklang section header (`== Name ==`), returns the section
 * name; otherwise returns null.
 *
 * @cooklang/cooklang-ts does not natively parse section markers, so they come
 * through as text-only steps whose full text matches the pattern.
 */
function extractSectionName(step: Step): string | null {
  if (!step.every((item) => item.type === "text")) return null;
  const fullText = (step as Text[])
    .map((t) => t.value)
    .join("")
    .trim();
  const m = SECTION_RE.exec(fullText);
  return m ? (m[1] ?? null) : null;
}

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
  for (const item of step) {
    if (item.type === "ingredient") {
      hasIngredient = true;
    } else if (item.type === "text") {
      if (!PUNCTUATION_RE.test((item as Text).value)) return false;
    } else {
      // cookware / timer → not an ingredient-only step
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
function stepToText(step: Step): string {
  return step
    .map((item) => {
      switch (item.type) {
        case "text":
          return (item as Text).value;
        case "ingredient":
          return (item as Ingredient).name;
        case "timer": {
          const t = item as {
            name?: string;
            quantity: string | number;
            units: string;
          };
          return `${t.quantity} ${t.units}`.trim();
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

  const recipe = new Recipe(body);

  // ── Build ingredientGroups ────────────────────────────────────────────────
  //
  // Strategy:
  //  - Iterate recipe.steps in order.
  //  - A step matching `== Name ==` starts a new group with that name.
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

  for (const step of recipe.steps) {
    // Check for section header
    const sectionName = extractSectionName(step);
    if (sectionName !== null) {
      currentGroup = { name: sectionName, items: [] };
      groups.push(currentGroup);
      continue;
    }

    // Ingredient-only step — populate the current group
    if (isIngredientOnlyStep(step)) {
      for (const item of step) {
        if (item.type !== "ingredient") continue;
        const ing = item as Ingredient;
        const ingSlug = normalizeSlug(ing.name) as IngredientSlug;
        const ann = annotations[ingSlug];

        const rawQty = ing.quantity;
        const amount =
          rawQty !== "" && rawQty !== undefined
            ? typeof rawQty === "number"
              ? rawQty
              : parseFloat(String(rawQty))
            : undefined;
        const validAmount =
          amount !== undefined && !isNaN(amount) ? amount : undefined;

        const unitResult = ing.units
          ? UnitSchema.safeParse(ing.units)
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
    const text = stepToText(step);
    if (text) instructions.push(text);
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
