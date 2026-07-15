"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/recipes/profile/profile-view";

function SelectedProfile() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user") ?? undefined;

  return <ProfileView userId={userId} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <SelectedProfile />
    </Suspense>
  );
}
