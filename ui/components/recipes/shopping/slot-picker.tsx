"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  RecipeThumb,
  recipeMetaLabel,
} from "@/components/recipes/shopping/recipe-card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import {
  type MealPlanDay,
  type MealPlanSlot,
  setPlannedMeal,
} from "@/lib/shopping/shoppingListStore";

type SlotPickerProps = Readonly<{
  day: MealPlanDay;
  slot: MealPlanSlot;
  slotLabel: string;
  dayLabel: string;
  plannedRecipe?: ShoppingRecipe;
  recipes: readonly ShoppingRecipe[];
}>;

/**
 * Fills a single calendar slot. Replaces the old native <select> with a
 * search-first popover that mirrors the kitchen tab's "add ingredient" flow:
 * click the slot, search, pick a recipe card. An empty slot shows an inviting
 * "+ add" target; a filled slot shows the recipe and reopens the picker to
 * swap it.
 */
export function SlotPicker({
  day,
  slot,
  slotLabel,
  dayLabel,
  plannedRecipe,
  recipes,
}: SlotPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((recipe) =>
      `${recipe.title} ${recipe.cuisine.join(" ")}`.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  const assign = (slug: string | null) => {
    setPlannedMeal(day, slot, slug);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        {plannedRecipe ? (
          <button
            type="button"
            aria-label={`Change ${slotLabel} on ${dayLabel} (${plannedRecipe.title})`}
            className="flex w-full min-w-0 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper-warm)] px-2 py-1.5 text-left transition-colors hover:border-[var(--terracotta)]"
          >
            <RecipeThumb recipe={plannedRecipe} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate rt-body text-sm leading-tight text-[var(--ink)]">
                {plannedRecipe.title}
              </span>
              <span className="block truncate rt-mono text-[0.65rem] text-[var(--ink-3)]">
                {recipeMetaLabel(plannedRecipe) || "planned"}
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Add a meal to ${slotLabel} on ${dayLabel}`}
            className="flex h-full w-full min-h-9 items-center justify-center gap-1 rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--card)] px-2 py-1.5 rt-mono text-xs text-[var(--ink-3)] transition-colors hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            <Plus className="h-3.5 w-3.5" /> add
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-[var(--line)] p-2">
          <p className="rt-mono text-[0.65rem] text-[var(--terracotta)]">
            {dayLabel} · {slotLabel}
          </p>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-3)]" />
            {/* Radix moves focus to this first focusable child on open, so the
                picker is search-ready without an explicit autoFocus. */}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${recipes.length} recipes…`}
              aria-label="Search recipes"
              className="h-9 bg-[var(--paper)] pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="rt-body px-2 py-6 text-center text-sm text-[var(--ink-3)]">
              No recipes match “{query}”.
            </p>
          ) : (
            filtered.map((recipe) => {
              const active = plannedRecipe?.slug === recipe.slug;
              return (
                <button
                  key={recipe.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => assign(active ? null : recipe.slug)}
                  className={[
                    "flex w-full min-w-0 items-center gap-2.5 rounded-md p-1.5 text-left transition-colors",
                    active
                      ? "bg-[var(--butter-soft)]"
                      : "hover:bg-[var(--paper-warm)]",
                  ].join(" ")}
                >
                  <RecipeThumb recipe={recipe} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate rt-body text-sm leading-tight text-[var(--ink)]">
                      {recipe.title}
                    </span>
                    <span className="block truncate rt-mono text-[0.65rem] text-[var(--ink-3)]">
                      {recipeMetaLabel(recipe)}
                    </span>
                  </span>
                  {active && (
                    <Check className="size-4 shrink-0 text-[var(--terracotta)]" />
                  )}
                </button>
              );
            })
          )}
        </div>
        {plannedRecipe && (
          <div className="border-t border-[var(--line)] p-1.5">
            <button
              type="button"
              onClick={() => assign(null)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 rt-mono text-xs text-[var(--ink-3)] transition-colors hover:text-[var(--berry)]"
            >
              <X className="size-3.5" /> clear this slot
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
