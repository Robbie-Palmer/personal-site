"use client";

import { CalendarDays, Minus, Plus, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { SlotPicker } from "@/components/recipes/shopping/slot-picker";
import { Button } from "@/components/ui/button";
import { useShoppingList } from "@/hooks/use-shopping-list";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import {
  clearMealPlan,
  MEAL_PLAN_DAYS,
  MEAL_PLAN_SLOTS,
  type MealPlanDay,
  type MealPlanSlot,
  removeRecipe,
  setRecipeServings,
} from "@/lib/shopping/shoppingListStore";

function planKey(day: MealPlanDay, slot: MealPlanSlot): string {
  return `${day}:${slot}`;
}

function mealCountLabel(count: number): string {
  return `${count} ${count === 1 ? "meal" : "meals"}`;
}

function recipeCountLabel(count: number): string {
  return `${count} ${count === 1 ? "recipe" : "recipes"}`;
}

function servingCountLabel(count: number): string {
  return `${count} ${count === 1 ? "serving" : "servings"}`;
}

type ServingsStepperProps = Readonly<{
  slug: string;
  servings: number;
}>;

function ServingsStepper({ slug, servings }: ServingsStepperProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setRecipeServings(slug, servings - 1)}
        disabled={servings <= 1}
        aria-label="Decrease servings"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="rt-mono min-w-12 text-center text-[var(--ink-2)]">
        {servings}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setRecipeServings(slug, servings + 1)}
        aria-label="Increase servings"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

type PlanCellProps = Readonly<{
  day: MealPlanDay;
  slot: MealPlanSlot;
  dayLabel: string;
  slotLabel: string;
  plannedRecipe?: ShoppingRecipe;
  recipeOptions: readonly ShoppingRecipe[];
}>;

function PlanCell({
  day,
  slot,
  dayLabel,
  slotLabel,
  plannedRecipe,
  recipeOptions,
}: PlanCellProps) {
  return (
    <div className="flex min-h-16 min-w-0">
      <SlotPicker
        day={day}
        slot={slot}
        dayLabel={dayLabel}
        slotLabel={slotLabel}
        plannedRecipe={plannedRecipe}
        recipes={recipeOptions}
      />
    </div>
  );
}

type MealPlannerProps = Readonly<{
  recipes: ShoppingRecipe[];
  availableRecipes?: ShoppingRecipe[];
}>;

