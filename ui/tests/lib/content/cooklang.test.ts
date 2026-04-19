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
      "Heat pan over a medium heat with 1tbsp of olive oil.",
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
});
