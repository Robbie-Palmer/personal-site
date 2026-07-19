"use client";

import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useMemo, useRef } from "react";

export interface FilterParamConfig {
  paramName: string;
  isMulti?: boolean;
}

/** Tri-state a value can hold within a filter: neutral, included, or excluded. */
export type FilterState = "off" | "include" | "exclude";

/** The include/exclude split of a single filter's selected values. */
export interface FilterSelection {
  include: string[];
  exclude: string[];
}

/**
 * Excluded values live in the same comma-delimited param as includes, marked
 * with a leading "!" (e.g. `ingredient=chicken,!mushroom`). This keeps one
 * param per category and stays human-readable/shareable in the URL.
 *
 * Invariant: filter values themselves must not begin with "!" — such a value
 * would round-trip as an exclude. This holds for every current source (recipe
 * ingredient names, tech/role slugs, tags, kebab-case labels); introducing a
 * value that can start with "!" would need a different sentinel/encoding.
 */
const EXCLUDE_PREFIX = "!";

function parseToken(token: string): { value: string; excluded: boolean } {
  return token.startsWith(EXCLUDE_PREFIX)
    ? { value: token.slice(EXCLUDE_PREFIX.length), excluded: true }
    : { value: token, excluded: false };
}

function toToken(value: string, state: Exclude<FilterState, "off">): string {
  return state === "exclude" ? `${EXCLUDE_PREFIX}${value}` : value;
}

/** Advances a tri-state: off → include → exclude → off. */
export function nextFilterState(current: FilterState): FilterState {
  if (current === "off") return "include";
  if (current === "include") return "exclude";
  return "off";
}

/** Maps a tri-state to the analytics action recorded for it. */
export function filterAppliedAction(
  state: FilterState,
): "added" | "removed" | "excluded" {
  if (state === "off") return "removed";
  if (state === "exclude") return "excluded";
  return "added";
}

/** Screen-reader label describing a value's tri-state. */
export function filterStateAriaLabel(
  label: string,
  state: FilterState,
): string {
  if (state === "exclude") return `${label} (excluded)`;
  if (state === "include") return `${label} (included)`;
  return label;
}

function parseSelection(
  searchParams: ReadonlyURLSearchParams,
  paramName: string,
  delimiter: string,
): FilterSelection {
  const value = searchParams.get(paramName);
  const include: string[] = [];
  const exclude: string[] = [];
  if (!value) return { include, exclude };
  for (const token of value.split(delimiter).filter(Boolean)) {
    const { value: v, excluded } = parseToken(token);
    (excluded ? exclude : include).push(v);
  }
  return { include, exclude };
}

export interface UseFilterParamsOptions {
  filters: FilterParamConfig[];
  delimiter?: string;
  /** Whether to preserve scroll position on URL updates (default: true) */
  preserveScroll?: boolean;
}

export interface UseFilterParamsReturn {
  getValue: (paramName: string) => string | undefined;
  /** Included values only (excludes are stripped). */
  getValues: (paramName: string) => string[];
  /** Excluded values only. */
  getExcludedValues: (paramName: string) => string[];
  /** Full include/exclude split for a filter. */
  getSelection: (paramName: string) => FilterSelection;
  /** Tri-state of a single value within a filter (reactive). */
  getState: (paramName: string, value: string) => FilterState;
  /**
   * Latest tri-state read straight from the current URL, not tied to a render.
   * Safe inside async handlers (e.g. a toast Undo) where the reactive
   * `getState` closure may be stale.
   */
  peekState: (paramName: string, value: string) => FilterState;
  setValue: (paramName: string, value: string | undefined) => void;
  setValues: (paramName: string, values: string[]) => void;
  toggleValue: (paramName: string, value: string) => void;
  /** Force a value into a specific tri-state. */
  setState: (paramName: string, value: string, state: FilterState) => void;
  /** Advance a value: off → include → exclude → off. */
  cycleValue: (paramName: string, value: string) => void;
  clearFilter: (paramName: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  getDateRange: () => { from: string | undefined; to: string | undefined };
  setDateRange: (from: string | undefined, to: string | undefined) => void;
}

export function useFilterParams(
  options: UseFilterParamsOptions,
): UseFilterParamsReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Write handlers may run in async contexts (e.g. the "Undo" action on the
  // sonner toast fired when excluding from a card). A ref pinned to the latest
  // searchParams lets those writes merge onto the current URL rather than a
  // stale snapshot captured when the handler was created.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const { filters, delimiter = ",", preserveScroll = true } = options;
  const filterParamNames = useMemo(
    () => new Set(filters.map((f) => f.paramName)),
    [filters],
  );
  const multiFilters = useMemo(
    () => new Set(filters.filter((f) => f.isMulti).map((f) => f.paramName)),
    [filters],
  );

  const updateUrl = useCallback(
    (newParams: URLSearchParams) => {
      const queryString = newParams.toString();
      const querySuffix = queryString ? `?${queryString}` : "";
      const newUrl = pathname + querySuffix;
      router.replace(newUrl, { scroll: !preserveScroll });
    },
    [pathname, router, preserveScroll],
  );

  const getValue = useCallback(
    (paramName: string): string | undefined => {
      return searchParams.get(paramName) ?? undefined;
    },
    [searchParams],
  );

  // Reactive reads — their identity changes with searchParams so render-time
  // consumers (filtering/active-chip memos) recompute when the URL changes.
  const getSelection = useCallback(
    (paramName: string): FilterSelection =>
      parseSelection(searchParams, paramName, delimiter),
    [searchParams, delimiter],
  );

  const getValues = useCallback(
    (paramName: string): string[] => getSelection(paramName).include,
    [getSelection],
  );

  const getExcludedValues = useCallback(
    (paramName: string): string[] => getSelection(paramName).exclude,
    [getSelection],
  );

  const getState = useCallback(
    (paramName: string, value: string): FilterState => {
      const { include, exclude } = getSelection(paramName);
      if (exclude.includes(value)) return "exclude";
      if (include.includes(value)) return "include";
      return "off";
    },
    [getSelection],
  );

  // Latest-value reads for use inside write handlers (see searchParamsRef).
  const readSelection = useCallback(
    (paramName: string): FilterSelection =>
      parseSelection(searchParamsRef.current, paramName, delimiter),
    [delimiter],
  );

  const peekState = useCallback(
    (paramName: string, value: string): FilterState => {
      const { include, exclude } = readSelection(paramName);
      if (exclude.includes(value)) return "exclude";
      if (include.includes(value)) return "include";
      return "off";
    },
    [readSelection],
  );

  const setValue = useCallback(
    (paramName: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      updateUrl(params);
    },
    [updateUrl],
  );

  const writeSelection = useCallback(
    (paramName: string, selection: FilterSelection) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      const tokens = [
        ...selection.include,
        ...selection.exclude.map((v) => toToken(v, "exclude")),
      ];
      if (tokens.length > 0) {
        params.set(paramName, tokens.join(delimiter));
      } else {
        params.delete(paramName);
      }
      updateUrl(params);
    },
    [delimiter, updateUrl],
  );

