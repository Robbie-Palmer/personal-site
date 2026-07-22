export type RecipeBoxProfile = {
  completed: boolean;
  recipeSlugs: string[];
};

async function parseRecipeBoxResponse(response: Response) {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Recipe box request failed.");
  }
  const body = (await response.json()) as RecipeBoxProfile & {
    staticRecipeSlugs?: string[];
  };
  return {
    completed: body.completed,
    recipeSlugs: body.recipeSlugs ?? body.staticRecipeSlugs ?? [],
  };
}

export async function getRecipeBoxProfile(signal?: AbortSignal) {
  return parseRecipeBoxResponse(
    await fetch("/api/profile/recipe-box", {
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function saveRecipeBoxProfile(recipeSlugs: string[]) {
  return parseRecipeBoxResponse(
    await fetch("/api/profile/recipe-box", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipeSlugs }),
    }),
  );
}
