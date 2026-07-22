import type { Metadata } from "next";
import { EditRecipeView } from "@/components/recipes/edit-recipe-view";

export const metadata: Metadata = {
  title: "Edit Recipe",
  description: "Edit your recipe with a live preview.",
  robots: { index: false, follow: false },
};

export default function EditRecipePage() {
  return <EditRecipeView />;
}
