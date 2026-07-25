"use client";

import { useEffect, useState } from "react";
import { loadTypoDictionary } from "@/lib/domain/recipe/typoDictionary";

interface TypoDictionaryState {
  dictionary: Map<string, string[]> | null;
  ready: boolean;
}

/**
 * Lazily loads the recipe spell-check dictionary once and shares the memoised
 * result. `ready` flips true whether the load succeeds or fails, so the editor
 * can stop showing a "checking…" hint even if the asset is unavailable.
 */
export function useTypoDictionary(): TypoDictionaryState {
  const [dictionary, setDictionary] = useState<Map<string, string[]> | null>(
    null,
  );
  const [ready, setReady] = useState(false);

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
  }, []);

  return { dictionary, ready };
}
