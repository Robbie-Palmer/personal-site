import { describe, expect, it } from "vitest";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type { RecipeDetailView } from "@/lib/domain/recipe/recipeViews";
import {
  buildRecipeJsonLd,
  minutesToIsoDuration,
} from "@/lib/seo/recipe-jsonld";

function makeRecipeDetail(
  overrides: Partial<RecipeDetailView> = {},
): RecipeDetailView {
  return {
    slug: "lemon-tart",
    title: "Lemon Tart",
    description: "A sharp, silky lemon tart",
    date: "2024-01-01",
    cuisine: [],
    tags: [],
    servings: 4,
    cookBody: "Step 1",
    cookware: [],
    ingredientGroups: [
      {
        items: [
          {
            ingredient: "lemon" as IngredientSlug,
            name: "lemon",
            pluralName: "lemons",
            amount: 2,
            preparation: "zested",
          },
        ],
      },
    ],
    instructions: ["Zest the lemons", "Bake the tart"],
    ...overrides,
  };
}

describe("minutesToIsoDuration", () => {
  it("formats minutes-only durations", () => {
    expect(minutesToIsoDuration(45)).toBe("PT45M");
  });

  it("formats whole hours", () => {
    expect(minutesToIsoDuration(120)).toBe("PT2H");
  });

  it("formats mixed hours and minutes", () => {
    expect(minutesToIsoDuration(75)).toBe("PT1H15M");
  });
});

describe("buildRecipeJsonLd", () => {
  const url = "https://example.com/recipes/lemon-tart";

  it("builds a schema.org Recipe with required fields and the page URL", () => {
    const jsonLd = buildRecipeJsonLd(makeRecipeDetail(), "Test Author", url);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Recipe");
    expect(jsonLd.name).toBe("Lemon Tart");
    expect(jsonLd.url).toBe(url);
    expect(jsonLd.author).toEqual({ "@type": "Person", name: "Test Author" });
    expect(jsonLd.datePublished).toBe("2024-01-01");
    expect(jsonLd.recipeYield).toBe("4 servings");
    expect(jsonLd.recipeIngredient).toEqual(["2 lemons (zested)"]);
    expect(jsonLd.recipeInstructions).toEqual([
      { "@type": "HowToStep", text: "Zest the lemons" },
      { "@type": "HowToStep", text: "Bake the tart" },
    ]);
  });

  it("converts times to ISO 8601 durations", () => {
    const jsonLd = buildRecipeJsonLd(
      makeRecipeDetail({ prepTime: 20, cookTime: 70, totalTime: 90 }),
      "Test Author",
      url,
    );

    expect(jsonLd.prepTime).toBe("PT20M");
    expect(jsonLd.cookTime).toBe("PT1H10M");
    expect(jsonLd.totalTime).toBe("PT1H30M");
  });

  it("omits optional fields when absent", () => {
    const jsonLd = buildRecipeJsonLd(
      makeRecipeDetail({ description: "" }),
      "Test Author",
      url,
    );

    expect(jsonLd.description).toBeUndefined();
    expect(jsonLd.prepTime).toBeUndefined();
    expect(jsonLd.recipeCuisine).toBeUndefined();
    expect(jsonLd.keywords).toBeUndefined();
    expect(jsonLd.isBasedOn).toBeUndefined();
  });

  it("includes cuisine, keywords, and the source recipe when present", () => {
    const jsonLd = buildRecipeJsonLd(
      makeRecipeDetail({
        cuisine: ["French"],
        tags: ["dessert"],
        canonical: "https://example.org/original",
      }),
      "Test Author",
      url,
    );

    expect(jsonLd.recipeCuisine).toBe("French");
    expect(jsonLd.keywords).toBe("dessert, French");
    expect(jsonLd.isBasedOn).toEqual({
      "@type": "Recipe",
      url: "https://example.org/original",
    });
  });
});