  const setValues = useCallback(
    (paramName: string, values: string[]) => {
      // Replaces the included set while preserving excludes — minus any value
      // that is now included, so a value can't be both included and excluded.
      const { exclude } = readSelection(paramName);
      const nextExclude = exclude.filter((v) => !values.includes(v));
      writeSelection(paramName, { include: values, exclude: nextExclude });
    },
    [readSelection, writeSelection],
  );

  const setState = useCallback(
    (paramName: string, value: string, state: FilterState) => {
      const { include, exclude } = readSelection(paramName);
      const nextInclude = include.filter((v) => v !== value);
      const nextExclude = exclude.filter((v) => v !== value);
      if (state === "include") nextInclude.push(value);
      if (state === "exclude") nextExclude.push(value);
      writeSelection(paramName, { include: nextInclude, exclude: nextExclude });
    },
    [readSelection, writeSelection],
  );

  const cycleValue = useCallback(
    (paramName: string, value: string) => {
      setState(paramName, value, nextFilterState(peekState(paramName, value)));
    },
    [peekState, setState],
  );

  const toggleValue = useCallback(
    (paramName: string, value: string) => {
      // Two-state toggle between off and include (clears any exclude).
      setState(
        paramName,
        value,
        peekState(paramName, value) === "include" ? "off" : "include",
      );
    },
    [peekState, setState],
  );

  const clearFilter = useCallback(
    (paramName: string) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      params.delete(paramName);
      updateUrl(params);
    },
    [updateUrl],
  );

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    // Clear all filter params but preserve others (like sort, tab)
    for (const paramName of filterParamNames) {
      params.delete(paramName);
    }
    params.delete("dateFrom");
    params.delete("dateTo");
    updateUrl(params);
  }, [filterParamNames, updateUrl]);

  const hasActiveFilters = useMemo(() => {
    for (const paramName of filterParamNames) {
      if (searchParams.has(paramName)) return true;
    }
    return searchParams.has("dateFrom") || searchParams.has("dateTo");
  }, [searchParams, filterParamNames]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const paramName of filterParamNames) {
      const value = searchParams.get(paramName);
      if (value) {
        // For multi filters, count individual values
        if (multiFilters.has(paramName)) {
          count += value.split(delimiter).filter(Boolean).length;
        } else {
          count += 1;
        }
      }
    }
    if (searchParams.has("dateFrom") || searchParams.has("dateTo")) {
      count += 1;
    }
    return count;
  }, [searchParams, filterParamNames, multiFilters, delimiter]);

  const getDateRange = useCallback(() => {
    return {
      from: searchParams.get("dateFrom") ?? undefined,
      to: searchParams.get("dateTo") ?? undefined,
    };
  }, [searchParams]);

  const setDateRange = useCallback(
    (from: string | undefined, to: string | undefined) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (from) {
        params.set("dateFrom", from);
      } else {
        params.delete("dateFrom");
      }
      if (to) {
        params.set("dateTo", to);
      } else {
        params.delete("dateTo");
      }
      updateUrl(params);
    },
    [updateUrl],
  );

  return {
    getValue,
    getValues,
    getExcludedValues,
    getSelection,
    getState,
    peekState,
    setValue,
    setValues,
    toggleValue,
    setState,
    cycleValue,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    getDateRange,
    setDateRange,
  };
}
