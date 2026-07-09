import type { ShoppingRecipe } from "@/lib/api/shopping";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

export function formatRecipeTime(
  minutes: number | null | undefined,
): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** The one-line cuisine · time meta shown under a recipe title everywhere. */
export function recipeMetaLabel(recipe: ShoppingRecipe): string {
  return [
    recipe.cuisine.join(" · ").toLowerCase(),
    formatRecipeTime(recipe.totalTime),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The square recipe thumbnail shared by the picker grid and the slot picker, so
 * a recipe looks the same wherever it's chosen. Falls back to a warm block when
 * a recipe has no image.
 */
export function RecipeThumb({
  recipe,
  size = 64,
  className = "",
}: {
  recipe: ShoppingRecipe;
  size?: number;
  className?: string;
}) {
  const box = `${className} rounded-lg object-cover flex-shrink-0 bg-muted`;
  if (!recipe.image) {
    return (
      <div
        className={`${className} rounded-lg flex-shrink-0 bg-[var(--paper-warm)]`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: native img for SSG srcset control
    <img
      src={getImageUrl(recipe.image, null, { width: size * 2, format: "auto" })}
      alt={recipe.imageAlt || recipe.title}
      width={size}
      height={size}
      loading="lazy"
      className={box}
      style={{ width: size, height: size }}
    />
  );
}
