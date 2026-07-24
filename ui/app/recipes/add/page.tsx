import type { Metadata } from "next";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";

export const metadata: Metadata = {
  title: "Add Recipe",
  description:
    "Add a recipe manually, import a URL or local Cooklang or schema.org file, or scan a recipe photo.",
  robots: { index: false, follow: false },
};

export default function AddRecipePage() {
  return <AddRecipeView />;
}
