import posthog from "posthog-js";
import { useEffect, useRef } from "react";

export function useDebouncedSearchTracking({
    searchQuery,
    resultCount,
    location,
    delay = 1000,
}: {
    searchQuery: string;
    resultCount: number;
    location: string;
    delay?: number;
}) {
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resultCountRef = useRef(resultCount);

    // Sync ref with latest resultCount without triggering effects
    useEffect(() => {
        resultCountRef.current = resultCount;
    }, [resultCount]);

    useEffect(() => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (!searchQuery.trim()) {
            return;
        }

        searchTimerRef.current = setTimeout(() => {
            posthog.capture("search_used", {
                query: searchQuery,
                result_count: resultCountRef.current,
                location,
            });
        }, delay);

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, [searchQuery, location, delay]);
}
