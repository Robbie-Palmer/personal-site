import type { Metadata } from "next";
import { SettingsView } from "@/components/recipes/settings/settings-view";
import { getKitchenIngredients } from "@/lib/api/recipes";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, sign-in, and diet for Robbie's Recipes.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsView dietIngredients={getKitchenIngredients()} />;
}
