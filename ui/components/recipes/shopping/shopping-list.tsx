"use client";

import {
  ArrowRight,
  Layers,
  Plus,
  Refrigerator,
  RotateCcw,
  ShoppingBasket,
  Sprout,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ShoppingCheckbox } from "@/components/recipes/shopping/shopping-checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useKitchenStock } from "@/hooks/use-kitchen-stock";
import { useShoppingList } from "@/hooks/use-shopping-list";
import { useUnitPreference } from "@/hooks/use-unit-preference";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import type { MeasurementSystem } from "@/lib/domain/recipe";
import type { KitchenLocation } from "@/lib/domain/recipe/kitchen";
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
import { removeFromStock } from "@/lib/kitchen/kitchenStockStore";
import {
  addExtra,
  clearChecked,
  removeExtra,
  toggleChecked,
  toggleExtra,
} from "@/lib/shopping/shoppingListStore";

type ListView = "aisle" | "recipe" | "flat";

const LOCATION_META: Record<
  KitchenLocation,
  { label: string; icon: typeof Refrigerator }
> = {
  fridge: { label: "fridge", icon: Refrigerator },
  cupboards: { label: "cupboards", icon: ShoppingBasket },
  fresh: { label: "fresh", icon: Sprout },
};

const VIEWS: { id: ListView; label: string }[] = [
  { id: "aisle", label: "by aisle" },
  { id: "recipe", label: "by recipe" },
  { id: "flat", label: "just ingredients" },
];

function byName(a: ShoppingLine, b: ShoppingLine): number {
  return a.name.localeCompare(b.name);
}

/**
 * Sink handled items (ticked off, or already in the kitchen) to the bottom of a
 * list (keeping each partition's existing order), like a notes app — so
 * attention stays on what's still to buy. Un-handling returns an item to its
 * sorted place.
 */
function doneLast(
  lines: ShoppingLine[],
  isDone: (line: ShoppingLine) => boolean,
): ShoppingLine[] {
  const todo = lines.filter((line) => !isDone(line));
  const done = lines.filter((line) => isDone(line));
  return [...todo, ...done];
}

/**
 * Marks a line whose quantity was summed across several recipes. The layers
 * icon + count reads as "combined from N recipes" (the old ↻ glyph looked like
 * a refresh control).
 */
function MergedBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-1.5 align-middle inline-flex items-center gap-0.5 rounded border border-[var(--butter)] bg-[var(--butter-soft)] px-1 py-px text-[0.625rem] text-[var(--ink-2)]"
      title={`Quantity combined from ${count} recipes`}
    >
      <Layers className="h-2.5 w-2.5" />
      {count}
    </span>
  );
}

/**
 * A line whose ingredient is already stocked in the kitchen. Distinct from a
 * manual tick: a sage location chip marks it as "have it, didn't buy it", and a
 * one-tap remove pulls it back out of the kitchen (the undo) if we don't
 * actually have it after all.
 */
