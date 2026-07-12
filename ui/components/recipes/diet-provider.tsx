"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DietLoadErrorNotice } from "@/components/recipes/diet-notice";
import {
  emptyDietOptions,
  emptyDietProfile,
  getDietOptions,
  getDietProfile,
} from "@/lib/api/diet";
import { authClient } from "@/lib/auth-client";
import {
  buildEffectiveDiet,
  type DietMatch,
  type DietRecipe,
  type EffectiveDiet,
  matchRecipeToDiet,
} from "@/lib/domain/diet";

type DietContextValue = {
  diet: EffectiveDiet;
  error: boolean;
  loading: boolean;
  matchRecipe: (recipe: DietRecipe) => DietMatch;
};

export const DIET_PROFILE_UPDATED_EVENT = "recipe-diet-profile-updated";

const fallbackDiet = buildEffectiveDiet(emptyDietProfile, emptyDietOptions);
const DietContext = createContext<DietContextValue | null>(null);

export function DietProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const [diet, setDiet] = useState(fallbackDiet);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!sessionUserId) {
      setDiet(fallbackDiet);
      setError(false);
      setLoading(false);
      return;
    }

    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setError(false);
      setLoading(true);
      void Promise.all([getDietProfile(signal), getDietOptions(signal)])
        .then(([profile, options]) => {
          setDiet(buildEffectiveDiet(profile, options));
          setError(false);
        })
        .catch((error: unknown) => {
          if (!signal.aborted) {
            setError(true);
            console.error(
              "[DietProvider] Failed to load diet preferences.",
              error,
            );
          }
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    };

    load();
    globalThis.addEventListener(DIET_PROFILE_UPDATED_EVENT, load);
    return () => {
      globalThis.removeEventListener(DIET_PROFILE_UPDATED_EVENT, load);
      controller?.abort();
    };
  }, [isPending, sessionUserId]);

  const matchRecipe = useCallback(
    (recipe: DietRecipe) => matchRecipeToDiet(recipe, diet),
    [diet],
  );

  const value = useMemo<DietContextValue>(
    () => ({
      diet,
      error,
      loading: isPending || loading,
      matchRecipe,
    }),
    [diet, error, isPending, loading, matchRecipe],
  );

  return (
    <DietContext.Provider value={value}>
      {error && !isPending && <DietLoadErrorNotice />}
      {children}
    </DietContext.Provider>
  );
}

export function useDiet() {
  const context = useContext(DietContext);
  if (!context) {
    throw new Error("useDiet must be used within a DietProvider.");
  }
  return context;
}
