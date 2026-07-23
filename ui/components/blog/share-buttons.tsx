"use client";

import Link from "next/link";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { siX, siYcombinator } from "simple-icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getShareUrl,
  type SharePlatform,
} from "@/lib/integrations/social-share";

// simple-icons dropped LinkedIn and lucide's brand icons are deprecated, so the
// "in" mark is inlined to keep all three glyphs on the same solid 24x24 grid.
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

function BrandIcon({ path }: Readonly<{ path: string }>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

const SHARE_TARGETS: ReadonlyArray<{
  platform: SharePlatform;
  label: string;
  icon: ReactNode;
}> = [
  { platform: "x", label: "Share on X", icon: <BrandIcon path={siX.path} /> },
  {
    platform: "linkedin",
    label: "Share on LinkedIn",
    icon: <BrandIcon path={LINKEDIN_PATH} />,
  },
  {
    platform: "hackernews",
    label: "Share on Hacker News",
    icon: <BrandIcon path={siYcombinator.path} />,
  },
];

interface ShareButtonsProps {
  slug: string;
  title: string;
  url: string;
}

export function ShareButtons({
  slug,
  title,
  url,
}: Readonly<ShareButtonsProps>) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-sm mr-1">Share</span>
        {SHARE_TARGETS.map(({ platform, label, icon }) => (
          <Tooltip key={platform}>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <Link
                  href={getShareUrl(platform, { url, title })}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  onClick={() =>
                    posthog.capture("blog_post_shared", {
                      platform,
                      slug,
                      url,
                    })
                  }
                >
                  {icon}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
