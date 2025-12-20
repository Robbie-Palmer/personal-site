"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useNavbarVisibility } from "@/hooks/use-navbar-visibility";
import { siteConfig } from "@/lib/site-config";

const headerVariants = cva(
  "sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-200 ease-in-out",
  {
    variants: {
      visible: {
        true: "translate-y-0",
        false: "-translate-y-full",
      },
    },
    defaultVariants: {
      visible: true,
    },
  },
);

export function ScrollNavbar() {
  const isVisible = useNavbarVisibility();

  return (
    <header className={headerVariants({ visible: isVisible })}>
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div id="navbar-actions" className="lg:hidden flex items-center" />
          <Link href="/" className="text-xl font-bold hover:text-primary">
            <span className="md:hidden">RP</span>
            <span className="hidden md:inline">{siteConfig.name}</span>
          </Link>
        </div>
        <div className="contents md:flex md:items-center md:gap-2">
          <Button variant="ghost" className="px-2 md:px-4" asChild>
            <Link href="/blog">Blog</Link>
          </Button>
          <Button variant="ghost" className="px-2 md:px-4" asChild>
            <Link href="/projects">Projects</Link>
          </Button>
          <Button variant="ghost" className="px-2 md:px-4" asChild>
            <Link href="/experience">Experience</Link>
          </Button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
