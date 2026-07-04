/**
 * Client-side shopping-list store.
 *
 * A module-level store (consumed via useSyncExternalStore in
 * `use-shopping-list`) holding the recipes the user wants to cook, any
 * per-recipe servings override, which ingredients they've ticked off, and any
 * freeform "extra" items. Persisted to localStorage so the list survives
 * reloads and stays in sync across tabs — matching the unit-preference and
 * cooking-timer stores. There is no server component: the site is a static
 * export, so the list lives entirely in the browser for this first pass.
 */

export type SelectedRecipeEntry = {
  slug: string;
  /** Chosen servings; when absent the recipe's own servings are used. */
  servings?: number;
};

export type ExtraItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type ShoppingListState = {
  /** Selected recipes, kept in the order they were added. */
  recipes: SelectedRecipeEntry[];
  /** Ticked-off ingredient slugs. */
  checked: string[];
  /** Freeform extras (milk, bread…). */
  extras: ExtraItem[];
};

const STORAGE_KEY = "recipe-shopping-list:v1";

const EMPTY_STATE: ShoppingListState = {
  recipes: [],
  checked: [],
  extras: [],
};

let state: ShoppingListState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseState(raw: string | null): ShoppingListState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_STATE;

    const recipes = Array.isArray(parsed.recipes)
      ? parsed.recipes.flatMap((entry): SelectedRecipeEntry[] => {
          if (!isRecord(entry) || typeof entry.slug !== "string") return [];
          const servings =
            typeof entry.servings === "number" &&
            Number.isFinite(entry.servings) &&
            entry.servings > 0
              ? entry.servings
              : undefined;
          return [{ slug: entry.slug, ...(servings ? { servings } : {}) }];
        })
      : [];

    const checked = Array.isArray(parsed.checked)
      ? parsed.checked.filter((v): v is string => typeof v === "string")
      : [];

    const extras = Array.isArray(parsed.extras)
      ? parsed.extras.flatMap((entry): ExtraItem[] => {
          if (
            !isRecord(entry) ||
            typeof entry.id !== "string" ||
            typeof entry.text !== "string"
          ) {
            return [];
          }
          return [{ id: entry.id, text: entry.text, checked: !!entry.checked }];
        })
      : [];

    return { recipes, checked, extras };
  } catch {
    return EMPTY_STATE;
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    state = parseState(localStorage.getItem(STORAGE_KEY));
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

function setState(next: ShoppingListState): void {
  state = next;
  persist();
  emit();
}

export function subscribeShoppingList(callback: () => void): () => void {
  hydrate();
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = parseState(event.newValue);
    emit();
  };
  globalThis.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    globalThis.removeEventListener("storage", onStorage);
  };
}

export function getShoppingListSnapshot(): ShoppingListState {
  hydrate();
  return state;
}

export function getServerShoppingListSnapshot(): ShoppingListState {
  return EMPTY_STATE;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function isRecipeSelected(slug: string): boolean {
  return getShoppingListSnapshot().recipes.some((r) => r.slug === slug);
}

export function addRecipe(slug: string): void {
  if (isRecipeSelected(slug)) return;
  setState({ ...state, recipes: [...state.recipes, { slug }] });
}

export function removeRecipe(slug: string): void {
  setState({
    ...state,
    recipes: state.recipes.filter((r) => r.slug !== slug),
  });
}

export function toggleRecipe(slug: string): void {
  if (isRecipeSelected(slug)) removeRecipe(slug);
  else addRecipe(slug);
}

export function setRecipeServings(slug: string, servings: number): void {
  const safe = Math.max(1, Math.round(servings));
  setState({
    ...state,
    recipes: state.recipes.map((r) =>
      r.slug === slug ? { ...r, servings: safe } : r,
    ),
  });
}

export function toggleChecked(key: string): void {
  const checked = state.checked.includes(key)
    ? state.checked.filter((k) => k !== key)
    : [...state.checked, key];
  setState({ ...state, checked });
}

export function clearChecked(): void {
  if (state.checked.length === 0 && state.extras.every((e) => !e.checked)) {
    return;
  }
  setState({
    ...state,
    checked: [],
    extras: state.extras.map((e) => ({ ...e, checked: false })),
  });
}

export function addExtra(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  // crypto.randomUUID (not Math.random) keeps this out of Sonar's PRNG hotspot;
  // addExtra only runs in the browser, where crypto is always available.
  const id = `extra-${crypto.randomUUID()}`;
  setState({
    ...state,
    extras: [...state.extras, { id, text: trimmed, checked: false }],
  });
}

export function toggleExtra(id: string): void {
  setState({
    ...state,
    extras: state.extras.map((e) =>
      e.id === id ? { ...e, checked: !e.checked } : e,
    ),
  });
}

export function removeExtra(id: string): void {
  setState({ ...state, extras: state.extras.filter((e) => e.id !== id) });
}

export function clearList(): void {
  setState({ ...EMPTY_STATE });
}
