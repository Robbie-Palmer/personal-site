import type { Metadata } from "next";
import { Caveat, JetBrains_Mono, Kalam } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/recipes/auth-button";
import { RecipeNavTabs } from "@/components/recipes/recipe-nav-tabs";
import { RecipeSearch } from "@/components/recipes/recipe-search";
import { RecipeSearchUrlSync } from "@/components/recipes/recipe-search-url-sync";
import { RecipeThemeBody } from "@/components/recipes/recipe-theme-body";
import { TimerDock } from "@/components/recipes/timer-dock";
import { RecipeSearchProvider } from "@/contexts/recipe-search-context";
import { siteConfig } from "@/lib/config/site-config";
import "./recipe-theme.css";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-kalam",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Robbie's Recipes",
    template: "%s | Robbie's Recipes",
  },
  description: "A collection of my favorite recipes",
};

export default function RecipesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();
  const fontVars = `${caveat.variable} ${kalam.variable} ${jetBrainsMono.variable}`;

  return (
    <RecipeSearchProvider>
      {/* Mirror the theme + fonts onto <body> so portaled UI (mobile filter
          drawer, popovers) inherits the warm palette instead of the dark base. */}
      <RecipeThemeBody classNames={`recipe-theme ${fontVars}`} />
      <Suspense fallback={null}>
        <RecipeSearchUrlSync />
      </Suspense>
      <div
        className={`recipe-theme recipe-surface ${fontVars} antialiased flex flex-col min-h-screen`}
      >
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/75">
          {/* On desktop everything sits on one row (logo · tab · search · auth);
              on mobile/tablet the search drops to a full-width second row so it
              isn't squeezed against the logo. */}
          <nav className="container mx-auto px-4 py-3 max-w-7xl flex flex-wrap items-center gap-x-2 sm:gap-x-4 lg:gap-x-6 gap-y-3">
            <div className="order-1 flex items-baseline gap-2 sm:gap-4 md:gap-6">
              <Link
                href="/recipes"
                className="shrink-0 rt-display text-3xl leading-none text-foreground"
              >
                {/* Stack onto two lines on mobile so the logo doesn't eat half
                    the row and crowd out the tabs + auth button; one line from
                    sm up where there's room. */}
                <span className="block sm:inline">Robbie's</span>{" "}
                <span className="rt-logo-accent">recipes</span>
              </Link>
              <RecipeNavTabs />
            </div>
            <div className="order-2 ms-auto lg:order-3 lg:ms-0">
              <AuthButton />
            </div>
            <div className="order-3 w-full lg:order-2 lg:w-64 lg:ms-auto">
              <RecipeSearch />
            </div>
          </nav>
        </header>

        <main className="relative z-0 flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-[var(--line)] mt-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col items-center gap-4">
              <p className="rt-mono text-[var(--ink-3)]">
                © {currentYear} {siteConfig.author.name}
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Outside the isolated .recipe-surface stacking context so it paints
          above the cook-mode overlay (which portals to <body>). Theme tokens
          come from the classes RecipeThemeBody mirrors onto <body>. */}
      <TimerDock />
    </RecipeSearchProvider>
  );
}
