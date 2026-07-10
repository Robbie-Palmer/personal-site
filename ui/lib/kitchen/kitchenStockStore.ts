/**
 * Client-side kitchen-stock store.
 *
 * A module-level store (consumed via useSyncExternalStore in
 * `use-kitchen-stock`) holding which ingredients the user has at home and where
 * they live (fridge / cupboards / fresh). Persisted to localStorage so the
 * kitchen survives reloads and stays in sync across tabs — and, crucially, so
 * the shopping list can read the same source to check off what's already in the
 * kitchen. Mirrors the shopping-list and unit-preference stores; there is no
 * server component (the site is a static export, so state lives in the browser).
 */

import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import {
  isKitchenLocation,
  type KitchenLocation,
} from "@/lib/domain/recipe/kitchen";

export type KitchenStock = Record<string, KitchenLocation>;

const STORAGE_KEY = "recipe-kitchen-stock-v1";

const EMPTY_STOCK: KitchenStock = {};

let state: KitchenStock = EMPTY_STOCK;
let hydrated = false;
const listeners = new Set<() => void>();

// Always a fresh object (never the shared EMPTY_STOCK constant), so a consumer
// accidentally mutating a snapshot can't corrupt the module-level empty state.
function parseStock(raw: string | null): KitchenStock {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const stock: KitchenStock = {};
    for (const [slug, location] of Object.entries(parsed)) {
      if (isKitchenLocation(location)) stock[slug] = location;
    }
    return stock;
  } catch {
    return {};
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    state = parseStock(localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures (quota, private browsing)
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: KitchenStock): void {
  state = next;
  persist();
  emit();
}

// A single, module-wide storage listener (hooked once on first subscribe, like
// the shopping-list store) rather than one per subscriber — otherwise a
// cross-tab update would fan out redundant notifications.
let storageListenerHooked = false;

function handleStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  state = parseStock(event.newValue);
  emit();
}

function hookStorageListener(): void {
  if (storageListenerHooked || globalThis.window === undefined) return;
  storageListenerHooked = true;
  globalThis.addEventListener("storage", handleStorage);
}

export function subscribeKitchenStock(callback: () => void): () => void {
  hydrate();
  hookStorageListener();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getKitchenStockSnapshot(): KitchenStock {
  hydrate();
  return state;
}

export function getServerKitchenStockSnapshot(): KitchenStock {
  return EMPTY_STOCK;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function setStockLocation(
  slug: IngredientSlug,
  location: KitchenLocation,
): void {
  if (state[slug] === location) return;
  setState({ ...state, [slug]: location });
}

export function removeFromStock(slug: IngredientSlug): void {
  if (!(slug in state)) return;
  const next = { ...state };
  delete next[slug];
  setState(next);
}

export function clearStock(): void {
  if (Object.keys(state).length === 0) return;
  setState({});
}

/** Restore a whole stock map — used to undo a clear. */
export function replaceStock(stock: KitchenStock): void {
  setState({ ...stock });
}

/** Reset module state between tests (mirrors the shopping-list store). */
export function __resetKitchenStockForTests(): void {
  if (storageListenerHooked) {
    globalThis.removeEventListener("storage", handleStorage);
    storageListenerHooked = false;
  }
  state = EMPTY_STOCK;
  hydrated = false;
  listeners.clear();
}
