"use client";

import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import { ArrowDown, ArrowUp, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import {
  FilterBar,
  type MobileFilterSection,
} from "@/components/ui/filter-bar";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { useDebouncedSearchTracking } from "@/hooks/use-debounced-search-tracking";
import {
  type FilterParamConfig,
  useFilterParams,
} from "@/hooks/use-filter-params";
import { useSortParam } from "@/hooks/use-sort-param";

const SORT_OPTIONS = ["newest", "oldest", "updated"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

interface MultiFilterConfig<T> {
  paramName: string;
  isMulti: boolean;
  label: string;
  getItemValues: (item: T) => string[];
  icon?: ReactNode;
  getValueLabel?: (value: string) => string;
  getOptionIcon?: (value: string) => ReactNode;
}

interface SearchConfig<T> {
  placeholder: string;
  ariaLabel: string;
  keys: IFuseOptions<T>["keys"];
  /** Fuse.js threshold (default: 0.3) */
  threshold?: number;
}

interface SortConfig<T> {
  getDate: (item: T) => string;
  getUpdated?: (item: T) => string | undefined;
}

interface EmptyStateConfig {
  icon: ReactNode;
  message: string;
}

interface DateRangeConfig<T> {
  getDate: (item: T) => string;
}

interface FilterableCardGridProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  getItemKey: (item: T) => string;
  searchConfig: SearchConfig<T>;
  filterConfigs?: MultiFilterConfig<T>[];
  filterBarContent?: ReactNode;
  dateRangeConfig?: DateRangeConfig<T>;
  sortConfig: SortConfig<T>;
  emptyState: EmptyStateConfig;
  itemName: string;
}

export function FilterableCardGrid<T>({
  items,
  renderCard,
  getItemKey,
  searchConfig,
  filterConfigs,
  filterBarContent,
  dateRangeConfig,
  sortConfig,
  emptyState,
  itemName,
}: FilterableCardGridProps<T>) {
  const { currentSort, cycleSortOrder } = useSortParam<SortOption>(
    SORT_OPTIONS,
    "newest",
  );
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filterParamConfigs: FilterParamConfig[] = useMemo(() => {
    if (filterConfigs) {
      return filterConfigs.map((fc) => ({
        paramName: fc.paramName,
        isMulti: fc.isMulti,
      }));
    }
    return [];
  }, [filterConfigs]);

  const {
    getValues,
    setValues,
    toggleValue,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    getDateRange,
    setDateRange,
  } = useFilterParams({ filters: filterParamConfigs });

  const handleDateRangeChange = useCallback(
    (from: string | undefined, to: string | undefined) => {
      posthog.capture("filter_applied", {
        page: pathname,
        filter_type: "date_range",
        filter_value: `${from || "any"} to ${to || "any"}`,
        action: "changed",
      });
      setDateRange(from, to);
    },
    [pathname, setDateRange],
  );

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: searchConfig.keys,
        threshold: searchConfig.threshold ?? 0.3,
        ignoreLocation: true,
      }),
    [items, searchConfig.keys, searchConfig.threshold],
  );

  const filteredItems = useMemo(() => {
    let filtered = searchQuery.trim()
      ? fuse.search(searchQuery).map((result: FuseResult<T>) => result.item)
      : items;

    // Apply multi-filters (AND between different filters, OR within same filter)
    if (filterConfigs) {
      for (const fc of filterConfigs) {
        const selectedValues = getValues(fc.paramName);
        if (selectedValues.length > 0) {
          filtered = filtered.filter((item: T) => {
            const itemValues = fc.getItemValues(item);
            return selectedValues.some((v) => itemValues.includes(v));
          });
        }
      }
    }

    if (dateRangeConfig) {
      const { from, to } = getDateRange();
      if (from) {
        const fromDate = new Date(from);
        filtered = filtered.filter(
          (item: T) => new Date(dateRangeConfig.getDate(item)) >= fromDate,
        );
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // Include the entire "to" day
        filtered = filtered.filter(
          (item: T) => new Date(dateRangeConfig.getDate(item)) <= toDate,
        );
      }
    }

    return filtered;
  }, [
    fuse,
    searchQuery,
    items,
    filterConfigs,
    getValues,
    dateRangeConfig,
    getDateRange,
  ]);

  useDebouncedSearchTracking({
    searchQuery,
    resultCount: filteredItems.length,
    location: itemName,
  });

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

  const activeFilters = useMemo(() => {
    const filters: Array<{
      paramName: string;
      label: string;
      value: string;
      displayValue: string;
      icon?: ReactNode;
    }> = [];

    if (filterConfigs) {
      for (const fc of filterConfigs) {
        const values = getValues(fc.paramName);
        for (const value of values) {
          filters.push({
            paramName: fc.paramName,
            label: fc.label,
            value,
            displayValue: fc.getValueLabel?.(value) ?? value,
            icon: fc.icon,
          });
        }
      }
    }

    return filters;
  }, [filterConfigs, getValues]);

  const mobileFilterSections: MobileFilterSection[] = useMemo(() => {
    if (!filterConfigs) return [];
    return filterConfigs.map((fc) => {
      const uniqueValues = new Map<string, string>();
      for (const item of items) {
        const itemValues = fc.getItemValues(item);
        for (const value of itemValues) {
          if (!uniqueValues.has(value)) {
            uniqueValues.set(value, fc.getValueLabel?.(value) ?? value);
          }
        }
      }
      return {
        paramName: fc.paramName,
        label: fc.label,
        options: Array.from(uniqueValues.entries())
          .map(([value, label]) => ({
            value,
            label,
            icon: fc.getOptionIcon?.(value) ?? fc.icon,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        selectedValues: getValues(fc.paramName),
        onToggle: (value: string) => {
          const isSelected = getValues(fc.paramName).includes(value);
          posthog.capture("filter_applied", {
            page: pathname,
            filter_type: fc.paramName,
            filter_value: value,
            action: isSelected ? "removed" : "added",
          });
          toggleValue(fc.paramName, value);
        },
      };
    });
  }, [filterConfigs, items, getValues, toggleValue, pathname]);

  const handleRemoveFilter = (paramName: string, value: string) => {
    posthog.capture("filter_applied", {
      page: pathname,
      filter_type: paramName,
      filter_value: value,
      action: "removed",
    });
    if (filterConfigs) {
      toggleValue(paramName, value);
    } else {
      clearFilter(paramName);
    }
  };

  const isFiltering = searchQuery || hasActiveFilters;
  const sortButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleSortOrder}
      title={getSortLabel()}
      aria-label={`Sort: ${getSortLabel()}. Click to change sort order.`}
    >
      {getSortIcon()}
    </Button>
  );

  return (
    <div className="space-y-6">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={searchConfig.placeholder}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        sortButton={sortButton}
        mobileFilterSections={mobileFilterSections}
        mobileExtraContent={
          dateRangeConfig ? (
            <DateRangeFilter
              from={getDateRange().from}
              to={getDateRange().to}
              onChange={handleDateRangeChange}
              size="default"
              className="w-full"
            />
          ) : undefined
        }
      >
        {filterBarContent ? (
          filterBarContent
        ) : (
          <>
            {/* Auto-generated desktop filters */}
            {filterConfigs?.map((fc) => {
              // Generate options from unique values in items
              const uniqueValues = new Map<string, string>();
              for (const item of items) {
                const itemValues = fc.getItemValues(item);
                for (const value of itemValues) {
                  if (!uniqueValues.has(value)) {
                    uniqueValues.set(value, fc.getValueLabel?.(value) ?? value);
                  }
                }
              }

              const options: MultiSelectOption[] = Array.from(
                uniqueValues.entries(),
              )
                .map(([value, label]) => ({
                  value,
                  label,
                  icon: fc.getOptionIcon?.(value),
                }))
                .sort((a, b) => a.label.localeCompare(b.label));

              return (
                <MultiSelect
                  key={fc.paramName}
                  options={options}
                  value={getValues(fc.paramName)}
                  onChange={(v) => {
                    const prev = getValues(fc.paramName);
                    const added = v.filter((val) => !prev.includes(val));
                    const removed = prev.filter((val) => !v.includes(val));
                    for (const val of added) {
                      posthog.capture("filter_applied", {
                        page: pathname,
                        filter_type: fc.paramName,
                        filter_value: val,
                        action: "added",
                      });
                    }
                    for (const val of removed) {
                      posthog.capture("filter_applied", {
                        page: pathname,
                        filter_type: fc.paramName,
                        filter_value: val,
                        action: "removed",
                      });
                    }
                    setValues(fc.paramName, v);
                  }}
                  label={fc.label}
                  placeholder={`All ${fc.label.toLowerCase()}`}
                  icon={fc.icon}
                  size="sm"
                  searchable={options.length > 5}
                  searchPlaceholder={`Search ${fc.label.toLowerCase()}...`}
                />
              );
            })}

            {dateRangeConfig && (
              <DateRangeFilter
                from={getDateRange().from}
                to={getDateRange().to}
                onChange={handleDateRangeChange}
                size="sm"
              />
            )}
          </>
        )}
      </FilterBar>

      {isFiltering && sortedItems.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {sortedItems.length} of {items.length} {itemName}
          {searchQuery && ` matching "${searchQuery}"`}
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
