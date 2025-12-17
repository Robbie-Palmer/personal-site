"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useSortParam<T extends string>(
  options: readonly T[],
  defaultOption: T,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const sortParam = searchParams.get("sort") as T | null;
  const currentSort: T =
    sortParam && options.includes(sortParam) ? sortParam : defaultOption;

  const cycleSortOrder = () => {
    const currentIndex = options.indexOf(currentSort);
    const nextSort = options[(currentIndex + 1) % options.length]!;
    const params = new URLSearchParams(searchParams.toString());
    if (nextSort === defaultOption) {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
  };

  return { currentSort, cycleSortOrder };
}
