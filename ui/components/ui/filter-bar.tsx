"use client";

import { Check, Filter, Search, X } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/generic/styles";

interface ActiveFilter {
  paramName: string;
  label: string;
  value: string;
  displayValue: string;
  icon?: React.ReactNode;
}

export interface MobileFilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface MobileFilterSection {
  paramName: string;
  label: string;
  options: MobileFilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

interface FilterBarProps {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (paramName: string, value: string) => void;
  onClearAll?: () => void;
  hasActiveFilters?: boolean;
  activeFilterCount?: number;
  className?: string;
  showSearch?: boolean;
  sortButton?: React.ReactNode;
  mobileFilterSections?: MobileFilterSection[];
}

export function FilterBar({
  children,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  activeFilters = [],
  onRemoveFilter,
  onClearAll,
  hasActiveFilters = false,
  activeFilterCount = 0,
  className,
  showSearch = true,
  sortButton,
  mobileFilterSections,
}: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {showSearch && onSearchChange && (
          <div className="relative flex-1 min-w-[120px] md:min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-9"
              aria-label={searchPlaceholder}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          {children}
        </div>

        {/* Mobile filter trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] pb-8">
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center justify-between">
                <span>Filters</span>
                {hasActiveFilters && onClearAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClearAll();
                      setMobileOpen(false);
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </SheetTitle>
            </SheetHeader>

            {/* Mobile filter sections - inline tappable chips */}
            {mobileFilterSections ? (
              <div className="overflow-y-auto max-h-[calc(70vh-100px)] px-1">
                <div className="space-y-4">
                  {mobileFilterSections.map((section) => (
                    <div key={section.paramName}>
                      <h4 className="text-sm font-medium mb-2 px-1">
                        {section.label}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {section.options.map((option) => {
                          const isSelected = section.selectedValues.includes(
                            option.value,
                          );
                          return (
                            <Badge
                              key={option.value}
                              variant={isSelected ? "default" : "outline"}
                              interactive
                              active={isSelected}
                              className="cursor-pointer gap-1.5 py-1.5 px-3"
                              onClick={() => section.onToggle(option.value)}
                            >
                              {option.icon}
                              <span>{option.label}</span>
                              {isSelected && (
                                <Check className="size-3 ml-0.5" />
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Fallback to children if no mobile sections provided */
              <div className="flex flex-col gap-3 py-4">{children}</div>
            )}
          </SheetContent>
        </Sheet>

        {sortButton}

        {hasActiveFilters && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter) => (
            <FilterChip
              key={`${filter.paramName}-${filter.value}`}
              icon={filter.icon}
              onRemove={() => onRemoveFilter?.(filter.paramName, filter.value)}
            >
              {filter.displayValue}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}
