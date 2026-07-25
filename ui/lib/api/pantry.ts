import { ApiError } from "@/lib/api/api-error";
import type { KitchenLocation } from "@/lib/domain/recipe/kitchen";
import {
  clearStock as clearLegacyKitchenStock,
  getKitchenStockSnapshot,
  type KitchenStock,
} from "@/lib/kitchen/kitchenStockStore";

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

const POPULATED_PANTRY_INVITE_ERROR =
  "Pantry must be empty before joining a household";

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
  return parsePantryResponse(
    await fetch("/api/pantry", {
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function getPantryWithLegacyMigration(
  signal?: AbortSignal,
): Promise<Pantry> {
  const pantry = await getPantry(signal);
  const legacyStock = getKitchenStockSnapshot();
  if (Object.keys(legacyStock).length === 0) return pantry;

  if (
    pantry.scope.type === "personal" &&
    Object.keys(pantry.stock).length === 0
  ) {
    const migrated = await replacePantry(legacyStock);
    clearLegacyKitchenStock();
    return migrated;
  }

  // Persisted stock is already authoritative (or belongs to a household), so
  // this browser's old v1 cache must not be merged or resurrected later.
  clearLegacyKitchenStock();
  return pantry;
}

export async function migrateLegacyPantryBeforeHouseholdCreation(): Promise<void> {
  if (Object.keys(getKitchenStockSnapshot()).length === 0) return;
  await getPantryWithLegacyMigration();
}

export async function replacePantry(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry", "PUT", { stock }),
  );
}

export async function setPantryItem(
  ingredientSlug: string,
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
  ingredientSlug: string,
): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest(
      `/api/pantry/items/${encodeURIComponent(ingredientSlug)}`,
      "DELETE",
    ),
  );
}

export function assertLegacyPantryEmpty(): void {
  if (Object.keys(getKitchenStockSnapshot()).length > 0) {
    throw new Error(POPULATED_PANTRY_INVITE_ERROR);
  }
}
