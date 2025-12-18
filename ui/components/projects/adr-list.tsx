"use client";

import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ADR } from "@/lib/projects";
import { cn } from "@/lib/styles";
import { useSortParam } from "@/lib/use-sort-param";

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
        <Link
          key={adr.slug}
          href={`/projects/${projectSlug}/adrs/${adr.slug}`}
          className="block group"
        >
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
                <span className="font-mono text-sm text-muted-foreground shrink-0 w-24">
                  {adr.date}
                </span>
                <span className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {adr.title}
                </span>
                <Badge
                  variant={
                    adr.status === "Rejected" ? "destructive" : "default"
                  }
                  aria-label={`Status: ${adr.status}`}
                  className={cn(
                    "shrink-0",
                    adr.status === "Accepted" &&
                      "bg-green-600 hover:bg-green-700",
                    adr.status === "Proposed" &&
                      "bg-blue-600 hover:bg-blue-700",
                    adr.status === "Deprecated" &&
                      "bg-amber-600 hover:bg-amber-700",
                  )}
                >
                  {adr.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
