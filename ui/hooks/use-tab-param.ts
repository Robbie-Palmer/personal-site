"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useTabParam(defaultTab: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentTab = searchParams.get("tab") || defaultTab;

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return { currentTab, onTabChange };
}
