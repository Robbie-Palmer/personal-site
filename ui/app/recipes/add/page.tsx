import type { Metadata } from "next";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";

export const metadata: Metadata = {
  title: "Add Recipe",
  description:
    "Add a recipe using Cooklang, import schema.org Recipe data, or scan recipe photos.",
  robots: { index: false, follow: false },
};

export default function AddRecipePage() {
  return <AddRecipeView />;
}
