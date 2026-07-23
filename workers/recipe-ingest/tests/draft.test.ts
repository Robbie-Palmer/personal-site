import { describe, expect, it } from "vitest";
import { deriveRecipeFromCooklang } from "recipe-parsing/cooklang";
import { buildFinalDraft } from "../src/draft";

describe("buildFinalDraft", () => {
  it("applies finalized ingredients without losing Cooklang structure", () => {
    const normalizedRecipe = {
      title: "Pepper Pasta",
      description: "A quick pasta.",
      cuisine: ["Italian-American"],
      servings: 2,
      prepTime: 10,
      cookTime: 20,
      ingredientGroups: [
        {
          items: [
            { ingredient: "capsicum", amount: 1, unit: "piece" as const },
          ],
        },
      ],
      instructions: ["Cook capsicum in a skillet for 10 minutes."],
      cookware: ["skillet"],
    };
    const draft = buildFinalDraft(
      ["imports/job/source/1.jpg"],
      {
        frontmatter: {
          title: normalizedRecipe.title,
          description: normalizedRecipe.description,
          cuisine: normalizedRecipe.cuisine,
          servings: normalizedRecipe.servings,
          prepTime: normalizedRecipe.prepTime,
          cookTime: normalizedRecipe.cookTime,
          tags: [],
        },
        body: "@capsicum{1%piece}\n\nCook @capsicum in a #skillet{} for ~{10%minutes}.",
        diagnostics: ["Normalization used a deterministic fallback."],
        derived: normalizedRecipe,
      },
      {
        ...normalizedRecipe,
        cuisine: ["Italian", "American"],
        ingredientGroups: [
          {
            items: [
              { ingredient: "bell-pepper", amount: 1, unit: "piece" },
            ],
          },
        ],
        cookware: ["frying pan"],
      },
      [
        {
          originalName: "skillet",
          baseSlug: "skillet",
          canonicalSlug: "frying-pan",
          method: "exact",
          score: 1,
          threshold: 1,
          candidates: [{ slug: "frying-pan", score: 1 }],
        },
      ],
    );

    expect(draft.cooklang.body).toContain("@bell pepper{1%piece}");
    expect(draft.cooklang.body).not.toContain("@capsicum");
    expect(draft.cooklang.body).toContain(
      "Cook @bell pepper{} in a #frying pan{} for ~{10%minutes}.",
    );
    expect(draft.cooklang.body).not.toContain("#skillet{}");
    expect(draft.cooklang.body).toContain("~{10%minutes}");
    expect(draft.cooklang.frontmatter.cuisine).toEqual([
      "Italian",
      "American",
    ]);
    expect(draft.cooklang.diagnostics).toEqual([
      "Normalization used a deterministic fallback.",
    ]);
    expect(draft.recipe.ingredientGroups[0]?.items[0]?.ingredient).toBe(
      "bell-pepper",
    );

    const reparsed = deriveRecipeFromCooklang(draft.cooklang);
    expect(reparsed.derived?.ingredientGroups[0]?.items[0]?.ingredient).toBe(
      "bell-pepper",
    );
    expect(reparsed.derived?.cookware).toEqual(["frying pan"]);
    expect(reparsed.derived?.instructions).toEqual([
      "Cook bell pepper in a frying pan for 10 minutes.",
    ]);
  });

  it("does not replace prefixes of longer braced tokens", () => {
    const normalizedRecipe = {
      title: "Rice Dressing",
      description: "A simple dressing.",
      cuisine: [],
      servings: 2,
      ingredientGroups: [
        {
          items: [
            { ingredient: "rice", amount: 1 },
            {
              ingredient: "rice-wine-vinegar",
              amount: 2,
              unit: "tbsp" as const,
            },
          ],
        },
      ],
      instructions: ["Combine the ingredients."],
      cookware: [],
    };
    const draft = buildFinalDraft(
      ["imports/job/source/1.jpg"],
      {
        frontmatter: {
          title: normalizedRecipe.title,
          description: normalizedRecipe.description,
          servings: normalizedRecipe.servings,
          tags: [],
        },
        body: "@rice{1}\n@rice wine vinegar{2%tbsp}\n\nCombine the ingredients.",
        diagnostics: [],
        derived: normalizedRecipe,
      },
      {
        ...normalizedRecipe,
        ingredientGroups: [
          {
            items: [
              { ingredient: "white-rice", amount: 1 },
              {
                ingredient: "rice-wine-vinegar",
                amount: 2,
                unit: "tbsp",
              },
            ],
          },
        ],
      },
      [],
    );

    expect(draft.cooklang.body).toContain("@white rice{1}");
    expect(draft.cooklang.body).toContain("@rice wine vinegar{2%tbsp}");
    expect(draft.cooklang.body).not.toContain("@white rice wine vinegar");
  });
});
