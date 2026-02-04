import type { ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export type FilterType = "single" | "multi" | "date-range";

export interface BaseFilterConfig<T> {
  /** URL parameter name (e.g., "tags", "tech", "status") */
  paramName: string;
  label: string;
  type: FilterType;
  getItemValues: (item: T) => string[];
}

export interface SingleFilterConfig<T> extends BaseFilterConfig<T> {
  type: "single";
  options: FilterOption[];
  icon?: ReactNode;
}

export interface MultiFilterConfig<T> extends BaseFilterConfig<T> {
  type: "multi";
  options: FilterOption[];
  icon?: ReactNode;
  maxSelections?: number;
}

export interface DateRangeFilterConfig<T> extends BaseFilterConfig<T> {
  type: "date-range";
  getItemDate: (item: T) => string;
  presets?: DateRangePreset[];
}

export interface DateRangePreset {
  label: string;
  daysAgo: number;
}

export type FilterConfig<T> =
  | SingleFilterConfig<T>
  | MultiFilterConfig<T>
  | DateRangeFilterConfig<T>;

export type FilterValues = Record<string, string | string[] | undefined>;

export interface ParsedFilters {
  values: FilterValues;
  dateFrom?: string;
  dateTo?: string;
}
