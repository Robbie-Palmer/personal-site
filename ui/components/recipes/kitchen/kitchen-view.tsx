"use client";

import {
  Check,
  ChefHat,
  CirclePlus,
  Plus,
  Refrigerator,
  Search,
  ShoppingBasket,
  Sprout,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useKitchenStock } from "@/hooks/use-kitchen-stock";
import { useShoppingList } from "@/hooks/use-shopping-list";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import {
  getKitchenRecipeMatches,
  KITCHEN_LOCATIONS,
  type KitchenIngredientView,
  type KitchenLocation,
  type KitchenRecipeView,
} from "@/lib/domain/recipe/kitchen";
import { cn } from "@/lib/generic/styles";
import {
  clearStock as clearKitchenStock,
  type KitchenStock,
  removeFromStock,
  replaceStock,
  setStockLocation,
} from "@/lib/kitchen/kitchenStockStore";
import { toggleRecipe } from "@/lib/shopping/shoppingListStore";

const CATALOG_RESULT_LIMIT = 18;

const LOCATION_ICONS = {
  fridge: Refrigerator,
  cupboards: ShoppingBasket,
  fresh: Sprout,
} satisfies Record<KitchenLocation, typeof Refrigerator>;

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function formatTime(minutes?: number) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function RecipeMatchCard({
  recipe,
  inList,
  onToggleList,
}: Readonly<{
  recipe: ReturnType<typeof getKitchenRecipeMatches>[number];
  inList: boolean;
  onToggleList: () => void;
}>) {
  const timeLabel = formatTime(recipe.totalTime);
  const canCook = recipe.totalCount > 0 && recipe.missingCount === 0;
  const progress = Math.round(recipe.matchRatio * 100);

  return (
    // A "stretched link" card: the Link fills the card so tapping it opens the
    // recipe, while the add-to-list button sits above it (relative z-10) and
    // stays independently clickable without nesting a button inside an anchor.
    <Card className="group relative overflow-hidden rounded-lg border-[1.25px] border-[var(--line-strong)] bg-[var(--card)] py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--paper-shadow)]">
      <Link
        href={`/recipes/${recipe.slug}`}
        aria-label={`Open ${recipe.title}`}
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]/50"
      />
      <CardContent className="p-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-md",
              canCook
                ? "bg-[var(--sage)] text-white"
                : "bg-[var(--paper-warm)] text-[var(--terracotta)]",
            )}
          >
            {canCook ? (
              <Check className="size-5" />
            ) : (
              <ChefHat className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="rt-display text-2xl leading-none transition-colors group-hover:text-[var(--terracotta)]">
              {recipe.title}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--ink-3)]">
              {timeLabel && <span>{timeLabel}</span>}
              {recipe.cuisine.slice(0, 2).map((cuisine) => (
                <span key={cuisine}>{cuisine}</span>
              ))}
              <span>
                {recipe.haveCount}/{recipe.totalCount} ingredients
              </span>
            </div>
          </div>
          <Badge
            variant={canCook ? "default" : "outline"}
            className={cn(
              "shrink-0",
              canCook
                ? "bg-[var(--sage)] text-white"
                : "text-[var(--terracotta)]",
            )}
          >
            {canCook ? "cook" : `+${recipe.missingCount}`}
          </Badge>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--paper-warm)]">
          <div
            className={cn(
              "h-full rounded-full",
              canCook ? "bg-[var(--sage)]" : "bg-[var(--terracotta)]",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {recipe.missingIngredients.length > 0 && (
          <p className="rt-body mt-2 line-clamp-2 text-sm text-[var(--ink-2)]">
            Need:{" "}
            <span className="text-[var(--terracotta)]">
              {recipe.missingIngredients
                .slice(0, 5)
                .map((ingredient) => ingredient.name)
                .join(", ")}
              {recipe.missingIngredients.length > 5 ? "..." : ""}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={onToggleList}
          aria-pressed={inList}
          className={cn(
            "relative z-10 mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
            inList
              ? "border-[var(--sage)] bg-[var(--sage)]/10 text-[var(--sage)] hover:bg-[var(--sage)]/15"
              : "border-[var(--line-strong)] text-[var(--ink-2)] hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]",
          )}
        >
          {inList ? (
            <>
              <Check className="size-4" /> On shopping list
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add to shopping list
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

function LocationIcon({ location }: Readonly<{ location: KitchenLocation }>) {
  const Icon = LOCATION_ICONS[location];
  return <Icon className="size-4" />;
}

export function KitchenView({
  ingredients,
  recipes,
}: Readonly<{
  ingredients: KitchenIngredientView[];
  recipes: KitchenRecipeView[];
}>) {
  const ingredientBySlug = useMemo(
    () =>
      new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient])),
    [ingredients],
  );
  const knownIngredientSlugs = useMemo(
    () => new Set<string>(ingredients.map((ingredient) => ingredient.slug)),
    [ingredients],
  );
  const stock = useKitchenStock();
  const shoppingList = useShoppingList();
  const selectedRecipeSlugs = useMemo(
    () => new Set(shoppingList.recipes.map((entry) => entry.slug)),
    [shoppingList.recipes],
  );
  const [stockQuery, setStockQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [lastClearedStock, setLastClearedStock] = useState<KitchenStock | null>(
    null,
  );
  const [targetLocation, setTargetLocation] =
    useState<KitchenLocation>("cupboards");
  const catalogCardRef = useRef<HTMLDivElement>(null);
  const catalogSearchRef = useRef<HTMLInputElement>(null);

  const stockedSlugs = useMemo(
    () =>
      Object.keys(stock).filter((slug): slug is IngredientSlug =>
        knownIngredientSlugs.has(slug),
      ),
    [knownIngredientSlugs, stock],
  );

  const matches = useMemo(
    () => getKitchenRecipeMatches(recipes, stockedSlugs),
    [recipes, stockedSlugs],
  );
  const cookNow = matches
    .filter((recipe) => recipe.totalCount > 0 && recipe.missingCount === 0)
    .slice(0, 4);
  const closeMatches = matches
    .filter((recipe) => recipe.missingCount > 0)
    .slice(0, 5);

  const catalogMatches = useMemo(() => {
    const query = normalizeQuery(catalogQuery);
    return ingredients
      .filter((ingredient) => !(ingredient.slug in stock))
      .filter((ingredient) => {
        if (!query) return true;
        return `${ingredient.name} ${ingredient.category ?? ""}`
          .toLowerCase()
          .includes(query);
      });
  }, [catalogQuery, ingredients, stock]);
  const filteredCatalog = catalogMatches.slice(0, CATALOG_RESULT_LIMIT);
  const isCatalogTruncated = catalogMatches.length > filteredCatalog.length;

  const stockQueryNormalized = normalizeQuery(stockQuery);
  const groupedStock = useMemo(
    () =>
      KITCHEN_LOCATIONS.map((location) => ({
        id: location.id,
        label: location.label,
        description: location.description,
        icon: LOCATION_ICONS[location.id],
        items: stockedSlugs
          .filter((slug) => stock[slug] === location.id)
          .map((slug) => ingredientBySlug.get(slug))
          .filter((ingredient): ingredient is KitchenIngredientView =>
            Boolean(ingredient),
          )
          .filter((ingredient) => {
            if (!stockQueryNormalized) return true;
            return ingredient.name.toLowerCase().includes(stockQueryNormalized);
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [ingredientBySlug, stock, stockQueryNormalized, stockedSlugs],
  );

  const addIngredient = (
    ingredient: KitchenIngredientView,
    location = targetLocation,
  ) => {
    setStockLocation(ingredient.slug, location);
    setLastClearedStock(null);
  };

  const removeIngredient = (slug: IngredientSlug) => {
    removeFromStock(slug);
  };

  const focusAddIngredients = (location: KitchenLocation) => {
    setTargetLocation(location);
    window.requestAnimationFrame(() => {
      catalogCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      catalogSearchRef.current?.focus({ preventScroll: true });
    });
  };

  const clearStock = () => {
    setLastClearedStock(stock);
    clearKitchenStock();
  };

  const undoClear = () => {
    if (!lastClearedStock) return;
    replaceStock(lastClearedStock);
    setLastClearedStock(null);
  };

  const stockedCount = stockedSlugs.length;

  return (
    <div className="container mx-auto min-h-screen max-w-7xl px-4 pt-5 pb-16 md:pt-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rt-mono text-[var(--terracotta)]">
            Kitchen · stock match
          </p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl lg:text-7xl">
            What can I <span className="text-[var(--terracotta)]">make?</span>
          </h1>
          <p className="rt-body mt-3 max-w-2xl text-[var(--ink-2)]">
            Add ingredients from the canonical recipe catalog, split them across
            fridge, cupboards and fresh, then compare your kitchen against the
            recipe box.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="rounded-lg border-[1.25px] border-[var(--line-strong)] bg-[var(--card)]">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="rt-mono text-[var(--terracotta)]">In stock</p>
                  <CardTitle className="rt-display text-4xl">
                    Your kitchen.
                  </CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  {stockedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearStock}
                      className="inline-flex items-center gap-1 rt-mono text-[var(--ink-3)] transition-colors hover:text-[var(--berry)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> clear all
                    </button>
                  )}
                  {lastClearedStock && stockedCount === 0 && (
                    <button
                      type="button"
                      onClick={undoClear}
                      className="inline-flex items-center gap-1 rt-mono text-[var(--ink-3)] transition-colors hover:text-[var(--terracotta)]"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> undo clear
                    </button>
                  )}
                  <Badge variant="outline" className="text-[var(--ink-2)]">
                    {stockedCount} {stockedCount === 1 ? "item" : "items"}
                  </Badge>
                </div>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
                <Input
                  value={stockQuery}
                  onChange={(event) => setStockQuery(event.target.value)}
                  placeholder="Search what you have..."
                  className="h-10 border-[var(--line-strong)] bg-[var(--paper)] pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {groupedStock.map((group) => {
                const Icon = group.icon;
                return (
                  <section key={group.id} className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-[var(--line)] pb-2">
                      <div className="min-w-0">
                        <h2 className="rt-display flex items-center gap-2 text-3xl text-[var(--terracotta)]">
                          <Icon className="size-5" />
                          {group.label}
                        </h2>
                        <p className="rt-body text-sm text-[var(--ink-3)]">
                          {group.description}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[var(--terracotta)]"
                        onClick={() => focusAddIngredients(group.id)}
                        aria-label={`Add ingredients to ${group.label}`}
                      >
                        <CirclePlus className="size-4" />
                        Add here
                      </Button>
                    </div>
                    {group.items.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap gap-2">
                        {group.items.map((ingredient) => (
                          <Badge
                            key={ingredient.slug}
                            variant="outline"
                            className="max-w-full gap-1.5 bg-[var(--paper-warm)] px-2 py-1 text-sm text-[var(--ink)]"
                          >
                            <span className="truncate">{ingredient.name}</span>
                            <button
                              type="button"
                              onClick={() => removeIngredient(ingredient.slug)}
                              className="rounded-sm p-0.5 text-[var(--ink-3)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--berry)]"
                              aria-label={`Remove ${ingredient.name}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="rt-body text-sm text-[var(--ink-3)]">
                        Nothing here yet.
                      </p>
                    )}
                  </section>
                );
              })}
            </CardContent>
          </Card>

          <Card
            ref={catalogCardRef}
            className="scroll-mt-24 rounded-lg border-[1.25px] border-[var(--line-strong)] bg-[var(--card)]"
          >
            <CardHeader className="gap-3">
              <div>
                <p className="rt-mono text-[var(--terracotta)]">
                  Canonical ingredients
                </p>
                <CardTitle className="rt-display text-4xl">
                  Add to your kitchen.
                </CardTitle>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <Input
                    ref={catalogSearchRef}
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder={`Search ${ingredients.length} ingredients...`}
                    className="h-10 border-[var(--line-strong)] bg-[var(--paper)] pl-9"
                  />
                </div>
                <div className="grid grid-cols-3 rounded-md border border-[var(--line-strong)] bg-[var(--paper-warm)] p-1">
                  {KITCHEN_LOCATIONS.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => setTargetLocation(location.id)}
                      aria-label={`Add ingredients to ${location.label}`}
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-sm px-2 py-1.5 text-sm transition-colors",
                        targetLocation === location.id
                          ? "bg-[var(--card)] text-[var(--ink)] shadow-xs"
                          : "text-[var(--ink-3)] hover:text-[var(--ink)]",
                      )}
                    >
                      <LocationIcon location={location.id} />
                      <span className="hidden sm:inline">{location.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCatalog.map((ingredient) => (
                  <button
                    key={ingredient.slug}
                    type="button"
                    onClick={() => addIngredient(ingredient)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left transition-colors hover:border-[var(--terracotta)] hover:bg-[var(--butter-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">
                        {ingredient.name}
                      </span>
                      <span className="rt-mono block truncate text-[var(--ink-3)]">
                        {ingredient.category ?? "ingredient"}
                      </span>
                    </span>
                    <CirclePlus className="size-4 shrink-0 text-[var(--terracotta)]" />
                  </button>
                ))}
              </div>
              {isCatalogTruncated && (
                <p className="rt-body mt-3 text-sm text-[var(--ink-3)]">
                  Showing {filteredCatalog.length} of {catalogMatches.length}
                  matching ingredients.
                </p>
              )}
              {filteredCatalog.length === 0 && (
                <p className="rt-body text-sm text-[var(--ink-3)]">
                  No matching ingredients left to add.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-lg border-[1.25px] border-[var(--line-strong)] bg-[var(--card)]">
            <CardHeader>
              <p className="rt-mono text-[var(--sage)]">Cook now</p>
              <CardTitle className="rt-display text-4xl">
                Ready recipes.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cookNow.length > 0 ? (
                cookNow.map((recipe) => (
                  <RecipeMatchCard
                    key={recipe.slug}
                    recipe={recipe}
                    inList={selectedRecipeSlugs.has(recipe.slug)}
                    onToggleList={() => toggleRecipe(recipe.slug)}
                  />
                ))
              ) : (
                <p className="rt-body text-sm text-[var(--ink-3)]">
                  Add a few more staples to see fully stocked recipes.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[1.25px] border-[var(--line-strong)] bg-[var(--card)]">
            <CardHeader>
              <p className="rt-mono text-[var(--terracotta)]">
                Just need a few
              </p>
              <CardTitle className="rt-display text-4xl">
                Close matches.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {closeMatches.length > 0 ? (
                closeMatches.map((recipe) => (
                  <RecipeMatchCard
                    key={recipe.slug}
                    recipe={recipe}
                    inList={selectedRecipeSlugs.has(recipe.slug)}
                    onToggleList={() => toggleRecipe(recipe.slug)}
                  />
                ))
              ) : (
                <p className="rt-body text-sm text-[var(--ink-3)]">
                  No close matches right now.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
