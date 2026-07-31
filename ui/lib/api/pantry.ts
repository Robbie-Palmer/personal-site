import { ApiError } from "@/lib/api/api-error";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type {
  KitchenLocation,
  KitchenStock,
} from "@/lib/domain/recipe/kitchen";

export type PantryScope =
  | { type: "personal" }
  | {
      type: "household";
      household: { id: string; name: string };
    };

export type Pantry = {
  scope: PantryScope;
  stock: KitchenStock;
};

const LEGACY_PANTRY_STORAGE_KEY = "recipe-kitchen-stock-v1";
const LEGACY_PANTRY_OWNER_KEY = "recipe-kitchen-stock-v1-owner";

function deleteLegacyBrowserPantry(): void {
  try {
    localStorage.removeItem(LEGACY_PANTRY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PANTRY_OWNER_KEY);
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
  }
}

async function parsePantryResponse(response: Response): Promise<Pantry> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(
      body?.error ?? "Pantry request failed.",
      response.status,
    );
  }
  return response.json() as Promise<Pantry>;
}

function pantryRequest(
  path: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<Response> {
  return fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function getPantry(signal?: AbortSignal): Promise<Pantry> {
  deleteLegacyBrowserPantry();
  return parsePantryResponse(
    await fetch("/api/pantry", {
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function replacePantry(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry", "PUT", { stock }),
  );
}

export async function restorePantry(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry/restore", "PUT", { stock }),
  );
}

export async function setPantryItem(
  ingredientSlug: IngredientSlug,
  location: KitchenLocation,
): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest(
      `/api/pantry/items/${encodeURIComponent(ingredientSlug)}`,
      "PUT",
      { location },
    ),
  );
}

export async function removePantryItem(
  ingredientSlug: IngredientSlug,
): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest(
      `/api/pantry/items/${encodeURIComponent(ingredientSlug)}`,
      "DELETE",
    ),
  );
}
