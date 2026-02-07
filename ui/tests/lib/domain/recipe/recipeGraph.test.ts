import { describe, expect, it } from "vitest";
import { buildRecipeContentGraph } from "@/lib/domain/recipe/recipeGraph";

describe("buildRecipeContentGraph", () => {
  it("builds ingredient edges for recipes", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: ["chicken-breast", "rice", "onion"],
      recipeIngredients: new Map([
        ["curry", ["chicken-breast", "rice", "onion"]],
      ]),
      recipeTags: new Map(),
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
      recipeTags: new Map(),
    });

    const chickenRecipes = graph.reverse.ingredientUsedBy.get("chicken-breast");
    expect(chickenRecipes).toBeDefined();
    expect(chickenRecipes?.has("curry")).toBe(true);
    expect(chickenRecipes?.has("risotto")).toBe(true);

    const riceRecipes = graph.reverse.ingredientUsedBy.get("rice");
    expect(riceRecipes?.has("curry")).toBe(true);
    expect(riceRecipes?.has("risotto")).toBe(false);
  });

  it("builds tag edges for recipes", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map(),
      recipeTags: new Map([
        ["curry", ["asian", "spicy"]],
        ["risotto", ["italian"]],
      ]),
    });

    expect(graph.edges.hasTag.get("curry")?.has("asian")).toBe(true);
    expect(graph.edges.hasTag.get("curry")?.has("spicy")).toBe(true);
    expect(graph.edges.hasTag.get("risotto")?.has("italian")).toBe(true);
  });

  it("builds reverse tag edges", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map(),
      recipeTags: new Map([
        ["curry", ["asian"]],
        ["satay", ["asian"]],
        ["risotto", ["italian"]],
      ]),
    });

    const asianRecipes = graph.reverse.tagUsedBy.get("asian");
    expect(asianRecipes?.has("curry")).toBe(true);
    expect(asianRecipes?.has("satay")).toBe(true);
    expect(asianRecipes?.has("risotto")).toBe(false);
  });

  it("initialises empty sets for all registered ingredients", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: ["chicken-breast", "unused-spice"],
      recipeIngredients: new Map([["curry", ["chicken-breast"]]]),
      recipeTags: new Map(),
    });

    expect(graph.reverse.ingredientUsedBy.get("unused-spice")).toBeDefined();
    expect(graph.reverse.ingredientUsedBy.get("unused-spice")?.size).toBe(0);
  });

  it("skips recipes with empty ingredient lists", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map([["empty-recipe", []]]),
      recipeTags: new Map(),
    });

    expect(graph.edges.usesIngredient.has("empty-recipe")).toBe(false);
  });

  it("skips recipes with empty tag lists", () => {
    const graph = buildRecipeContentGraph({
      ingredientSlugs: [],
      recipeIngredients: new Map(),
      recipeTags: new Map([["untagged", []]]),
    });

    expect(graph.edges.hasTag.has("untagged")).toBe(false);
  });
});
