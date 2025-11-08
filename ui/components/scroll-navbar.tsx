"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function ScrollNavbar() {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Don't hide if we're near the top (within 100px)
      if (currentScrollY < 100) {
        setIsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      // Check scroll direction with a threshold to avoid jank
      // Only trigger if scrolled more than 80px (more deliberate gesture)
      if (Math.abs(currentScrollY - lastScrollYRef.current) < 80) {
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
  }, []);

  return (
    <header
      className={`
        sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
        transition-transform duration-300 ease-in-out
        ${isVisible ? "translate-y-0" : "-translate-y-full"}
      `}
    >
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold hover:text-primary">
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/blog">Blog</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/experience">Experience</Link>
          </Button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
