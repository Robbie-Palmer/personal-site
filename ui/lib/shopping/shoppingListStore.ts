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

export const MEAL_PLAN_DAYS = [
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
  { id: "sun", label: "Sunday", short: "Sun" },
] as const;

export const MEAL_PLAN_SLOTS = [
  { id: "breakfast", label: "Breakfast", short: "B" },
  { id: "lunch", label: "Lunch", short: "L" },
  { id: "dinner", label: "Dinner", short: "D" },
] as const;

const MEAL_PLAN_DAY_SET: ReadonlySet<unknown> = new Set(
  MEAL_PLAN_DAYS.map((day) => day.id),
);
const MEAL_PLAN_SLOT_SET: ReadonlySet<unknown> = new Set(
  MEAL_PLAN_SLOTS.map((slot) => slot.id),
);

export type MealPlanDay = (typeof MEAL_PLAN_DAYS)[number]["id"];

export type MealPlanSlot = (typeof MEAL_PLAN_SLOTS)[number]["id"];

export type PlannedMealEntry = {
  day: MealPlanDay;
  slot: MealPlanSlot;
  slug: string;
};

export type ShoppingListState = {
  /** Selected recipes, kept in the order they were added. */
  recipes: SelectedRecipeEntry[];
  /** Weekly calendar slots that reference selected recipes. */
  plan: PlannedMealEntry[];
  /** Ticked-off ingredient slugs. */
  checked: string[];
  /** Freeform extras (milk, bread…). */
  extras: ExtraItem[];
};

const STORAGE_KEY = "recipe-shopping-list:v1";

const EMPTY_STATE: ShoppingListState = {
  recipes: [],
  plan: [],
  checked: [],
  extras: [],
};

let state: ShoppingListState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMealPlanDay(value: unknown): value is MealPlanDay {
  return MEAL_PLAN_DAY_SET.has(value);
}

function isMealPlanSlot(value: unknown): value is MealPlanSlot {
  return MEAL_PLAN_SLOT_SET.has(value);
}

function parseState(raw: string | null): ShoppingListState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_STATE;

    const recipes = Array.isArray(parsed.recipes)
      ? parsed.recipes.flatMap((entry): SelectedRecipeEntry[] => {
          if (!isRecord(entry) || typeof entry.slug !== "string") return [];
          // Normalise persisted servings the same way setRecipeServings does,
          // so stale/edited storage can't feed the UI a fractional value the
          // stepper (integer labels, servings<=1 disable) doesn't expect.
          const raw = entry.servings;
          const servings =
            typeof raw === "number" && Number.isFinite(raw) && raw > 0
              ? Math.max(1, Math.round(raw))
              : undefined;
          return [{ slug: entry.slug, ...(servings ? { servings } : {}) }];
        })
      : [];

    const seenPlanSlots = new Set<string>();
    const plan = Array.isArray(parsed.plan)
      ? parsed.plan.flatMap((entry): PlannedMealEntry[] => {
          if (
            !isRecord(entry) ||
            !isMealPlanDay(entry.day) ||
            !isMealPlanSlot(entry.slot) ||
            typeof entry.slug !== "string"
          ) {
            return [];
          }
          const key = `${entry.day}:${entry.slot}`;
          if (seenPlanSlots.has(key)) return [];
          seenPlanSlots.add(key);
          return [{ day: entry.day, slot: entry.slot, slug: entry.slug }];
        })
      : [];

    const recipeSlugs = new Set(recipes.map((recipe) => recipe.slug));
    for (const meal of plan) {
      if (!recipeSlugs.has(meal.slug)) {
        recipes.push({ slug: meal.slug });
        recipeSlugs.add(meal.slug);
      }
    }

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

    return { recipes, plan, checked, extras };
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

// A single, module-wide storage listener (hooked once on first subscribe, like
// the cooking-timer store) rather than one per subscriber — otherwise a
// cross-tab update would fan out to N handlers each calling emit() over N
// callbacks (N×N redundant notifications).
let storageListenerHooked = false;

function handleStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  state = parseState(event.newValue);
  emit();
}

function hookStorageListener(): void {
  if (storageListenerHooked || globalThis.window === undefined) return;
  storageListenerHooked = true;
  globalThis.addEventListener("storage", handleStorage);
}

export function subscribeShoppingList(callback: () => void): () => void {
  hydrate();
  hookStorageListener();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
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
    plan: state.plan.filter((meal) => meal.slug !== slug),
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

export function setPlannedMeal(
  day: MealPlanDay,
  slot: MealPlanSlot,
  slug: string | null,
): void {
  const plan = state.plan.filter(
    (meal) => meal.day !== day || meal.slot !== slot,
  );
  const recipes =
    slug && !state.recipes.some((recipe) => recipe.slug === slug)
      ? [...state.recipes, { slug }]
      : state.recipes;
  setState({
    ...state,
    recipes,
    plan: slug ? [...plan, { day, slot, slug }] : plan,
  });
}

export function clearMealPlan(): void {
  if (state.plan.length === 0) return;
  setState({ ...state, plan: [] });
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
  // Ignore an accidental re-add of an extra that's already on the list
  // (case-insensitive); a genuine duplicate is almost always a mistake.
  const key = trimmed.toLowerCase();
  if (state.extras.some((e) => e.text.toLowerCase() === key)) return;
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

/** Reset module state between tests (mirrors the cooking-timer store). */
export function __resetShoppingListForTests(): void {
  if (storageListenerHooked) {
    globalThis.removeEventListener("storage", handleStorage);
    storageListenerHooked = false;
  }
  state = EMPTY_STATE;
  hydrated = false;
  listeners.clear();
}
