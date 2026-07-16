import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicCooksView } from "@/components/recipes/public-cooks-view";

export const metadata: Metadata = {
  title: "Cooks",
  description: "Meet home cooks through the public recipes they share.",
};

export default function CooksPage() {
  return (
    <Suspense fallback={null}>
      <PublicCooksView />
    </Suspense>
  );
}
