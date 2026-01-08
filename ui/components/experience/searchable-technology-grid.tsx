"use client";

import Fuse, { type FuseResult } from "fuse.js";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TechnologyCard } from "@/components/technology/technology-card";
import { Input } from "@/components/ui/input";
import type { TechnologyBadgeView } from "@/lib/domain/technology/technologyViews";

interface RankedTechnology {
  badge: TechnologyBadgeView;
  description?: string;
}

interface SearchableTechnologyGridProps {
  technologies: RankedTechnology[];
}

export function SearchableTechnologyGrid({
  technologies,
}: SearchableTechnologyGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(technologies, {
        keys: [{ name: "badge.name", weight: 1 }],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [technologies],
  );

  const filteredTechnologies = useMemo(() => {
    if (!searchQuery.trim()) {
      return technologies;
    }
    return fuse
      .search(searchQuery)
      .map((result: FuseResult<RankedTechnology>) => result.item);
  }, [fuse, searchQuery, technologies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search technologies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search technologies"
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
      </div>

      {searchQuery && filteredTechnologies.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredTechnologies.length} of {technologies.length}{" "}
          technologies matching &quot;{searchQuery}&quot;
        </p>
      )}

      {filteredTechnologies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <Search className="w-10 h-10 text-muted-foreground/50" />
            <p>No technologies found matching &quot;{searchQuery}&quot;</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredTechnologies.map(({ badge, description }) => (
            <TechnologyCard
              key={badge.slug}
              technology={badge}
              description={description}
            />
          ))}
        </div>
      )}
    </div>
  );
}
