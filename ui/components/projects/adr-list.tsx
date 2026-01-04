"use client";

import Fuse, { type FuseResult } from "fuse.js";
import { ArrowUpDown, ExternalLink, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ADR } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";
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
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(adrs, {
        keys: ["title", "slug"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [adrs],
  );

  const filteredADRs = useMemo(() => {
    if (!searchQuery.trim()) {
      return adrs;
    }
    return fuse
      .search(searchQuery)
      .map((result: FuseResult<ADR>) => result.item);
  }, [fuse, searchQuery, adrs]);

  if (adrs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
        No Architecture Decision Records (ADRs) found for this project.
      </div>
    );
  }

  const sortedADRs = [...filteredADRs].sort((a, b) => {
    const direction = currentSort === "newest" ? -1 : 1;
    return a.slug.localeCompare(b.slug) * direction;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex-1">{description}</div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search decisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Search architecture decisions"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={cycleSortOrder}
            className="gap-2 shrink-0"
          >
            <ArrowUpDown className="w-4 h-4" />
            {currentSort === "newest" ? "Newest First" : "Oldest First"}
          </Button>
        </div>

        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            Showing {sortedADRs.length} of {adrs.length} records matching "
            {searchQuery}"
          </p>
        )}
      </div>

      {sortedADRs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <p>No decisions match &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        sortedADRs.map((adr) => (
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
                    const url = tech.website;

                    if (url) {
                      return (
                        <a
                          key={tech.name}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer pointer-events-auto w-fit shrink-0"
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
        ))
      )}
    </div>
  );
}
