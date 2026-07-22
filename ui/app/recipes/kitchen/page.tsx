import type { Metadata } from "next";
import { RecipeKitchen } from "@/components/recipes/kitchen/recipe-kitchen";

export const metadata: Metadata = {
  title: "Kitchen",
  description: "Track what is in your kitchen and find recipes you can make.",
  robots: { index: false },
};

export default function KitchenPage() {
  return <RecipeKitchen />;
}
