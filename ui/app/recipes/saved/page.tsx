import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedRecipeView } from "@/components/recipes/saved-recipe-view";

export const metadata: Metadata = {
  title: "Saved Recipe",
  robots: { index: false, follow: false },
};

export default function SavedRecipePage() {
  return (
    <Suspense>
      <SavedRecipeView />
    </Suspense>
  );
}
