import type { Metadata } from "next";
import { RecipeOnboarding } from "@/components/recipes/onboarding/recipe-onboarding";

export const metadata: Metadata = {
  title: "Set up your recipe box",
  description: "Choose your diet and add a few recipes to your box.",
  robots: { index: false, follow: false },
};

export default function RecipeOnboardingPage() {
  return <RecipeOnboarding />;
}
