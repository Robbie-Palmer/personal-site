"use client";

import { useSearchParams } from "next/navigation";
import { ProfileView } from "@/components/recipes/profile/profile-view";

export function SelectedProfile() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user") ?? undefined;

  return <ProfileView userId={userId} />;
}
