"use client";

import Fuse, { type FuseOptionKey } from "fuse.js";
import { ArrowDown, ArrowUp, Clock, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BaseContent } from "@/lib/content";

export type SortOption = "newest" | "oldest" | "updated";

export interface ContentListProps<T extends BaseContent> {
  /** Content items to display */
  items: T[];
  /** Content type name (e.g., "blog", "projects") - used in URLs and labels */
  contentType: string;
  /** Display name for the content type (e.g., "Blog", "Projects") */
  displayName: string;
  /** Keys to search across with Fuse.js */
  searchKeys: FuseOptionKey<T>[];
  /** Render function for card content - receives the item and returns JSX */
  renderCardContent: (item: T) => ReactNode;
  /** Optional: render function for card footer - receives the item and returns JSX */
  renderCardFooter?: (item: T) => ReactNode;
}

export function ContentList<T extends BaseContent>({
  items,
  contentType,
  displayName,
  searchKeys,
  renderCardContent,
  renderCardFooter,
}: ContentListProps<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");
  const sortParam = searchParams.get("sort") as SortOption | null;
  const currentSort: SortOption = sortParam || "newest";
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: searchKeys,
        threshold: 0.1,
        ignoreLocation: true,
      }),
    [items, searchKeys],
  );

  let filteredItems = searchQuery.trim()
    ? fuse.search(searchQuery).map((result) => result.item)
    : items;

  if (currentTag) {
    filteredItems = filteredItems.filter((item) =>
      item.tags.includes(currentTag),
    );
  }

  // Apply sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (currentSort === "oldest") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (currentSort === "updated") {
      // Use updated date if available, otherwise fall back to date
      const aDate = new Date(a.updated || a.date).getTime();
      const bDate = new Date(b.updated || b.date).getTime();
      return bDate - aDate; // Most recent first
    }
    // Default: newest
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const cycleSortOrder = () => {
    const sortCycle: SortOption[] = ["newest", "oldest", "updated"];
    const currentIndex = sortCycle.indexOf(currentSort);
    const nextSort = sortCycle[
      (currentIndex + 1) % sortCycle.length
    ] as SortOption;

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextSort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }
    const queryString = params.toString();
    router.push(`/${contentType}${queryString ? `?${queryString}` : ""}`);
  };

  const getSortIcon = () => {
    switch (currentSort) {
      case "oldest":
        return <ArrowUp className="h-4 w-4" />;
      case "updated":
        return <Clock className="h-4 w-4" />;
      default:
        return <ArrowDown className="h-4 w-4" />;
    }
  };

  const getSortLabel = () => {
    switch (currentSort) {
      case "oldest":
        return "Oldest first";
      case "updated":
        return "Recently updated";
      default:
        return "Newest first";
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-wrap items-baseline gap-4 mb-6">
        <h1 className="text-4xl font-bold">{displayName}</h1>
        {currentTag && (
          <Badge
            variant="outline"
            className="flex items-center gap-2 text-base"
          >
            <span>{currentTag}</span>
            <Link
              href={`/${contentType}`}
              className="rounded-full hover:bg-muted/50 p-0.5"
              aria-label={`Remove ${currentTag} filter`}
            >
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={`Search ${contentType}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label={`Search ${contentType}`}
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
          size="icon"
          onClick={cycleSortOrder}
          title={getSortLabel()}
          aria-label={`Sort: ${getSortLabel()}. Click to change sort order.`}
        >
          {getSortIcon()}
        </Button>
      </div>

      {(searchQuery || currentTag) && sortedItems.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Showing {sortedItems.length} of {items.length} {contentType}
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}
        </p>
      )}

      {sortedItems.length === 0 ? (
        <p className="text-muted-foreground">
          No {contentType} found
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((item) => (
            <Card key={item.slug} className="h-full flex flex-col">
              <CardHeader>
                <Link href={`/${contentType}/${item.slug}`}>
                  <CardTitle className="hover:text-primary transition-colors">
                    {item.title}
                  </CardTitle>
                </Link>
                {renderCardContent(item)}
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              {renderCardFooter && (
                <CardContent className="flex-1 flex flex-col justify-end">
                  {renderCardFooter(item)}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
