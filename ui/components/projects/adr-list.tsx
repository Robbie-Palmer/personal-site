"use client";

import { ArrowUpDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ADR } from "@/lib/projects";
import { getTechUrl, hasTechIcon, TechIcon } from "@/lib/tech-icons";
import { useSortParam } from "@/lib/use-sort-param";
import { ADRBadge } from "./adr-badge";

interface ADRListProps {
  projectSlug: string;
  adrs: ADR[];
  description?: React.ReactNode;
}

const SORT_OPTIONS = ["newest", "oldest"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export function ADRList({ projectSlug, adrs, description }: ADRListProps) {
  const { currentSort, cycleSortOrder } = useSortParam<SortOption>(
    SORT_OPTIONS,
    "newest",
  );

  if (adrs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
        No Architecture Decision Records (ADRs) found for this project.
      </div>
    );
  }

  const sortedADRs = [...adrs].sort((a, b) => {
    const direction = currentSort === "newest" ? -1 : 1;
    return a.slug.localeCompare(b.slug) * direction;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <div className="flex-1">{description}</div>
        <Button
          variant="outline"
          size="sm"
          onClick={cycleSortOrder}
          className="gap-2 shrink-0"
        >
          <ArrowUpDown className="w-4 h-4" />
          {currentSort === "newest" ? "Newest First" : "Oldest First"}
        </Button>
      </div>
      {sortedADRs.map((adr) => (
        <Card
          key={adr.slug}
          className="hover:border-primary/50 transition-colors relative group overflow-hidden"
        >
          <Link
            href={`/projects/${projectSlug}/adrs/${adr.slug}`}
            className="absolute inset-0 z-0"
          >
            <span className="sr-only">View {adr.title}</span>
          </Link>
          <CardHeader className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 pointer-events-none z-10 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground shrink-0 w-24">
                {adr.date}
              </span>
              <span className="font-semibold text-lg group-hover:text-primary transition-colors">
                {adr.title}
              </span>

              {adr.technologies &&
                adr.technologies.length > 0 &&
                adr.technologies.map((tech) => {
                  const url = getTechUrl(tech.name);

                  if (url) {
                    return (
                      <a
                        key={tech.name}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Visit ${tech.name} website`}
                      >
                        <Badge
                          variant="secondary"
                          interactive
                          className="flex items-center gap-1.5"
                        >
                          {hasTechIcon(tech.name) && (
                            <TechIcon name={tech.name} className="w-3 h-3" />
                          )}
                          <span>{tech.name}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </Badge>
                      </a>
                    );
                  }

                  return (
                    <Badge
                      key={tech.name}
                      variant="secondary"
                      className="flex items-center gap-1.5"
                    >
                      {hasTechIcon(tech.name) && (
                        <TechIcon name={tech.name} className="w-3 h-3" />
                      )}
                      <span>{tech.name}</span>
                    </Badge>
                  );
                })}

              <ADRBadge status={adr.status} className="shrink-0 w-fit" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
