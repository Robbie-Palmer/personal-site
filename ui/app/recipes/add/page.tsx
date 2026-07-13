import type { Metadata } from "next";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";

export const metadata: Metadata = {
  title: "Add Recipe",
  description: "Add a recipe using inline Cooklang syntax.",
  robots: { index: false, follow: false },
};

export default function AddRecipePage() {
  return <AddRecipeView />;
}
