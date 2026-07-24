"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { DietLoadErrorNotice } from "@/components/recipes/diet-notice";
import { emptyDietOptions, emptyDietProfile } from "@/lib/api/diet";
import { authClient } from "@/lib/auth-client";
import {
  buildEffectiveDiet,
  type DietMatch,
  type DietRecipe,
  type EffectiveDiet,
  matchRecipeToDiet,
} from "@/lib/domain/diet";
import { dietOptionsQuery, dietProfileQuery } from "@/lib/query/recipe-queries";

type DietContextValue = {
  diet: EffectiveDiet;
  error: boolean;
  loading: boolean;
  matchRecipe: (recipe: DietRecipe) => DietMatch;
};

const fallbackDiet = buildEffectiveDiet(emptyDietProfile, emptyDietOptions);
const DietContext = createContext<DietContextValue | null>(null);

export function DietProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const profile = useQuery({
    ...dietProfileQuery(sessionUserId ?? "pending"),
    enabled: !isPending && Boolean(sessionUserId),
  });
  const options = useQuery({
    ...dietOptionsQuery(sessionUserId ?? "pending"),
    enabled: !isPending && Boolean(sessionUserId),
  });
  const diet = useMemo(
    () =>
      sessionUserId && profile.data && options.data
        ? buildEffectiveDiet(profile.data, options.data)
        : fallbackDiet,
    [options.data, profile.data, sessionUserId],
  );
  const loading =
    isPending ||
    Boolean(sessionUserId && (profile.isPending || options.isPending));
  const error = Boolean(sessionUserId && (profile.isError || options.isError));

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
