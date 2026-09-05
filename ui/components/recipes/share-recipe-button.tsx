"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isAbortError } from "@/lib/generic/errors";

export function ShareRecipeButton({
  recipeSlug,
  recipeTitle,
}: Readonly<{ recipeSlug: string; recipeTitle: string }>) {
  async function share() {
    const url = new URL(
      `/recipes/${encodeURIComponent(recipeSlug)}`,
      window.location.origin,
    ).toString();

    if (navigator.share) {
      try {
        await navigator.share({ title: recipeTitle, url });
        return;
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Recipe link copied");
    } catch {
      toast.error("The recipe link could not be copied.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={share}
    >
      <Share2 /> Share
    </Button>
  );
}
