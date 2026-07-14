"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelectedRecipeCount } from "@/hooks/use-shopping-list";

export function RecipeNavTabs() {
  const pathname = usePathname();
  const count = useSelectedRecipeCount();

  const onShopping = pathname === "/recipes/shopping";
  const onKitchen = pathname === "/recipes/kitchen";
  const onSettings = pathname?.startsWith("/recipes/settings") ?? false;
  const onNotifications =
    pathname?.startsWith("/recipes/notifications") ?? false;
  // Recipes covers the index and individual recipe pages, but not the shopping
  // or utility sections.
  const onRecipes =
    !onShopping && !onKitchen && !onSettings && !onNotifications;

  return (
    <div className="flex items-baseline gap-2 md:gap-4">
      <Link
        href="/recipes"
        className="rt-tab text-base lg:text-lg"
        data-active={onRecipes || undefined}
      >
        Recipes
      </Link>
      <Link
        href="/recipes/kitchen"
        className="rt-tab text-base lg:text-lg"
        data-active={onKitchen || undefined}
      >
        Kitchen
      </Link>
      <Link
        href="/recipes/shopping"
        className="rt-tab text-base lg:text-lg inline-flex items-center gap-1.5"
        data-active={onShopping || undefined}
      >
        Shopping
        {count > 0 && (
          <span
            role="img"
            aria-label={`${count} ${count === 1 ? "recipe" : "recipes"} selected`}
            className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-[var(--terracotta)] text-white text-[0.65rem] font-semibold leading-none"
          >
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}
