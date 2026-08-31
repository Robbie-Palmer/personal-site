"use client";

import { Check, Link2, Linkedin } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { siX, siYcombinator } from "simple-icons";
import { toast } from "sonner";
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
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied");
    } catch {
      setCopied(false);
      toast.error("Could not copy link");
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={copyLink}
          aria-label="Copy link"
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? "Copied" : "Share"}
        </Button>
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
