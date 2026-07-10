export type DietRecipeMatchMode = "hide" | "warn";

export type DietProfile = {
  presetDietKeys: string[];
  excludedIngredientSlugs: string[];
  excludedGroupKeys: string[];
  recipeMatchMode: DietRecipeMatchMode;
};

export type DietIngredientOption = {
  slug: string;
  name: string;
  category?: string;
};

export const emptyDietProfile: DietProfile = {
  presetDietKeys: [],
  excludedIngredientSlugs: [],
  excludedGroupKeys: [],
  recipeMatchMode: "hide",
};

async function parseDietResponse(response: Response): Promise<DietProfile> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Diet profile request failed.");
  }
  return response.json() as Promise<DietProfile>;
}

export async function getDietProfile(
  signal?: AbortSignal,
): Promise<DietProfile> {
  const response = await fetch("/api/profile/diet", {
    credentials: "same-origin",
    signal,
  });
  return parseDietResponse(response);
}

export async function saveDietProfile(
  profile: DietProfile,
): Promise<DietProfile> {
  const response = await fetch("/api/profile/diet", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profile),
  });
  return parseDietResponse(response);
}
