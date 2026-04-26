import { describe, expect, it } from "vitest";
import {
  buildCooklangDraftFromStructuredText,
  deriveRecipeFromCooklang,
  deriveRecipeFromStructuredText,
  recipeToCooklang,
} from "../../src/lib/cooklang.js";

describe("cooklang helpers", () => {
  it("round-trips a normalized recipe through Cooklang text", () => {
    const input = {
      title: "Tomato Pasta",
      description: "A quick pasta.",
      cuisine: "Italian",
      servings: 2,
      prepTime: 10,
      cookTime: 15,
      ingredientGroups: [
        {
          name: "Sauce",
          items: [
            { ingredient: "olive-oil", amount: 1, unit: "tbsp" as const },
            { ingredient: "fresh-tomatoes", amount: 400, unit: "g" as const },
          ],
        },
      ],
      instructions: [
        "Heat @olive oil{1%tbsp} in a #pan{}.",
        "Simmer for ~{15%minutes}.",
      ],
    };

    const cooklang = recipeToCooklang(input);
    const derived = deriveRecipeFromCooklang(cooklang);

    expect(derived.derived).toEqual({
      title: input.title,
      description: input.description,
      cuisine: input.cuisine,
      servings: input.servings,
      prepTime: input.prepTime,
      cookTime: input.cookTime,
      ingredientGroups: input.ingredientGroups,
      instructions: ["Heat olive oil 1 tbsp in a pan.", "Simmer for 15 minutes."],
    });
  });

  it("builds a deterministic Cooklang draft from structured text", () => {
    const cooklang = buildCooklangDraftFromStructuredText({
      title: "Traybake",
      description: "Roast everything together.",
      servingsText: "4",
      prepTimeText: "15",
      cookTimeText: "45",
      ingredientSections: [
        {
          name: "Main",
          lines: ["@chicken thighs{4%piece}", "@potatoes{600%g}"],
        },
      ],
      instructionLines: ["1. Roast the tray for ~{45%minutes}."],
      notes: [],
      equipment: ["tray"],
      timers: [],
    });

    expect(cooklang.frontmatter.servings).toBe(4);
    expect(cooklang.derived?.ingredientGroups[0]?.items[0]?.ingredient).toBe(
      "chicken-thighs",
    );
    expect(cooklang.derived?.instructions[0]).toBe("Roast the tray for 45 minutes.");
  });

  it("keeps invalid spaced units as ingredient descriptors", () => {
    const cooklang = buildCooklangDraftFromStructuredText({
      title: "Omelette",
      description: "Simple eggs.",
      servingsText: "1",
      ingredientSections: [{ lines: ["2 large eggs"] }],
      instructionLines: ["Whisk eggs."],
      notes: [],
      equipment: [],
      timers: [],
    });

    expect(cooklang.derived?.ingredientGroups[0]?.items[0]).toEqual({
      ingredient: "large-eggs",
      amount: 2,
    });
  });

  it("dedupes quantified and bare Cooklang ingredients by normalized name", () => {
    const derived = deriveRecipeFromCooklang({
      frontmatter: {
        title: "Toast",
        description: "Buttered toast.",
        servings: 1,
        tags: [],
      },
      body: "@olive oil{1%tbsp} @olive-oil\nServe.",
      diagnostics: [],
    });

    expect(derived.derived?.ingredientGroups[0]?.items).toEqual([
      { ingredient: "olive-oil", amount: 1, unit: "tbsp" },
    ]);
  });

  it("can derive a best-effort normalized recipe directly from structured text", () => {
    const derived = deriveRecipeFromStructuredText({
      title: "Cajun Sausage Pasta",
      ingredientSections: [
        {
          lines: [
            "320g pasta",
            "6 sausages",
            "4 tomatoes - diced",
            "2 tbsp tomato puree",
          ],
        },
      ],
      instructionLines: [
        "1) Cook pasta.",
        "2) Stir through the sauce.",
      ],
      notes: [],
      equipment: [],
      timers: [],
    });

    expect(derived.recipe?.title).toBe("Cajun Sausage Pasta");
    expect(derived.recipe?.servings).toBe(1);
    expect(derived.recipe?.ingredientGroups[0]?.items[0]?.ingredient).toBe("pasta");
    expect(derived.recipe?.instructions[0]).toBe("Cook pasta.");
    expect(derived.diagnostics).toContain(
      "Structured extraction inferred missing servings as 1.",
    );
  });

  it("diagnoses explicit serving inference for unparseable structured servings", () => {
    const derived = deriveRecipeFromStructuredText({
      title: "Soup",
      servingsText: "many",
      ingredientSections: [{ lines: ["1 onion"] }],
      instructionLines: ["Cook onion."],
      notes: [],
      equipment: [],
      timers: [],
    });

    expect(derived.recipe?.servings).toBe(1);
    expect(derived.diagnostics).toContain(
      "Structured extraction inferred unparseable servings as 1.",
    );
  });
});
