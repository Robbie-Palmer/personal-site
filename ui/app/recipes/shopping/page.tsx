import type { Metadata } from "next";
import { ShoppingView } from "@/components/recipes/shopping/shopping-view";
import { getShoppingRecipes } from "@/lib/api/shopping";

export const metadata: Metadata = {
  title: "Shopping List",
  description:
    "Pick the recipes you want to cook and build a combined shopping list, grouped by aisle, by recipe, or as one ingredient list.",
};

export default function ShoppingPage() {
  const recipes = getShoppingRecipes();
  return <ShoppingView recipes={recipes} />;
}
