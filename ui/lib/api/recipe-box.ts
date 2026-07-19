export type RecipeBoxProfile = {
  completed: boolean;
  staticRecipeSlugs: string[];
};

async function parseRecipeBoxResponse(response: Response) {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Recipe box request failed.");
  }
  return response.json() as Promise<RecipeBoxProfile>;
}

export async function getRecipeBoxProfile(signal?: AbortSignal) {
  return parseRecipeBoxResponse(
    await fetch("/api/profile/recipe-box", {
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function saveRecipeBoxProfile(staticRecipeSlugs: string[]) {
  return parseRecipeBoxResponse(
    await fetch("/api/profile/recipe-box", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staticRecipeSlugs }),
    }),
  );
}
