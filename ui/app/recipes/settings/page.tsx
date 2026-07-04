import type { Metadata } from "next";
import { SettingsView } from "@/components/recipes/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account and sign-in for Robbie's Recipes.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsView />;
}
