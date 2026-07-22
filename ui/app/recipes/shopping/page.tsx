import type { Metadata } from "next";
import { RecipeShopping } from "@/components/recipes/shopping/recipe-shopping";

export const metadata: Metadata = {
  title: "Shopping List",
  description:
    "Plan weekly meals, pick recipes, and build a combined shopping list grouped by aisle, by recipe, or as one ingredient list.",
  robots: { index: false, follow: false },
};

export default function ShoppingPage() {
  return <RecipeShopping />;
}
