import type { Metadata } from "next";
import { CookingLog } from "@/components/recipes/cooking-log";

export const metadata: Metadata = {
  title: "Cook Log",
  description: "See what you cooked, when you cooked it, and how often.",
  robots: { index: false, follow: false },
};

export default function CookLogPage() {
  return <CookingLog />;
}
