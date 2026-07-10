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

type DietLabelOption = {
  key: string;
  label: string;
  sub: string;
};

export type DietGroupOption = DietLabelOption & {
  ingredientSlugs: string[];
};

export type DietPresetOption = DietLabelOption & {
  excludedGroupKeys: string[];
  excludedIngredientSlugs: string[];
};

export type DietOptions = {
  presets: DietPresetOption[];
  groups: DietGroupOption[];
  ingredients: DietIngredientOption[];
};

export const emptyDietProfile: DietProfile = {
  presetDietKeys: [],
  excludedIngredientSlugs: [],
  excludedGroupKeys: [],
  recipeMatchMode: "hide",
};

export const emptyDietOptions: DietOptions = {
  presets: [],
  groups: [],
  ingredients: [],
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

async function parseDietOptionsResponse(
  response: Response,
): Promise<DietOptions> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Diet options request failed.");
  }
  return response.json() as Promise<DietOptions>;
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

export async function getDietOptions(
  signal?: AbortSignal,
): Promise<DietOptions> {
  const response = await fetch("/api/profile/diet/options", {
    credentials: "same-origin",
    signal,
  });
  return parseDietOptionsResponse(response);
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
