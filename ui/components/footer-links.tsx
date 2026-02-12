"use client";

import { Github, Linkedin } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";

interface FooterLinksProps {
  linkedInUrl: string;
  sourceUrl: string;
  githubUrl: string;
}

export function FooterLinks({
  linkedInUrl,
  sourceUrl,
  githubUrl,
}: FooterLinksProps) {
  return (
    <>
      <div className="flex items-center gap-6">
        <Link
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:opacity-60 transition-opacity"
          aria-label="GitHub"
          onClick={() =>
            posthog.capture("social_link_clicked", {
              platform: "github",
              url: githubUrl,
              location: "footer",
            })
          }
        >
          <Github className="h-6 w-6" />
        </Link>
        <Link
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:opacity-60 transition-opacity"
          aria-label="LinkedIn"
          onClick={() =>
            posthog.capture("social_link_clicked", {
              platform: "linkedin",
              url: linkedInUrl,
              location: "footer",
            })
          }
        >
          <Linkedin className="h-6 w-6" />
        </Link>
      </div>

      <Link
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
        onClick={() =>
          posthog.capture("source_code_viewed", {
            source: "footer",
            url: sourceUrl,
          })
        }
      >
        View Source
      </Link>
    </>
  );
}
