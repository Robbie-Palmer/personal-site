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

  it("ranks recipes by missing ingredients then match ratio", () => {
    const matches = getKitchenRecipeMatches(
      [
        {
          slug: "risotto",
          title: "Risotto",
          description: "",
          cuisine: [],
          ingredients: [
            { slug: "rice", name: "rice" },
            { slug: "parmesan", name: "parmesan" },
            { slug: "stock", name: "stock" },
          ],
        },
        {
          slug: "pasta",
          title: "Pasta",
          description: "",
          cuisine: [],
          ingredients: [
            { slug: "pasta", name: "pasta" },
            { slug: "tomatoes", name: "tomatoes" },
          ],
        },
      ],
      ["pasta", "tomatoes", "rice"],
    );

    expect(matches[0]?.slug).toBe("pasta");
    expect(matches[0]?.missingIngredients).toEqual([]);
    expect(matches[1]?.slug).toBe("risotto");
    expect(matches[1]?.missingIngredients).toEqual([
      { slug: "parmesan", name: "parmesan" },
      { slug: "stock", name: "stock" },
    ]);
  });
});
