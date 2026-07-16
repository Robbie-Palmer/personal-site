import type { Metadata } from "next";
import { Suspense } from "react";
import { SelectedProfile } from "@/components/recipes/profile/selected-profile";

export const metadata: Metadata = {
  title: "Profile",
  description: "See who you share a household and kitchen with.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <SelectedProfile />
    </Suspense>
  );
}
