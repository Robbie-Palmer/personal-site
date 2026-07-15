"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/recipes/profile/profile-view";
import { authClient } from "@/lib/auth-client";

function SelectedProfile() {
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const userId = searchParams.get("user") ?? session?.user.id ?? "";

  return <ProfileView userId={userId} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <SelectedProfile />
    </Suspense>
  );
}
