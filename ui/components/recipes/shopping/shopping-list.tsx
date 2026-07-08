"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ShoppingCheckbox } from "@/components/recipes/shopping/shopping-checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useShoppingList } from "@/hooks/use-shopping-list";
import { useUnitPreference } from "@/hooks/use-unit-preference";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import type { MeasurementSystem } from "@/lib/domain/recipe";
import {
  aggregateShoppingList,
  type SelectedRecipe,
  type ShoppingLine,
} from "@/lib/domain/shopping/aggregate";
import { aisleName, compareAisles } from "@/lib/domain/shopping/aisles";
import {
  formatShoppingName,
  formatShoppingQuantities,
} from "@/lib/domain/shopping/display";
import {
  addExtra,
  clearChecked,
  removeExtra,
  toggleChecked,
  toggleExtra,
} from "@/lib/shopping/shoppingListStore";

type ListView = "aisle" | "recipe" | "flat";

const VIEWS: { id: ListView; label: string }[] = [
  { id: "aisle", label: "by aisle" },
  { id: "recipe", label: "by recipe" },
  { id: "flat", label: "just ingredients" },
];

function byName(a: ShoppingLine, b: ShoppingLine): number {
  return a.name.localeCompare(b.name);
}

/**
 * Sink ticked-off items to the bottom of a list (keeping each partition's
 * existing order), like a notes app — so attention stays on what's still to
 * buy. Unticking returns an item to its sorted place.
 */
function checkedLast(
  lines: ShoppingLine[],
  checkedSet: Set<string>,
): ShoppingLine[] {
  const todo = lines.filter((line) => !checkedSet.has(line.ingredient));
  const done = lines.filter((line) => checkedSet.has(line.ingredient));
  return [...todo, ...done];
}

function ItemRow({
  line,
  system,
  checked,
  showRecipes,
}: {
  line: ShoppingLine;
  system: MeasurementSystem;
  checked: boolean;
  showRecipes: boolean;
}) {
  const quantity = formatShoppingQuantities(line.quantities, system);
  const name = formatShoppingName(line);
  const merged = line.recipes.length > 1;
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => toggleChecked(line.ingredient)}
      className="w-full flex items-center gap-2.5 py-1.5 text-left border-b border-dashed border-[var(--line)] last:border-0"
    >
      <ShoppingCheckbox checked={checked} />
      <span
        className={[
          "rt-body flex-1 leading-snug",
          checked ? "line-through text-[var(--ink-3)]" : "text-[var(--ink)]",
        ].join(" ")}
      >
        {quantity && <b className="font-semibold">{quantity}</b>}
        {quantity ? " " : ""}
        {name}
        {merged && (
          <span
            className="ml-1.5 align-middle inline-flex items-center rounded border border-[var(--butter)] bg-[var(--butter-soft)] px-1 text-[0.625rem] text-[var(--ink-2)]"
            title={`Combined from ${line.recipes.length} recipes`}
          >
            ↻
          </span>
        )}
      </span>
      {showRecipes && (
        <span className="rt-mono text-[var(--ink-4)] hidden sm:block max-w-[45%] truncate text-right">
          {line.recipes.map((r) => r.title).join(" · ")}
        </span>
      )}
    </button>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-1 mt-5 first:mt-0">
      <h3 className="rt-display text-2xl text-[var(--terracotta)]">
        · {title}
      </h3>
      {hint && <span className="rt-mono text-[var(--ink-3)]">{hint}</span>}
    </div>
  );
}

