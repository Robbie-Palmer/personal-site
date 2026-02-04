"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface FilterParamConfig {
  paramName: string;
  isMulti?: boolean;
}

export interface UseFilterParamsOptions {
  filters: FilterParamConfig[];
  delimiter?: string;
  /** Whether to use shallow routing (default: true) */
  shallow?: boolean;
}

export interface UseFilterParamsReturn {
  getValue: (paramName: string) => string | undefined;
  getValues: (paramName: string) => string[];
  setValue: (paramName: string, value: string | undefined) => void;
  setValues: (paramName: string, values: string[]) => void;
  toggleValue: (paramName: string, value: string) => void;
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

  const { filters, delimiter = ",", shallow = true } = options;
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
      const newUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
      router.replace(newUrl, { scroll: !shallow });
    },
    [pathname, router, shallow],
  );

  const getValue = useCallback(
    (paramName: string): string | undefined => {
      return searchParams.get(paramName) ?? undefined;
    },
    [searchParams],
  );

  const getValues = useCallback(
    (paramName: string): string[] => {
      const value = searchParams.get(paramName);
      if (!value) return [];
      return value.split(delimiter).filter(Boolean);
    },
    [searchParams, delimiter],
  );

  const setValue = useCallback(
    (paramName: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      updateUrl(params);
    },
    [searchParams, updateUrl],
  );

  const setValues = useCallback(
    (paramName: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length > 0) {
        params.set(paramName, values.join(delimiter));
      } else {
        params.delete(paramName);
      }
      updateUrl(params);
    },
    [searchParams, delimiter, updateUrl],
  );

  const toggleValue = useCallback(
    (paramName: string, value: string) => {
      const currentValues = getValues(paramName);
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      setValues(paramName, newValues);
    },
    [getValues, setValues],
  );

  const clearFilter = useCallback(
    (paramName: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(paramName);
      updateUrl(params);
    },
    [searchParams, updateUrl],
  );

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    // Clear all filter params but preserve others (like sort, tab)
    for (const paramName of filterParamNames) {
      params.delete(paramName);
    }
    params.delete("dateFrom");
    params.delete("dateTo");
    updateUrl(params);
  }, [searchParams, filterParamNames, updateUrl]);

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
      const params = new URLSearchParams(searchParams.toString());
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
    [searchParams, updateUrl],
  );

  return {
    getValue,
    getValues,
    setValue,
    setValues,
    toggleValue,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    getDateRange,
    setDateRange,
  };
}
