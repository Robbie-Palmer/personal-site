"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

interface CTAButtonProps {
  href: string;
  label: string;
  variant?: "default" | "outline";
  animationDelay: string;
}

function CTAButton({ href, label, variant, animationDelay }: CTAButtonProps) {
  return (
    <Button
      size="lg"
      variant={variant}
      asChild
      className="w-full sm:w-auto animate-in fade-in zoom-in duration-300"
      style={{ animationDelay, animationFillMode: "both" }}
    >
      <Link
        href={href}
        onClick={() =>
          posthog.capture("cta_clicked", {
            cta_text: label,
            destination: href,
            location: "homepage_hero",
          })
        }
      >
        {label}
      </Link>
    </Button>
  );
}

export function HomeCTAButtons() {
  return (
    <div className="flex gap-4 justify-center flex-wrap">
      <CTAButton
        href="/blog"
        label="Read Blog"
        variant="outline"
        animationDelay="2100ms"
      />
      <CTAButton
        href="/projects"
        label="Explore Projects"
        animationDelay="2400ms"
      />
      <CTAButton
        href="/experience"
        label="View Experience"
        variant="outline"
        animationDelay="2700ms"
      />
    </div>
  );
}
