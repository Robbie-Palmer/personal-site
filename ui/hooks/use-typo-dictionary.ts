"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadTypoDictionary,
  resetTypoDictionaryCache,
} from "@/lib/domain/recipe/typoDictionary";

interface TypoDictionaryState {
  dictionary: Map<string, string[]> | null;
  ready: boolean;
  /** Re-attempts a failed load; safe to call while spell-check is unavailable. */
  retry: () => void;
}

/**
 * Lazily loads the recipe spell-check dictionary once and shares the memoised
 * result. `ready` flips true whether the load succeeds or fails, so the editor
 * can stop showing a "checking…" hint even if the asset is unavailable, and
 * `retry` lets the user re-attempt after a transient network error.
 */
export function useTypoDictionary(): TypoDictionaryState {
  const [dictionary, setDictionary] = useState<Map<string, string[]> | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is a manual retry trigger, deliberately not read inside the effect
  useEffect(() => {
    let active = true;
    loadTypoDictionary()
      .then((loaded) => {
        if (active) setDictionary(loaded);
      })
      .catch((error: unknown) => {
        // A missing dictionary must never break editing; spell-check is additive.
        console.error("[spellcheck] dictionary load failed", error);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    resetTypoDictionaryCache();
    setDictionary(null);
    setReady(false);
    setAttempt((previous) => previous + 1);
  }, []);

  return { dictionary, ready, retry };
}
