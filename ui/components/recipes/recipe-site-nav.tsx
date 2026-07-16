"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RecipeNavTabs } from "@/components/recipes/recipe-nav-tabs";
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
    return <div className="h-6 w-56" aria-hidden="true" />;
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