function ExtrasSection({
  extras,
}: {
  extras: { id: string; text: string; checked: boolean }[];
}) {
  const [text, setText] = useState("");
  const submit = () => {
    addExtra(text);
    setText("");
  };
  // Ticked extras sink to the bottom too, matching the ingredient rows.
  const ordered = [
    ...extras.filter((e) => !e.checked),
    ...extras.filter((e) => e.checked),
  ];
  return (
    <div className="mt-6">
      <SectionHeading title="extras" />
      {extras.length > 0 && (
        <div className="mt-1">
          {ordered.map((extra) => (
            <div
              key={extra.id}
              className="flex items-center gap-2.5 py-1.5 border-b border-dashed border-[var(--line)] last:border-0"
            >
              <button
                type="button"
                aria-pressed={extra.checked}
                onClick={() => toggleExtra(extra.id)}
                className="flex items-center gap-2.5 flex-1 text-left"
              >
                <ShoppingCheckbox checked={extra.checked} />
                <span
                  className={[
                    "rt-body leading-snug",
                    extra.checked
                      ? "line-through text-[var(--ink-3)]"
                      : "text-[var(--ink)]",
                  ].join(" ")}
                >
                  {extra.text}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeExtra(extra.id)}
                aria-label={`Remove ${extra.text}`}
                className="text-[var(--ink-4)] hover:text-[var(--berry)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 flex gap-2 max-w-sm"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an extra (milk, bread…)"
          aria-label="Add an extra item"
          className="bg-[var(--card)]"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--line-strong)] px-3 text-sm text-[var(--ink-2)] hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-40 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}

export function ShoppingList({ recipes }: { recipes: ShoppingRecipe[] }) {
  const state = useShoppingList();
  const [system] = useUnitPreference();
  const [view, setView] = useState<ListView>("aisle");

  const bySlug = useMemo(() => {
    const map = new Map<string, ShoppingRecipe>();
    for (const recipe of recipes) map.set(recipe.slug, recipe);
    return map;
  }, [recipes]);

  const selected = useMemo<SelectedRecipe[]>(() => {
    return state.recipes.flatMap((entry) => {
      const recipe = bySlug.get(entry.slug);
      if (!recipe) return [];
      const servings = entry.servings ?? recipe.servings;
      return [{ recipe, scale: servings / recipe.servings }];
    });
  }, [state.recipes, bySlug]);

  const aggregated = useMemo(() => aggregateShoppingList(selected), [selected]);

  const checkedSet = useMemo(() => new Set(state.checked), [state.checked]);

  const flatLines = useMemo(() => [...aggregated].sort(byName), [aggregated]);

  const aisleGroups = useMemo(() => {
    const groups = new Map<string, ShoppingLine[]>();
    for (const line of aggregated) {
      const list = groups.get(line.aisle) ?? [];
      list.push(line);
      groups.set(line.aisle, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => compareAisles(a, b))
      .map(([id, lines]) => ({
        id,
        name: aisleName(id),
        lines: [...lines].sort(byName),
      }));
  }, [aggregated]);

  const recipeGroups = useMemo(() => {
    return selected.map(({ recipe, scale }) => {
      const lines = aggregateShoppingList([{ recipe, scale }]);
      lines.sort(byName);
      return {
        recipe,
        servings: Math.round(recipe.servings * scale),
        lines,
      };
    });
  }, [selected]);

  const tickedCount =
    aggregated.filter((l) => checkedSet.has(l.ingredient)).length +
    state.extras.filter((e) => e.checked).length;
  const itemCount = aggregated.length + state.extras.length;
  const servingCount = recipeGroups.reduce(
    (total, group) => total + group.servings,
    0,
  );
  const stats = [
    selected.length > 0
      ? `${selected.length} ${selected.length === 1 ? "recipe" : "recipes"}`
      : null,
    selected.length > 0
      ? `${servingCount} ${servingCount === 1 ? "serving" : "servings"}`
      : null,
    `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
    `${tickedCount} ticked`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasTicked = tickedCount > 0;

  if (selected.length === 0 && state.extras.length === 0) {
    return (
      <div className="rounded-xl border-[1.25px] border-dashed border-[var(--line-strong)] bg-[var(--card)] p-10 text-center">
        <p className="rt-display text-3xl text-[var(--ink-2)]">
          Nothing on the list yet
        </p>
        <p className="rt-body text-[var(--ink-3)] mt-2">
          Pick some recipes above and their ingredients will gather here,
          combined and sorted for the shop.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-[1.25px] border-[var(--line-strong)] bg-[var(--card)] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rt-mono text-[var(--ink-3)]">{stats}</p>
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Badge
              key={v.id}
              variant={view === v.id ? "default" : "secondary"}
              interactive
              active={view === v.id}
              className="cursor-pointer"
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Badge>
          ))}
        </div>
      </div>

      {hasTicked && (
        <button
          type="button"
          onClick={clearChecked}
          className="mt-2 inline-flex items-center gap-1 rt-mono text-[var(--ink-3)] hover:text-[var(--terracotta)] transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> uncheck all
        </button>
      )}

      <div className="mt-3">
        {view === "flat" && (
          <div>
            <div className="rt-mono text-[var(--ink-3)] mb-1">
              Just ingredients · A–Z
            </div>
            {checkedLast(flatLines, checkedSet).map((line) => (
              <ItemRow
                key={line.ingredient}
                line={line}
                system={system}
                checked={checkedSet.has(line.ingredient)}
                showRecipes
              />
            ))}
          </div>
        )}

        {view === "aisle" &&
          aisleGroups.map((group) => (
            <div key={group.id}>
              <SectionHeading title={group.name} />
              <div className="mt-1">
                {checkedLast(group.lines, checkedSet).map((line) => (
                  <ItemRow
                    key={line.ingredient}
                    line={line}
                    system={system}
                    checked={checkedSet.has(line.ingredient)}
                    showRecipes
                  />
                ))}
              </div>
            </div>
          ))}

        {view === "recipe" &&
          recipeGroups.map((group) => (
            <div key={group.recipe.slug}>
              <SectionHeading
                title={group.recipe.title}
                hint={`${group.servings} ${group.servings === 1 ? "serving" : "servings"}`}
              />
              <div className="mt-1">
                {checkedLast(group.lines, checkedSet).map((line) => (
                  <ItemRow
                    key={line.ingredient}
                    line={line}
                    system={system}
                    checked={checkedSet.has(line.ingredient)}
                    showRecipes={false}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      <ExtrasSection extras={state.extras} />
    </div>
  );
}
