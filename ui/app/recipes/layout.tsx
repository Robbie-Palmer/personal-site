import type { Metadata } from "next";
import { Caveat, JetBrains_Mono, Kalam } from "next/font/google";
import Link from "next/link";
import { AuthButton } from "@/components/recipes/auth-button";
import { RecipeNavTabs } from "@/components/recipes/recipe-nav-tabs";
import { RecipeThemeBody } from "@/components/recipes/recipe-theme-body";
import { TimerDock } from "@/components/recipes/timer-dock";
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
    <>
      {/* Mirror the theme + fonts onto <body> so portaled UI (mobile filter
          drawer, popovers) inherits the warm palette instead of the dark base. */}
      <RecipeThemeBody classNames={`recipe-theme ${fontVars}`} />
      <div
        className={`recipe-theme recipe-surface ${fontVars} antialiased flex flex-col min-h-screen`}
      >
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/75">
          <nav className="container mx-auto px-4 py-3 max-w-7xl flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/recipes"
              className="order-1 shrink-0 rt-display text-3xl leading-none text-foreground"
            >
              <span>Robbie's</span>{" "}
              <span className="rt-logo-accent">recipes</span>
            </Link>
            <div className="order-3 w-full sm:order-2 sm:w-auto">
              <RecipeNavTabs />
            </div>
            <div className="order-2 ms-auto sm:order-3">
              <AuthButton />
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
    </>
  );
}
