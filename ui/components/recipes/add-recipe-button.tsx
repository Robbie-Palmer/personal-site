"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AddRecipeButton() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending || !session) return null;

  return (
    <Button
      asChild
      className="rounded-full border border-[var(--terracotta-deep)] bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
    >
      <Link href="/recipes/add">
        <Plus /> Add recipe
      </Link>
    </Button>
  );
}
