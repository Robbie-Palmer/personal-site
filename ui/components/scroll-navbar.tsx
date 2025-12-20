"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { BREAKPOINTS } from "@/lib/breakpoints";
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
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const isMobile = useMediaQuery({ maxWidth: BREAKPOINTS.md - 1 });

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Don't hide if we're near the top (within 100px)
      if (currentScrollY < 100) {
        setIsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      // Higher threshold on mobile (120px) vs desktop (80px) to accommodate swipe gestures
      const scrollThreshold = isMobile ? 120 : 80;

      // Check scroll direction with a threshold to avoid jank
      if (Math.abs(currentScrollY - lastScrollYRef.current) < scrollThreshold) {
        return;
      }

      if (currentScrollY > lastScrollYRef.current) {
        // Scrolling down - hide navbar
        setIsVisible(false);
      } else {
        // Scrolling up - show navbar
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    // Passive listener for better scroll performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  return (
    <header className={headerVariants({ visible: isVisible })}>
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold hover:text-primary">
          <span className="md:hidden">RP</span>
          <span className="hidden md:inline">{siteConfig.name}</span>
        </Link>
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
