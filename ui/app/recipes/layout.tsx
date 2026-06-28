import type { Metadata } from "next";
import { Caveat, JetBrains_Mono, Kalam } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/recipes/auth-button";
import { RecipeSearch } from "@/components/recipes/recipe-search";
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
    <div
      className={`recipe-theme ${fontVars} antialiased flex flex-col min-h-screen`}
    >
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/75">
        <nav className="container mx-auto px-4 py-3 max-w-7xl flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/recipes"
            className="rt-display text-3xl leading-none text-foreground"
          >
            Robbie's <span className="rt-logo-accent">recipes</span>
          </Link>
          <Link
            href="/recipes"
            className="rt-tab text-[0.95rem]"
            data-active="true"
          >
            Recipes
          </Link>
          <div className="ms-auto flex flex-1 items-center justify-end gap-3 min-w-0">
            <Suspense
              fallback={
                <div className="h-[42px] w-full sm:w-56 md:w-64 rounded-full border-[1.5px] border-foreground/80 bg-card" />
              }
            >
              <RecipeSearch />
            </Suspense>
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
  );
}
