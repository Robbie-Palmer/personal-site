"use client";

import type { EmblaOptionsType } from "embla-carousel";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCarousel } from "@/components/ui/content-carousel";
import { defaultCarouselConfig } from "@/lib/carousel-config";
import { formatDate } from "@/lib/date";
import type { ProjectADR } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";
import { ADRBadge } from "./adr-badge";

type ADRCarouselProps = {
  adrs: ProjectADR[];
  options?: EmblaOptionsType;
  autoScroll?: boolean;
  scrollSpeed?: number;
  stopOnInteraction?: boolean;
  stopOnMouseEnter?: boolean;
};

export function ADRCarousel({
  adrs,
  options,
  autoScroll = defaultCarouselConfig.autoScroll,
  scrollSpeed = defaultCarouselConfig.scrollSpeed,
  stopOnInteraction = defaultCarouselConfig.stopOnInteraction,
  stopOnMouseEnter = defaultCarouselConfig.stopOnMouseEnter,
}: ADRCarouselProps) {
  return (
    <ContentCarousel
      items={adrs}
      getItemKey={(adr) => `${adr.projectSlug}-${adr.slug}`}
      options={options}
      autoScroll={autoScroll}
      scrollSpeed={scrollSpeed}
      stopOnInteraction={stopOnInteraction}
      stopOnMouseEnter={stopOnMouseEnter}
      renderItem={(adr) => (
        <Card className="h-full flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 relative bg-card">
          <div className="absolute top-4 left-4 right-20 z-10 pointer-events-none">
            <div
              className="text-lg font-semibold text-muted-foreground truncate"
              title={adr.projectTitle}
            >
              {adr.projectTitle}
            </div>
          </div>
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <ADRBadge status={adr.status} />
          </div>
          <CardHeader className="flex-1 pt-12 mt-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors text-lg flex-1">
                  <Link
                    href={`/projects/${encodeURIComponent(adr.projectSlug)}/adrs/${encodeURIComponent(adr.slug)}`}
                    className="after:absolute after:inset-0"
                  >
                    {adr.title}
                  </Link>
                </CardTitle>
                <div className="flex flex-wrap gap-2 flex-shrink-0 pt-0.5 pointer-events-auto">
                  {adr.technologies?.slice(0, 5).map((tech) => {
                    const url = tech.website;
                    const hasIcon = hasTechIcon(tech.name);
                    if (!hasIcon && !url) return null;
                    const Icon = hasIcon ? (
                      <TechIcon
                        name={tech.name}
                        className="w-12 h-12 text-foreground transition-all"
                      />
                    ) : (
                      <ExternalLink className="w-12 h-12 text-foreground transition-all" />
                    );

                    if (url) {
                      return (
                        <a
                          key={tech.name}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Learn more about ${tech.name}`}
                          onClick={(e) => e.stopPropagation()}
                          className="z-20 relative p-1.5 rounded-md hover:bg-muted/80 hover:scale-110 transition-all -m-1.5"
                        >
                          {Icon}
                        </a>
                      );
                    }
                    return (
                      <div
                        key={tech.name}
                        title={tech.name}
                        className="p-1.5 -m-1.5"
                      >
                        {Icon}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              <time>{formatDate(adr.date)}</time>
              <span className="mx-2">·</span>
              <span>{adr.readingTime}</span>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
