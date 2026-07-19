"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RecipeNavTabs } from "@/components/recipes/recipe-nav-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

const publicTabs = [
  { href: "/recipes/discover", label: "Discover", match: "/recipes/discover" },
  { href: "/recipes/cooks", label: "Cooks", match: "/recipes/cooks" },
  { href: "/recipes#how-it-works", label: "How it works", match: null },
] as const;

export function RecipeSiteNav() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Loading recipe navigation"
        className="flex items-center gap-3 sm:gap-4"
      >
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
    );
  }

  if (session) return <RecipeNavTabs />;

  return (
    <div className="flex items-baseline gap-3 sm:gap-4">
      {publicTabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className="rt-tab whitespace-nowrap text-base lg:text-lg"
          data-active={
            tab.match && pathname?.startsWith(tab.match) ? true : undefined
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