function KitchenItemRow({
  line,
  system,
  location,
}: {
  line: ShoppingLine;
  system: MeasurementSystem;
  location: KitchenLocation;
}) {
  const quantity = formatShoppingQuantities(line.quantities, system);
  const name = formatShoppingName(line);
  const { label, icon: Icon } = LOCATION_META[location];
  return (
    <div className="w-full flex items-center gap-2.5 py-1.5 border-b border-dashed border-[var(--line)] last:border-0">
      <span
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] bg-[var(--sage)] text-white"
        aria-hidden="true"
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <span className="rt-body flex-1 leading-snug text-[var(--ink-3)] line-through">
        {quantity && <b className="font-semibold">{quantity}</b>}
        {quantity ? " " : ""}
        {name}
        {line.recipes.length > 1 && <MergedBadge count={line.recipes.length} />}
      </span>
      <span className="rt-mono text-[var(--sage)] hidden sm:inline">
        in {label}
      </span>
      <button
        type="button"
        onClick={() => removeFromStock(line.ingredient)}
        aria-label={`Remove ${name} from the kitchen`}
        title="Not in the kitchen after all — put back on the list"
        className="inline-flex items-center gap-1 rt-mono text-[var(--ink-4)] hover:text-[var(--berry)] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ItemRow({
  line,
  system,
  checked,
  kitchenLocation,
  showRecipes,
}: {
  line: ShoppingLine;
  system: MeasurementSystem;
  checked: boolean;
  kitchenLocation?: KitchenLocation;
  showRecipes: boolean;
}) {
  if (kitchenLocation) {
    return (
      <KitchenItemRow line={line} system={system} location={kitchenLocation} />
    );
  }

  const quantity = formatShoppingQuantities(line.quantities, system);
  const name = formatShoppingName(line);
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
        {line.recipes.length > 1 && <MergedBadge count={line.recipes.length} />}
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
  const stock = useKitchenStock();
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

  // An ingredient already in the kitchen (any location) is pulled out of the
  // aisle/recipe groups and gathered into the "already have" section, so the
  // main list stays focused on what's still to buy. Ticked items just sink.
  const locationOf = (line: ShoppingLine): KitchenLocation | undefined =>
    stock[line.ingredient];
  const inKitchen = (line: ShoppingLine): boolean =>
    Boolean(stock[line.ingredient]);

  const groupLines = (lines: ShoppingLine[]): ShoppingLine[] =>
    doneLast(
      lines.filter((line) => !inKitchen(line)),
      (line) => checkedSet.has(line.ingredient),
    );

  const flatLines = useMemo(() => [...aggregated].sort(byName), [aggregated]);

  const haveLines = useMemo(
    () => aggregated.filter((line) => stock[line.ingredient]).sort(byName),
    [aggregated, stock],
  );
  const inKitchenCount = haveLines.length;

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
    inKitchenCount > 0 ? `${inKitchenCount} in kitchen` : null,
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
            {groupLines(flatLines).map((line) => (
              <ItemRow
                key={line.ingredient}
                line={line}
                system={system}
                checked={checkedSet.has(line.ingredient)}
                kitchenLocation={locationOf(line)}
                showRecipes
              />
            ))}
          </div>
        )}

        {view === "aisle" &&
          aisleGroups.map((group) => {
            const lines = groupLines(group.lines);
            if (lines.length === 0) return null;
            return (
              <div key={group.id}>
                <SectionHeading title={group.name} />
                <div className="mt-1">
                  {lines.map((line) => (
                    <ItemRow
                      key={line.ingredient}
                      line={line}
                      system={system}
                      checked={checkedSet.has(line.ingredient)}
                      kitchenLocation={locationOf(line)}
                      showRecipes
                    />
                  ))}
                </div>
              </div>
            );
          })}

        {view === "recipe" &&
          recipeGroups.map((group) => {
            const lines = groupLines(group.lines);
            if (lines.length === 0) return null;
            return (
              <div key={group.recipe.slug}>
                <SectionHeading
                  title={group.recipe.title}
                  hint={`${group.servings} ${group.servings === 1 ? "serving" : "servings"}`}
                />
                <div className="mt-1">
                  {lines.map((line) => (
                    <ItemRow
                      key={line.ingredient}
                      line={line}
                      system={system}
                      checked={checkedSet.has(line.ingredient)}
                      kitchenLocation={locationOf(line)}
                      showRecipes={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {haveLines.length > 0 && (
        <div className="mt-6">
          <div className="mt-5 flex items-baseline justify-between border-b border-[var(--line)] pb-1">
            <h3 className="rt-display text-2xl text-[var(--terracotta)]">
              · already have
            </h3>
            <Link
              href="/recipes/kitchen"
              className="inline-flex items-center gap-1 rt-mono text-[var(--ink-3)] transition-colors hover:text-[var(--terracotta)]"
            >
              {haveLines.length} in the kitchen
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="rt-body mt-1 text-sm text-[var(--ink-3)]">
            Skipped because they're in your kitchen. Tap ✕ to put one back on
            the list if you don't actually have it.
          </p>
          <div className="mt-1">
            {haveLines.map((line) => (
              <ItemRow
                key={line.ingredient}
                line={line}
                system={system}
                checked={checkedSet.has(line.ingredient)}
                kitchenLocation={locationOf(line)}
                showRecipes={false}
              />
            ))}
          </div>
        </div>
      )}

      <ExtrasSection extras={state.extras} />
    </div>
  );
}
