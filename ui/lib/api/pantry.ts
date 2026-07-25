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
  pendingLegacyStock?: KitchenStock;
};

const POPULATED_PANTRY_INVITE_ERROR =
  "Pantry must be empty before joining a household";
const LEGACY_PANTRY_OWNER_KEY = "recipe-kitchen-stock-v1-owner";

function getLegacyPantryOwner(): string | null {
  try {
    return localStorage.getItem(LEGACY_PANTRY_OWNER_KEY);
  } catch {
    return null;
  }
}

function setLegacyPantryOwner(userId: string): void {
  try {
    localStorage.setItem(LEGACY_PANTRY_OWNER_KEY, userId);
  } catch {
    // The explicit import can still proceed when storage metadata is
    // unavailable; the stock is only cleared after persistence succeeds.
  }
}

function clearLegacyPantry(): void {
  clearLegacyKitchenStock();
  try {
    localStorage.removeItem(LEGACY_PANTRY_OWNER_KEY);
  } catch {
    // localStorage unavailable
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
  return parsePantryResponse(
    await fetch("/api/pantry", {
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function getPantryWithLegacyMigration(
  userId: string,
  signal?: AbortSignal,
): Promise<Pantry> {
  const pantry = await getPantry(signal);
  const legacyStock = getKitchenStockSnapshot();
  if (Object.keys(legacyStock).length === 0) return pantry;

  const legacyOwner = getLegacyPantryOwner();
  if (legacyOwner && legacyOwner !== userId) {
    clearLegacyPantry();
    return pantry;
  }

  if (
    legacyOwner === userId &&
    pantry.scope.type === "personal" &&
    Object.keys(pantry.stock).length === 0
  ) {
    const migrated = await importLegacyStock(legacyStock);
    clearLegacyPantry();
    return migrated;
  }

  if (legacyOwner === null) {
    return { ...pantry, pendingLegacyStock: legacyStock };
  }

  // Keep claimed stock recoverable when an import precondition changes. The
  // server will only accept it while this account has an empty personal pantry.
  return { ...pantry, pendingLegacyStock: legacyStock };
}

export async function importLegacyPantry(userId: string): Promise<Pantry> {
  setLegacyPantryOwner(userId);
  const legacyStock = getKitchenStockSnapshot();
  if (Object.keys(legacyStock).length === 0) {
    clearLegacyPantry();
    return getPantry();
  }

  const migrated = await importLegacyStock(legacyStock);
  clearLegacyPantry();
  return migrated;
}

export function discardLegacyPantry(pantry: Pantry): Pantry {
  clearLegacyPantry();
  const { pendingLegacyStock: _discarded, ...persistedPantry } = pantry;
  return persistedPantry;
}

export async function replacePantry(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry", "PUT", { stock }),
  );
}

async function importLegacyStock(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry/import", "PUT", { stock }),
  );
}

export async function restorePantry(stock: KitchenStock): Promise<Pantry> {
  return parsePantryResponse(
    await pantryRequest("/api/pantry/restore", "PUT", { stock }),
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

export function assertLegacyPantryEmpty(
  message = POPULATED_PANTRY_INVITE_ERROR,
): void {
  if (Object.keys(getKitchenStockSnapshot()).length > 0) {
    throw new Error(message);
  }
}
