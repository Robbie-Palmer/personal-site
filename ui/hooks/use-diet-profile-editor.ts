"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { useEffect, useState } from "react";
import {
  type DietOptions,
  type DietProfile,
  emptyDietOptions,
  emptyDietProfile,
} from "@/lib/api/diet";
import { authClient } from "@/lib/auth-client";
import { saveDietProfileMutation } from "@/lib/query/recipe-mutations";
import { dietOptionsQuery, dietProfileQuery } from "@/lib/query/recipe-queries";

export type DietEditorSaveState = "idle" | "saving" | "saved" | "error";

type DietProfileEditorState = {
  dirty: boolean;
  error: string | null;
  loading: boolean;
  options: DietOptions;
  profile: DietProfile;
  saveState: DietEditorSaveState;
};

type DietProfileEditorActions = {
  save: () => Promise<void>;
  updateProfile: (next: SetStateAction<DietProfile>) => void;
};

function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((first, second) => first.localeCompare(second));
}

function serializeProfile(profile: DietProfile): string {
  return JSON.stringify({
    ...profile,
    presetDietKeys: sortAlphabetically(profile.presetDietKeys),
    excludedIngredientSlugs: sortAlphabetically(
      profile.excludedIngredientSlugs,
    ),
    excludedGroupKeys: sortAlphabetically(profile.excludedGroupKeys),
  });
}

function editorError(
  saveError: string | null,
  loadError: unknown,
): string | null {
  if (saveError) return saveError;
  if (loadError instanceof Error) return loadError.message;
  if (loadError) return "Couldn't load your diet profile.";
  return null;
}

function editorSaveState(
  mutation: {
    isError: boolean;
    isPending: boolean;
    isSuccess: boolean;
  },
  loadError: unknown,
): DietEditorSaveState {
  if (mutation.isPending) return "saving";
  if (mutation.isError || loadError) return "error";
  if (mutation.isSuccess) return "saved";
  return "idle";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useDietProfileEditor(): {
  actions: DietProfileEditorActions;
  state: DietProfileEditorState;
} {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<DietProfile>(emptyDietProfile);
  const [savedProfile, setSavedProfile] =
    useState<DietProfile>(emptyDietProfile);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const profileResult = useQuery({
    ...dietProfileQuery(userId ?? "pending"),
    enabled: !sessionPending && Boolean(userId),
  });
  const optionsResult = useQuery({
    ...dietOptionsQuery(userId ?? "pending"),
    enabled: !sessionPending && Boolean(userId),
  });
  const saveMutation = useMutation(
    saveDietProfileMutation(queryClient, userId ?? "pending"),
  );
  const resetSaveMutation = saveMutation.reset;

  useEffect(() => {
    if (!userId) {
      if (loadedUserId !== null) {
        setProfile(emptyDietProfile);
        setSavedProfile(emptyDietProfile);
        setLoadedUserId(null);
        setSaveError(null);
        resetSaveMutation();
      }
      return;
    }
    if (!profileResult.data || loadedUserId === userId) return;
    setProfile(profileResult.data);
    setSavedProfile(profileResult.data);
    setLoadedUserId(userId);
    setSaveError(null);
    resetSaveMutation();
  }, [loadedUserId, profileResult.data, resetSaveMutation, userId]);

  const options = optionsResult.data ?? emptyDietOptions;
  const loadError = profileResult.error ?? optionsResult.error;
  const state: DietProfileEditorState = {
    dirty: serializeProfile(profile) !== serializeProfile(savedProfile),
    error: editorError(saveError, loadError),
    loading:
      sessionPending ||
      Boolean(userId && (profileResult.isPending || optionsResult.isPending)),
    options,
    profile,
    saveState: editorSaveState(saveMutation, loadError),
  };

  function updateProfile(next: SetStateAction<DietProfile>) {
    setProfile(next);
    setSaveError(null);
    resetSaveMutation();
  }

  async function save() {
    setSaveError(null);
    try {
      const saved = await saveMutation.mutateAsync(profile);
      setProfile(saved);
      setSavedProfile(saved);
    } catch (error) {
      setSaveError(errorMessage(error, "Couldn't save your diet profile."));
    }
  }

  return {
    actions: { save, updateProfile },
    state,
  };
}
