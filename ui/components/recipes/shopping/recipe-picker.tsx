"use client";

import { Minus, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ShoppingCheckbox } from "@/components/recipes/shopping/shopping-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShoppingList } from "@/hooks/use-shopping-list";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";
import {
  removeRecipe,
  setRecipeServings,
  toggleRecipe,
} from "@/lib/shopping/shoppingListStore";

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function ServingsStepper({
  slug,
  servings,
}: {
  slug: string;
  servings: number;
}) {
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
      <span className="tabular-nums text-center min-w-[4.5rem]">
        <span className="rt-display text-xl text-[var(--terracotta)] align-middle">
          {servings}
        </span>{" "}
        <span className="align-middle text-xs text-[var(--ink-3)]">
          {servings === 1 ? "serving" : "servings"}
        </span>
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

function PickerCard({
  recipe,
  selected,
  servings,
}: {
  recipe: ShoppingRecipe;
  selected: boolean;
  servings: number;
}) {
  return (
    <div
      className={[
        "rounded-xl border-[1.25px] bg-[var(--card)] overflow-hidden transition-all",
        "flex flex-col hover:-translate-y-0.5 hover:shadow-[var(--paper-shadow)]",
        selected
          ? "border-[var(--terracotta)] ring-1 ring-[var(--terracotta)]"
          : "border-[var(--line-strong)]",
      ].join(" ")}
    >
      {/* The toggle is its own button so the servings stepper (which contains
          buttons of its own) can live alongside it without nesting buttons. */}
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => toggleRecipe(recipe.slug)}
        className="flex gap-3 p-3 text-left w-full cursor-pointer"
      >
        {recipe.image && (
          // biome-ignore lint/performance/noImgElement: native img for SSG srcset control
          <img
            src={getImageUrl(recipe.image, null, {
              width: 160,
              format: "auto",
            })}
            alt={recipe.imageAlt || recipe.title}
            width={64}
            height={64}
            loading="lazy"
            className="h-16 w-16 rounded-lg object-cover flex-shrink-0 bg-muted"
          />
        )}
        <span className="flex-1 min-w-0 block">
          <span className="flex items-start gap-2">
            <ShoppingCheckbox checked={selected} className="mt-1" />
            <span className="rt-display text-xl leading-tight flex-1 block">
              {recipe.title}
            </span>
          </span>
          <span className="rt-mono text-[var(--ink-3)] mt-1 truncate block">
            {[
              recipe.cuisine.join(" · ").toLowerCase(),
              recipe.totalTime != null ? formatTime(recipe.totalTime) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </button>
      {selected && (
        <div className="border-t border-[var(--line)] px-3 py-2 flex items-center justify-between gap-2 bg-[var(--paper-warm)]/50">
          <ServingsStepper slug={recipe.slug} servings={servings} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeRecipe(recipe.slug);
            }}
            className="rt-mono text-[var(--ink-3)] hover:text-[var(--berry)] inline-flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> remove
          </button>
        </div>
      )}
    </div>
  );
}

export function RecipePicker({ recipes }: { recipes: ShoppingRecipe[] }) {
  const { recipes: selectedEntries } = useShoppingList();
  const [query, setQuery] = useState("");

  const servingsBySlug = useMemo(() => {
    const map = new Map<string, number | undefined>();
    for (const entry of selectedEntries) map.set(entry.slug, entry.servings);
    return map;
  }, [selectedEntries]);

  // Pre-compute each recipe's lowercase search string once (not per keystroke).
  const searchIndex = useMemo(
    () =>
      recipes.map((recipe) => ({
        recipe,
        haystack: [
          recipe.title,
          recipe.cuisine.join(" "),
          recipe.ingredients.map((i) => i.name).join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [recipes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return searchIndex
      .filter((entry) => entry.haystack.includes(q))
      .map((entry) => entry.recipe);
  }, [recipes, searchIndex, query]);

  // Selected recipes float to the top so the current basket is always in view.
  const ordered = useMemo(() => {
    const isSelected = (slug: string) => servingsBySlug.has(slug);
    return [...filtered].sort((a, b) => {
      const sa = isSelected(a.slug) ? 0 : 1;
      const sb = isSelected(b.slug) ? 0 : 1;
      return sa - sb;
    });
  }, [filtered, servingsBySlug]);

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)] pointer-events-none" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${recipes.length} recipes…`}
          aria-label="Search recipes to add"
          className="pl-9 bg-[var(--card)]"
        />
      </div>

      {ordered.length === 0 ? (
        <p className="rt-body text-[var(--ink-3)] py-8 text-center">
          No recipes match “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ordered.map((recipe) => {
            const stored = servingsBySlug.get(recipe.slug);
            const selected = servingsBySlug.has(recipe.slug);
            return (
              <PickerCard
                key={recipe.slug}
                recipe={recipe}
                selected={selected}
                servings={stored ?? recipe.servings}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
