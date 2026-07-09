import type { Metadata } from "next";
import { KitchenView } from "@/components/recipes/kitchen/kitchen-view";
import { getKitchenIngredients, getKitchenRecipes } from "@/lib/api/recipes";

export const metadata: Metadata = {
  title: "Kitchen",
  description: "Track what is in your kitchen and find recipes you can make.",
};

export default function KitchenPage() {
  return (
    <KitchenView
      ingredients={getKitchenIngredients()}
      recipes={getKitchenRecipes()}
    />
  );
}
