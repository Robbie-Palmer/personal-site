import { describe, expect, it } from "vitest";
import {
  getDefaultKitchenLocation,
  getKitchenRecipeMatches,
  isKitchenLocation,
  KITCHEN_LOCATIONS,
} from "@/lib/domain/recipe/kitchen";

describe("kitchen helpers", () => {
  it("defines the supported locations once for kitchen features", () => {
    expect(KITCHEN_LOCATIONS.map((location) => location.id)).toEqual([
      "fridge",
      "cupboards",
      "fresh",
    ]);
    expect(isKitchenLocation("freezer")).toBe(false);
    expect(isKitchenLocation("fridge")).toBe(true);
  });

  it("places ingredients into practical default kitchen locations", () => {
    expect(getDefaultKitchenLocation({ name: "milk", category: "dairy" })).toBe(
      "fridge",
    );
    expect(
      getDefaultKitchenLocation({ name: "fresh basil", category: "herb" }),
    ).toBe("fresh");
    expect(
      getDefaultKitchenLocation({ name: "penne pasta", category: "grain" }),
    ).toBe("cupboards");
  });

  it("ranks recipes by match ratio then missing ingredients", () => {
    const matches = getKitchenRecipeMatches(
      [
        {
          slug: "small-recipe",
          title: "Small Recipe",
          description: "",
          cuisine: [],
          ingredients: [
            { slug: "pasta", name: "pasta" },
            { slug: "tomatoes", name: "tomatoes" },
          ],
        },
        {
          slug: "larger-recipe",
          title: "Larger Recipe",
          description: "",
          cuisine: [],
          ingredients: [
            { slug: "rice", name: "rice" },
            { slug: "parmesan", name: "parmesan" },
            { slug: "stock", name: "stock" },
            { slug: "peas", name: "peas" },
            { slug: "butter", name: "butter" },
          ],
        },
      ],
      ["pasta", "rice", "parmesan", "stock", "peas"],
    );

    expect(matches[0]?.slug).toBe("larger-recipe");
    expect(matches[0]?.matchRatio).toBe(0.8);
    expect(matches[0]?.missingIngredients).toEqual([
      { slug: "butter", name: "butter" },
    ]);
    expect(matches[1]?.slug).toBe("small-recipe");
    expect(matches[1]?.matchRatio).toBe(0.5);
    expect(matches[1]?.missingIngredients).toEqual([
      { slug: "tomatoes", name: "tomatoes" },
    ]);
  });
});
