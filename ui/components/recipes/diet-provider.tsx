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

type DietState = {
  userId: string | null;
  diet: EffectiveDiet;
  status: "idle" | "loading" | "ready" | "error";
};

export function DietProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const [state, setState] = useState<DietState>({
    userId: null,
    diet: fallbackDiet,
    status: "idle",
  });

  useEffect(() => {
    if (isPending) return;
    if (!sessionUserId) {
      setState({ userId: null, diet: fallbackDiet, status: "idle" });
      return;
    }

    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState((current) => ({
        userId: sessionUserId,
        diet: current.userId === sessionUserId ? current.diet : fallbackDiet,
        status: "loading",
      }));
      void Promise.all([getDietProfile(signal), getDietOptions(signal)])
        .then(([profile, options]) => {
          setState({
            userId: sessionUserId,
            diet: buildEffectiveDiet(profile, options),
            status: "ready",
          });
        })
        .catch((error: unknown) => {
          if (!signal.aborted) {
            setState((current) => ({
              userId: sessionUserId,
              diet:
                current.userId === sessionUserId ? current.diet : fallbackDiet,
              status: "error",
            }));
            console.error(
              "[DietProvider] Failed to load diet preferences.",
              error,
            );
          }
        });
    };

    load();
    globalThis.addEventListener(DIET_PROFILE_UPDATED_EVENT, load);
    return () => {
      globalThis.removeEventListener(DIET_PROFILE_UPDATED_EVENT, load);
      controller?.abort();
    };
  }, [isPending, sessionUserId]);

  const diet =
    sessionUserId && state.userId === sessionUserId ? state.diet : fallbackDiet;
  const loading =
    isPending ||
    Boolean(
      sessionUserId &&
        (state.userId !== sessionUserId || state.status === "loading"),
    );
  const error = Boolean(
    sessionUserId && state.userId === sessionUserId && state.status === "error",
  );

  const matchRecipe = useCallback(
    (recipe: DietRecipe) => matchRecipeToDiet(recipe, diet),
    [diet],
  );

  const value = useMemo<DietContextValue>(
    () => ({
      diet,
      error,
      loading,
      matchRecipe,
    }),
    [diet, error, loading, matchRecipe],
  );

  return (
    <DietContext.Provider value={value}>
      {error && <DietLoadErrorNotice />}
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
