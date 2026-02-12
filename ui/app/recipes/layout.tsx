import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { siteConfig } from "@/lib/config/site-config";

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

  return (
    <div className="antialiased flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="container mx-auto px-4 py-4 max-w-7xl flex items-center justify-between gap-2">
          <Link
            href="/recipes"
            className="text-xl font-bold hover:text-primary"
          >
            Robbie's Recipes
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Main Site
            </Link>
            <AnimatedThemeToggler />
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              <Link
                href="/"
                className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
              >
                Back to Main Site
              </Link>
              {" · "}© {currentYear} {siteConfig.author.name}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
