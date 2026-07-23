"use client";

import { Linkedin } from "lucide-react";
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
    icon: <Linkedin className="size-4" />,
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