export function MealPlanner({
  recipes,
  availableRecipes = recipes,
}: MealPlannerProps) {
  const state = useShoppingList();

  const bySlug = useMemo(() => {
    const map = new Map<string, ShoppingRecipe>();
    for (const recipe of recipes) map.set(recipe.slug, recipe);
    return map;
  }, [recipes]);

  const sortedRecipes = useMemo(() => {
    return [...availableRecipes].sort((a, b) => a.title.localeCompare(b.title));
  }, [availableRecipes]);

  const planBySlot = useMemo(() => {
    const map = new Map<string, ShoppingRecipe>();
    for (const meal of state.plan) {
      const recipe = bySlug.get(meal.slug);
      if (recipe) map.set(planKey(meal.day, meal.slot), recipe);
    }
    return map;
  }, [state.plan, bySlug]);

  const usageBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const meal of state.plan) {
      map.set(meal.slug, (map.get(meal.slug) ?? 0) + 1);
    }
    return map;
  }, [state.plan]);

  const selected = useMemo(() => {
    return state.recipes.flatMap((entry) => {
      const recipe = bySlug.get(entry.slug);
      if (!recipe) return [];
      return [
        {
          recipe,
          servings: entry.servings ?? recipe.servings,
          plannedMeals: usageBySlug.get(entry.slug) ?? 0,
        },
      ];
    });
  }, [state.recipes, bySlug, usageBySlug]);

  const plannedMealCount = state.plan.filter((meal) =>
    bySlug.has(meal.slug),
  ).length;
  const unscheduled = selected.filter((entry) => entry.plannedMeals === 0);
  const totalServings = selected.reduce(
    (sum, entry) => sum + entry.servings,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper-warm)] px-3 py-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--card)] text-[var(--terracotta)]">
          <CalendarDays className="h-4 w-4" />
        </span>
        <p className="rt-body text-sm text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">
            {recipeCountLabel(selected.length)}
          </b>{" "}
          in the plan pool ·{" "}
          <b className="text-[var(--ink)]">
            {mealCountLabel(plannedMealCount)}
          </b>{" "}
          scheduled ·{" "}
          <b className="text-[var(--ink)]">
            {servingCountLabel(totalServings)}
          </b>
          {unscheduled.length > 0
            ? ` · ${recipeCountLabel(unscheduled.length)} unscheduled`
            : ""}
        </p>
        {state.plan.length > 0 && (
          <button
            type="button"
            onClick={clearMealPlan}
            className="ml-auto inline-flex items-center gap-1 rt-mono text-[var(--ink-3)] transition-colors hover:text-[var(--terracotta)]"
          >
            <Trash2 className="h-3.5 w-3.5" /> clear calendar
          </button>
        )}
      </div>

      <div>
        <div className="hidden lg:grid lg:grid-cols-[7rem_repeat(7,minmax(0,1fr))] lg:gap-2">
          <div />
          {MEAL_PLAN_DAYS.map((day) => (
            <div
              key={day.id}
              className="rt-mono text-center text-[0.7rem] text-[var(--terracotta)]"
            >
              {day.short.toUpperCase()}
            </div>
          ))}
          {MEAL_PLAN_SLOTS.map((slot) => (
            <div key={slot.id} className="contents">
              <div className="self-center pr-2 text-right rt-mono text-xs text-[var(--ink-3)]">
                {slot.label}
              </div>
              {MEAL_PLAN_DAYS.map((day) => {
                const recipe = planBySlot.get(planKey(day.id, slot.id));
                return (
                  <PlanCell
                    key={`${day.id}-${slot.id}`}
                    day={day.id}
                    slot={slot.id}
                    dayLabel={day.label}
                    slotLabel={slot.label}
                    plannedRecipe={recipe}
                    recipeOptions={sortedRecipes}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="space-y-4 lg:hidden">
          {MEAL_PLAN_DAYS.map((day) => (
            <div key={day.id}>
              <h2 className="rt-display text-2xl text-[var(--terracotta)]">
                · {day.label}
              </h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {MEAL_PLAN_SLOTS.map((slot) => {
                  const recipe = planBySlot.get(planKey(day.id, slot.id));
                  return (
                    <div key={slot.id} className="min-w-0">
                      <div className="mb-1 rt-mono text-xs text-[var(--ink-3)]">
                        {slot.label}
                      </div>
                      <PlanCell
                        day={day.id}
                        slot={slot.id}
                        dayLabel={day.label}
                        slotLabel={slot.label}
                        plannedRecipe={recipe}
                        recipeOptions={sortedRecipes}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="rt-display text-3xl text-[var(--terracotta)]">
              · recipe pool
            </h2>
            <p className="rt-mono text-[var(--ink-3)]">
              servings feed the shopping list
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {selected.map(({ recipe, servings, plannedMeals }) => (
              <div
                key={recipe.slug}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-[var(--card)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate rt-display text-xl leading-tight">
                    {recipe.title}
                  </p>
                  <p className="rt-mono text-[var(--ink-3)]">
                    {plannedMeals > 0
                      ? mealCountLabel(plannedMeals)
                      : "unscheduled"}
                  </p>
                </div>
                <ServingsStepper slug={recipe.slug} servings={servings} />
                <button
                  type="button"
                  onClick={() => removeRecipe(recipe.slug)}
                  aria-label={`Remove ${recipe.title}`}
                  className="text-[var(--ink-4)] transition-colors hover:text-[var(--berry)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--card)] p-3">
          <p className="rt-mono text-[var(--terracotta)]">
            Unscheduled recipes
          </p>
          <p className="rt-body mt-1 text-sm text-[var(--ink-3)]">
            These stay in the shopping list. Drop them into a calendar slot when
            you know when they are being cooked.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unscheduled.map(({ recipe }) => (
              <span
                key={recipe.slug}
                className="max-w-full truncate rounded-md border border-[var(--line)] bg-[var(--paper-warm)] px-2 py-1 rt-body text-sm text-[var(--ink-2)]"
              >
                {recipe.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
