import { describe, expect, it } from "vitest";
import { parseCookFile } from "@/lib/content/cooklang";

function makeCookFile(body: string): string {
  return `---
title: "Test Recipe"
description: "Test Description"
date: "2026-04-17"
servings: 2
---

${body}
`;
}

describe("parseCookFile", () => {
  it("sums repeated ingredient quantities within the same section", () => {
    const recipe = parseCookFile(
      makeCookFile(`== Main ==

Heat @olive oil{4%tbsp} in a #pan{}.
Heat the remaining @olive oil{4%tbsp} in the same #pan{}.
`),
      "test-recipe",
    );

    expect(recipe.ingredientGroups).toEqual([
      {
        name: "Main",
        items: [{ ingredient: "olive-oil", amount: 8, unit: "tbsp" }],
      },
    ]);
  });

  it("keeps repeated zero-quantity mentions without double counting", () => {
    const recipe = parseCookFile(
      makeCookFile(`== Main ==

Drizzle with @olive oil{2%tbsp}.
Brush with a little @olive oil{}.
`),
      "test-recipe",
    );

    expect(recipe.ingredientGroups).toEqual([
      {
        name: "Main",
        items: [{ ingredient: "olive-oil", amount: 2, unit: "tbsp" }],
      },
    ]);
  });

  it("uses cookware display aliases in rendered instructions", () => {
    const recipe = parseCookFile(
      makeCookFile(`== Main ==

Heat #frying pan|pan{} over a medium heat with @olive oil{1%tbsp}.
`),
      "test-recipe",
    );

    expect(recipe.instructions).toEqual([
      "Heat pan over a medium heat with 1 tbsp of olive oil.",
    ]);
    expect(recipe.instructionSdk?.cookwareDisplayValues).toEqual(["pan"]);
  });

  it("throws for incompatible duplicate ingredient units", () => {
    expect(() =>
      parseCookFile(
        makeCookFile(`== Main ==

Heat @olive oil{4%tbsp} in a #pan{}.
Heat the remaining @olive oil{30%ml} in the same #pan{}.
`),
        "test-recipe",
      ),
    ).toThrow(/Conflicting duplicate ingredient "olive-oil"/);
  });

  it("normalizes plural and full-word ingredient units from cooklang content", () => {
    const recipe = parseCookFile(
      makeCookFile(`== Main ==

Add @garlic{2%cloves}, @bread{3%slices}, @stock{2%litres}, @milk{1%pints}, @sugar{2%tbsps}, and @salt{3%tsps}.
`),
      "test-recipe",
    );

    expect(recipe.ingredientGroups).toEqual([
      {
        name: "Main",
        items: [
          { ingredient: "garlic", amount: 2, unit: "clove" },
          { ingredient: "bread", amount: 3, unit: "slice" },
          { ingredient: "stock", amount: 2, unit: "l" },
          { ingredient: "milk", amount: 1, unit: "uk_pint" },
          { ingredient: "sugar", amount: 2, unit: "tbsp" },
          { ingredient: "salt", amount: 3, unit: "tsp" },
        ],
      },
    ]);
    expect(recipe.instructionSdk?.ingredientUnits).toEqual([
      "clove",
      "slice",
      "l",
      "uk_pint",
      "tbsp",
      "tsp",
    ]);
    expect(recipe.instructions).toEqual([
      "Add 2 cloves of garlic, 3 slices of bread, 2l of stock, 1 pint of milk, 2 tbsp of sugar, and 3 tsp of salt.",
    ]);
  });
});
