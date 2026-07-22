import type { Metadata } from "next";
import { RecipeHome } from "@/components/recipes/recipe-home";

export const metadata: Metadata = {
  title: "Recipes for real life",
  description:
    "Discover what home cooks are making and keep the recipes you want to cook again.",
};

export default function RecipesPage() {
  return <RecipeHome />;
}
