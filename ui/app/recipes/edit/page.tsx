import type { Metadata } from "next";
import { Suspense } from "react";
import { EditRecipeView } from "@/components/recipes/edit-recipe-view";

export const metadata: Metadata = {
  title: "Edit Recipe",
  description: "Edit your recipe with a live preview.",
  robots: { index: false, follow: false },
};

export default function EditRecipePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="rt-mono text-[var(--ink-3)]">Loading recipe editor…</p>
        </div>
      }
    >
      <EditRecipeView />
    </Suspense>
  );
}
