import type { Metadata } from "next";
import { RecipeLoadError } from "@/components/recipes/recipe-load-state";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflineRecipePage() {
  return (
    <RecipeLoadError
      title="You're offline"
      message="This page needs an internet connection. Your saved recipes are still available."
    />
  );
}
