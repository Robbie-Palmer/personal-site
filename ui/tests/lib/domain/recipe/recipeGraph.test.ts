import { describe, expect, it } from "vitest";
import { buildRecipeContentGraph } from "@/lib/domain/recipe/recipeGraph";

describe("buildRecipeContentGraph", () => {
  it("builds ingredient edges for recipes", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: ["chicken-breast", "rice", "onion"],
      recipeIngredients: new Map([
        ["curry", ["chicken-breast", "rice", "onion"]],
      ]),
      recipeCuisines: new Map(),
    });

    const ingredients = graph.edges.usesIngredient.get("curry");
    expect(ingredients).toBeDefined();
    expect(ingredients?.has("chicken-breast")).toBe(true);
    expect(ingredients?.has("rice")).toBe(true);
    expect(ingredients?.has("onion")).toBe(true);
  });

  it("builds reverse ingredient edges", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: ["chicken-breast", "rice"],
      recipeIngredients: new Map([
        ["curry", ["chicken-breast", "rice"]],
        ["risotto", ["chicken-breast"]],
      ]),
      recipeCuisines: new Map(),
    });

    const chickenRecipes = graph.reverse.ingredientUsedBy.get("chicken-breast");
    expect(chickenRecipes).toBeDefined();
    expect(chickenRecipes?.has("curry")).toBe(true);
    expect(chickenRecipes?.has("risotto")).toBe(true);

    const riceRecipes = graph.reverse.ingredientUsedBy.get("rice");
    expect(riceRecipes?.has("curry")).toBe(true);
    expect(riceRecipes?.has("risotto")).toBe(false);
  });

  it("builds cuisine edges for recipes", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map(),
      recipeCuisines: new Map([
        ["curry", "Asian"],
        ["risotto", "Italian"],
      ]),
    });

    expect(graph.edges.hasCuisine.get("curry")).toBe("Asian");
    expect(graph.edges.hasCuisine.get("risotto")).toBe("Italian");
  });

  it("builds reverse cuisine edges", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map(),
      recipeCuisines: new Map([
        ["curry", "Asian"],
        ["satay", "Asian"],
        ["risotto", "Italian"],
      ]),
    });

    const asianRecipes = graph.reverse.cuisineUsedBy.get("Asian");
    expect(asianRecipes?.has("curry")).toBe(true);
    expect(asianRecipes?.has("satay")).toBe(true);
    expect(asianRecipes?.has("risotto")).toBe(false);
  });

  it("initialises empty sets for all registered ingredients", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: ["chicken-breast", "unused-spice"],
      recipeIngredients: new Map([["curry", ["chicken-breast"]]]),
      recipeCuisines: new Map(),
    });

    expect(graph.reverse.ingredientUsedBy.get("unused-spice")).toBeDefined();
    expect(graph.reverse.ingredientUsedBy.get("unused-spice")?.size).toBe(0);
  });

  it("skips recipes with empty ingredient lists", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map([["empty-recipe", []]]),
      recipeCuisines: new Map(),
    });

    expect(graph.edges.usesIngredient.has("empty-recipe")).toBe(false);
  });
});
