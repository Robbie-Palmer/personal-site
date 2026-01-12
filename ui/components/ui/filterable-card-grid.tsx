"use client";

import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import { ArrowDown, ArrowUp, Clock, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSortParam } from "@/hooks/use-sort-param";

const SORT_OPTIONS = ["newest", "oldest", "updated"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

interface FilterConfig<T> {
  /** URL param name (e.g., "tag" or "tech") */
  paramName: string;
  /** Function to get filterable values from an item */
  getItemValues: (item: T) => string[];
  /** Icon to show in the filter badge */
  icon: ReactNode;
  /** URL to navigate to when clearing the filter */
  clearUrl: string;
  /** Text prefix for results count (e.g., "with tag" or "using") */
  labelPrefix: string;
}

interface SearchConfig<T> {
  /** Placeholder text for search input */
  placeholder: string;
  /** Aria label for search input */
  ariaLabel: string;
  /** Fuse.js search keys */
  keys: IFuseOptions<T>["keys"];
  /** Fuse.js threshold (default: 0.3) */
  threshold?: number;
}

interface SortConfig<T> {
  /** Function to get the date string from an item */
  getDate: (item: T) => string;
  /** Function to get the updated date string from an item (optional) */
  getUpdated?: (item: T) => string | undefined;
}

interface EmptyStateConfig {
  /** Icon to show when no results */
  icon: ReactNode;
  /** Message to show when no results */
  message: string;
}

interface FilterableCardGridProps<T> {
  /** Items to display */
  items: T[];
  /** Function to render each card */
  renderCard: (item: T, index: number) => ReactNode;
  /** Function to get a unique key for each item */
  getItemKey: (item: T) => string;
  /** Search configuration */
  searchConfig: SearchConfig<T>;
  /** Filter configuration (optional) */
  filterConfig?: FilterConfig<T>;
  /** Sort configuration */
  sortConfig: SortConfig<T>;
  /** Empty state configuration */
  emptyState: EmptyStateConfig;
  /** Name of items for results count (e.g., "posts" or "projects") */
  itemName: string;
}

export function FilterableCardGrid<T>({
  items,
  renderCard,
  getItemKey,
  searchConfig,
  filterConfig,
  sortConfig,
  emptyState,
  itemName,
}: FilterableCardGridProps<T>) {
  const searchParams = useSearchParams();
  const currentFilter = filterConfig
    ? searchParams.get(filterConfig.paramName)
    : null;
  const { currentSort, cycleSortOrder } = useSortParam<SortOption>(
    SORT_OPTIONS,
    "newest",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: searchConfig.keys,
        threshold: searchConfig.threshold ?? 0.3,
        ignoreLocation: true,
      }),
    [items, searchConfig.keys, searchConfig.threshold],
  );

  // Filter items
  const filteredItems = useMemo(() => {
    let filtered = searchQuery.trim()
      ? fuse.search(searchQuery).map((result: FuseResult<T>) => result.item)
      : items;

    if (currentFilter && filterConfig) {
      filtered = filtered.filter((item: T) =>
        filterConfig.getItemValues(item).includes(currentFilter),
      );
    }
    return filtered;
  }, [fuse, searchQuery, items, currentFilter, filterConfig]);

  // Sort items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a: T, b: T) => {
      if (currentSort === "oldest") {
        return (
          new Date(sortConfig.getDate(a)).getTime() -
          new Date(sortConfig.getDate(b)).getTime()
        );
      }
      if (currentSort === "updated") {
        const aDate = new Date(
          sortConfig.getUpdated?.(a) ?? sortConfig.getDate(a),
        ).getTime();
        const bDate = new Date(
          sortConfig.getUpdated?.(b) ?? sortConfig.getDate(b),
        ).getTime();
        return bDate - aDate;
      }
      return (
        new Date(sortConfig.getDate(b)).getTime() -
        new Date(sortConfig.getDate(a)).getTime()
      );
    });
  }, [filteredItems, currentSort, sortConfig]);

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

  const isFiltering = searchQuery || currentFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchConfig.placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label={searchConfig.ariaLabel}
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

        {currentFilter && filterConfig && (
          <Badge
            variant="secondary"
            interactive
            className="flex items-center gap-2 px-3 py-1.5"
          >
            {filterConfig.icon}
            <span>{currentFilter}</span>
            <Link
              href={filterConfig.clearUrl}
              className="rounded-full hover:bg-background/50 p-0.5 ml-1 transition-colors"
              aria-label={`Remove ${currentFilter} filter`}
            >
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        )}
      </div>

      {isFiltering && sortedItems.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {sortedItems.length} of {items.length} {itemName}
          {searchQuery && ` matching "${searchQuery}"`}
          {currentFilter &&
            filterConfig &&
            ` ${filterConfig.labelPrefix} "${currentFilter}"`}
        </p>
      )}

      {sortedItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            {emptyState.icon}
            <p>{emptyState.message}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((item, index) => (
            <div key={getItemKey(item)}>{renderCard(item, index)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
