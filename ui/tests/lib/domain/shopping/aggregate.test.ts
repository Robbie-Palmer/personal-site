import { describe, expect, it } from "vitest";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import type { RecipeIngredientView } from "@/lib/domain/recipe";
import {
  aggregateShoppingList,
  type SelectedRecipe,
} from "@/lib/domain/shopping/aggregate";

function ing(
  ingredient: string,
  overrides: Partial<RecipeIngredientView> = {},
): RecipeIngredientView {
  return {
    ingredient,
    name: ingredient.replace(/-/g, " "),
    ...overrides,
  };
}

function recipe(
  slug: string,
  ingredients: RecipeIngredientView[],
  servings = 4,
): ShoppingRecipe {
  return {
    slug,
    title: slug,
    servings,
    cuisine: [],
    ingredients,
  };
}

function select(recipe: ShoppingRecipe, scale = 1): SelectedRecipe {
  return { recipe, scale };
}

function lineFor(
  lines: ReturnType<typeof aggregateShoppingList>,
  slug: string,
) {
  const line = lines.find((l) => l.ingredient === slug);
  if (!line) throw new Error(`no line for ${slug}`);
  return line;
}

describe("aggregateShoppingList", () => {
  it("sums the same ingredient across recipes when units match", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("garlic", { amount: 2, unit: "clove" })])),
      select(recipe("b", [ing("garlic", { amount: 3, unit: "clove" })])),
    ]);
    const garlic = lineFor(lines, "garlic");
    expect(garlic.quantities).toEqual([{ amount: 5, unit: "clove" }]);
    expect(garlic.recipes.map((r) => r.slug)).toEqual(["a", "b"]);
  });

  it("sums compatible units by converting to a base unit", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("pasta", { amount: 300, unit: "g" })])),
      select(recipe("b", [ing("pasta", { amount: 0.3, unit: "kg" })])),
    ]);
    expect(lineFor(lines, "pasta").quantities).toEqual([
      { amount: 600, unit: "g" },
    ]);
  });

  it("folds spoon measures into the volume base unit", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("oil", { amount: 1, unit: "tbsp" })])),
      select(recipe("b", [ing("oil", { amount: 1, unit: "tsp" })])),
    ]);
    // 15ml + 5ml
    expect(lineFor(lines, "oil").quantities).toEqual([
      { amount: 20, unit: "ml" },
    ]);
  });

  it("keeps incompatible units in separate buckets rather than throwing", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("tomato", { amount: 1, unit: "tin" })])),
      select(recipe("b", [ing("tomato", { amount: 400, unit: "g" })])),
    ]);
    const tomato = lineFor(lines, "tomato");
    // dimensional (g) sorts before discrete (tin)
    expect(tomato.quantities).toEqual([
      { amount: 400, unit: "g" },
      { amount: 1, unit: "tin" },
    ]);
  });

  it("scales amounts by the per-recipe multiplier", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("chicken", { amount: 600, unit: "g" })], 4), 2),
    ]);
    expect(lineFor(lines, "chicken").quantities).toEqual([
      { amount: 1200, unit: "g" },
    ]);
  });

  it("treats presence-only tags as no quantity but records the recipe", () => {
    const lines = aggregateShoppingList([select(recipe("a", [ing("salt")]))]);
    const salt = lineFor(lines, "salt");
    expect(salt.quantities).toEqual([]);
    expect(salt.recipes).toHaveLength(1);
  });

  it("keeps a quantified amount even when another recipe tags it bare", () => {
    const lines = aggregateShoppingList([
      select(recipe("a", [ing("basil")])),
      select(recipe("b", [ing("basil", { amount: 1, unit: "bag" })])),
    ]);
    expect(lineFor(lines, "basil").quantities).toEqual([
      { amount: 1, unit: "bag" },
    ]);
  });

  it("assigns an aisle from the ingredient category", () => {
    const lines = aggregateShoppingList([
      select(
        recipe("a", [
          ing("chicken", { amount: 1, unit: "piece", category: "protein" }),
          ing("onion", { amount: 1, unit: "piece", category: "vegetable" }),
        ]),
      ),
    ]);
    expect(lineFor(lines, "chicken").aisle).toBe("meat-fish");
    expect(lineFor(lines, "onion").aisle).toBe("produce");
  });
});
