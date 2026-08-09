import { apiRequest } from "@/lib/api/http";
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

function pantryRequest(
  path: string,
  method: "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<Pantry> {
  return apiRequest(path, {
    method,
    json: body,
    fallbackMessage: "Pantry request failed.",
  });
}

export async function getPantry(signal?: AbortSignal): Promise<Pantry> {
  deleteLegacyBrowserPantry();
  return apiRequest("/api/pantry", {
    signal,
    fallbackMessage: "Pantry request failed.",
  });
}

export async function replacePantry(stock: KitchenStock): Promise<Pantry> {
  return pantryRequest("/api/pantry", "PUT", { stock });
}

export async function restorePantry(stock: KitchenStock): Promise<Pantry> {
  return pantryRequest("/api/pantry", "PATCH", { stock });
}

export async function setPantryItem(
  ingredientSlug: IngredientSlug,
  location: KitchenLocation,
): Promise<Pantry> {
  return pantryRequest(
    `/api/pantry/items/${encodeURIComponent(ingredientSlug)}`,
    "PUT",
    { location },
  );
}

export async function removePantryItem(
  ingredientSlug: IngredientSlug,
): Promise<Pantry> {
  return pantryRequest(
    `/api/pantry/items/${encodeURIComponent(ingredientSlug)}`,
    "DELETE",
  );
}
