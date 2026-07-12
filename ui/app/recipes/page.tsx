import type { Metadata } from "next";
import { RecipeBoxView } from "@/components/recipes/recipe-box-view";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { getAllRecipes } from "@/lib/api/recipes";
import { siteConfig } from "@/lib/config/site-config";
import { buildRecipeListJsonLd } from "@/lib/seo/recipe-jsonld";

export const metadata: Metadata = {
  title: "All Recipes",
  description: "Browse all of my favorite recipes",
};

export default function RecipesPage() {
  const recipes = getAllRecipes();
  const jsonLd = buildRecipeListJsonLd(recipes, siteConfig.url);

  const cuisineCount = new Set(recipes.flatMap((recipe) => recipe.cuisine))
    .size;
  const ingredientCount = new Set(
    recipes.flatMap((recipe) => recipe.ingredientNames),
  ).size;
  const cookwareCount = new Set(recipes.flatMap((recipe) => recipe.cookware))
    .size;
  const catalogStats = [
    cuisineCount > 0 &&
      `${cuisineCount} ${cuisineCount === 1 ? "cuisine" : "cuisines"}`,
    `${ingredientCount} ${ingredientCount === 1 ? "ingredient" : "ingredients"}`,
    `${cookwareCount} ${cookwareCount === 1 ? "tool" : "tools"}`,
  ].filter((stat): stat is string => Boolean(stat));

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <RecipeBoxView recipes={recipes} catalogStats={catalogStats} />
    </>
  );
}
