"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  loading: boolean;
  matchRecipe: (recipe: DietRecipe) => DietMatch;
};

export const DIET_PROFILE_UPDATED_EVENT = "recipe-diet-profile-updated";

const fallbackDiet = buildEffectiveDiet(emptyDietProfile, emptyDietOptions);
const DietContext = createContext<DietContextValue>({
  diet: fallbackDiet,
  loading: false,
  matchRecipe: (recipe) => matchRecipeToDiet(recipe, fallbackDiet),
});

export function DietProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const [diet, setDiet] = useState(fallbackDiet);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!sessionUserId) {
      setDiet(fallbackDiet);
      setLoading(false);
      return;
    }

    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true);
      void Promise.all([getDietProfile(signal), getDietOptions(signal)])
        .then(([profile, options]) =>
          setDiet(buildEffectiveDiet(profile, options)),
        )
        .catch((error: unknown) => {
          if (!signal.aborted) {
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

  const value = useMemo<DietContextValue>(
    () => ({
      diet,
      loading: isPending || loading,
      matchRecipe: (recipe) => matchRecipeToDiet(recipe, diet),
    }),
    [diet, isPending, loading],
  );

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>;
}

export function useDiet() {
  return useContext(DietContext);
}
