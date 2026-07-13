"use client";

import {
  ChefHat,
  Clock,
  Globe,
  Leaf,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DietListNotice, DietWarning } from "@/components/recipes/diet-notice";
import { useDiet } from "@/components/recipes/diet-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FilterableCardGrid,
  type MultiFilterConfig,
  type SearchConfig,
} from "@/components/ui/filterable-card-grid";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { RecipeCardView } from "@/lib/api/recipes";
import {
  applyDietRecipeVisibility,
  buildDietRecipeMatches,
  type DietMatch,
} from "@/lib/domain/diet";
import { formatDate } from "@/lib/generic/date";
import { cycleFilterFromCard } from "@/lib/generic/filter-cycle";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

const TIME_RANGES = [
  { label: "Under 15 min", max: 14 },
  { label: "15–30 min", min: 15, max: 30 },
  { label: "30–60 min", min: 31, max: 60 },
  { label: "Over 60 min", min: 61 },
] as const;

const MATCHING_DIET_MATCH: DietMatch = {
  matches: true,
  excludedIngredients: [],
};

function getTimeRangeLabel(minutes: number): string {
  for (const range of TIME_RANGES) {
    const aboveMin = !("min" in range) || minutes >= range.min;
    const belowMax = !("max" in range) || minutes <= range.max;
    if (aboveMin && belowMax) return range.label;
  }
  // Fallback to last range (should never reach here given the ranges cover all values)
  return TIME_RANGES[TIME_RANGES.length - 1]?.label ?? "";
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// These configs are static. Defining them at module scope (rather than inline
// in the JSX) keeps their references stable across renders, so FilterableCardGrid
// doesn't rebuild its Fuse index or recompute its memos on every filter toggle.
const RECIPE_FILTER_PARAMS = [
  { paramName: "cuisine", isMulti: true },
  { paramName: "ingredient", isMulti: true },
  { paramName: "equipment", isMulti: true },
  { paramName: "prepTime", isMulti: true },
  { paramName: "totalTime", isMulti: true },
];

const URL_SYNC_DEBOUNCE_MS = 300;

const RECIPE_SEARCH_CONFIG: SearchConfig<RecipeCardView> = {
  placeholder: "Search recipes…",
  ariaLabel: "Search recipes",
  keys: [
    { name: "title", weight: 3 },
    { name: "description", weight: 2 },
    { name: "cuisine", weight: 2 },
    { name: "ingredientNames", weight: 1 },
    { name: "cookware", weight: 1 },
  ],
  threshold: 0.1,
};

const RECIPE_FILTER_CONFIGS: MultiFilterConfig<RecipeCardView>[] = [
  {
    paramName: "cuisine",
    isMulti: true,
    label: "Cuisines",
    getItemValues: (recipe) => recipe.cuisine,
    icon: <Globe className="h-4 w-4" />,
    getValueLabel: (value) => value,
    getOptionIcon: () => <Globe className="h-3 w-3" />,
  },
  {
    paramName: "ingredient",
    isMulti: true,
    label: "Ingredients",
    getItemValues: (recipe) => recipe.ingredientNames,
    icon: <Leaf className="h-4 w-4" />,
    getValueLabel: (value) => value,
    getOptionIcon: () => <Leaf className="h-3 w-3" />,
  },
  {
    paramName: "equipment",
    isMulti: true,
    label: "Equipment",
    getItemValues: (recipe) => recipe.cookware,
    icon: <ChefHat className="h-4 w-4" />,
    getValueLabel: (value) => value,
    getOptionIcon: () => <ChefHat className="h-3 w-3" />,
  },
  {
    paramName: "prepTime",
    isMulti: true,
    label: "Prep Time",
    getItemValues: (recipe) =>
      recipe.prepTime != null ? [getTimeRangeLabel(recipe.prepTime)] : [],
    icon: <Timer className="h-4 w-4" />,
    getValueLabel: (value) => value,
    getOptionIcon: () => <Timer className="h-3 w-3" />,
  },
  {
    paramName: "totalTime",
    isMulti: true,
    label: "Total Time",
    getItemValues: (recipe) =>
      recipe.totalTime != null ? [getTimeRangeLabel(recipe.totalTime)] : [],
    icon: <Clock className="h-4 w-4" />,
    getOptionIcon: () => <Clock className="h-3 w-3" />,
  },
];

const RECIPE_SORT_CONFIG = {
  getDate: (recipe: RecipeCardView) => recipe.date,
};

const RECIPE_EMPTY_STATE = {
  icon: <UtensilsCrossed className="w-10 h-10 text-muted-foreground/50" />,
  message: "No recipes found matching your criteria.",
};

function CuisineBadge({
  cuisine,
  isActive,
  onToggle,
}: {
  cuisine: string;
  isActive: boolean;
  onToggle: (cuisine: string) => void;
}) {
  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      interactive
      active={isActive}
      className="gap-1 cursor-pointer"
      onClick={() => onToggle(cuisine)}
    >
      <Globe className="h-3 w-3" />
      {cuisine}
    </Badge>
  );
}

function TimeBadge({
  label,
  minutes,
  icon,
  isActive,
  onToggle,
}: {
  label: string;
  minutes: number;
  icon: ReactNode;
  isActive: boolean;
  onToggle: (rangeLabel: string) => void;
}) {
  const rangeLabel = getTimeRangeLabel(minutes);
  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      interactive
      active={isActive}
      className="gap-1 cursor-pointer"
      onClick={() => onToggle(rangeLabel)}
    >
      {icon}
      {label}: {formatTime(minutes)}
    </Badge>
  );
}

interface RecipeCardProps {
  recipe: RecipeCardView;
  index: number;
  selectedCuisines: string[];
  selectedPrepTimes: string[];
  selectedTotalTimes: string[];
  onToggleCuisine: (cuisine: string) => void;
  onTogglePrepTime: (rangeLabel: string) => void;
  onToggleTotalTime: (rangeLabel: string) => void;
  dietMatch: DietMatch;
}

// Memoized so that toggling high-cardinality filters that don't affect a card's
// appearance (ingredient, equipment) skips re-rendering all the cards. The
// selected-* arrays and toggle callbacks passed in are kept referentially stable
// by RecipeList, so memo comparison is meaningful.
const RecipeCard = memo(function RecipeCard({
  recipe,
  index,
  selectedCuisines,
  selectedPrepTimes,
  selectedTotalTimes,
  onToggleCuisine,
  onTogglePrepTime,
  onToggleTotalTime,
  dietMatch,
}: RecipeCardProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden rounded-xl border-[1.25px] border-[var(--line-strong)] gap-0 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--paper-shadow)]">
      {recipe.image && (
        <Link href={`/recipes/${recipe.slug}`} className="block">
          <div className="relative w-full h-48 bg-muted overflow-hidden">
            {/* biome-ignore lint/performance/noImgElement: Need native img for srcset control with SSG */}
            <img
              src={getImageUrl(recipe.image, null, {
                width: 400,
                format: "auto",
              })}
              alt={recipe.imageAlt || recipe.title}
              width={400}
              height={192}
              className="w-full h-full object-cover"
              loading={index < 6 ? "eager" : "lazy"}
              fetchPriority={index < 3 ? "high" : "auto"}
            />
          </div>
        </Link>
      )}
      <CardHeader className="pt-4 pb-2 gap-1">
        <Link href={`/recipes/${recipe.slug}`}>
          <CardTitle className="rt-display text-2xl leading-tight hover:text-[var(--terracotta)] transition-colors">
            {recipe.title}
          </CardTitle>
        </Link>
        <CardDescription className="rt-body line-clamp-2">
          {recipe.description}
        </CardDescription>
        <DietWarning match={dietMatch} compact className="mt-2" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.cuisine.map((c) => (
            <CuisineBadge
              key={c}
              cuisine={c}
              isActive={selectedCuisines.includes(c)}
              onToggle={onToggleCuisine}
            />
          ))}
          {recipe.prepTime != null && (
            <TimeBadge
              label="Prep"
              minutes={recipe.prepTime}
              icon={<Timer className="h-3 w-3" />}
              isActive={selectedPrepTimes.includes(
                getTimeRangeLabel(recipe.prepTime),
              )}
              onToggle={onTogglePrepTime}
            />
          )}
          {recipe.totalTime != null && (
            <TimeBadge
              label="Total"
              minutes={recipe.totalTime}
              icon={<Clock className="h-3 w-3" />}
              isActive={selectedTotalTimes.includes(
                getTimeRangeLabel(recipe.totalTime),
              )}
              onToggle={onToggleTotalTime}
            />
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          <time dateTime={recipe.date}>{formatDate(recipe.date)}</time>
        </div>
      </CardContent>
    </Card>
  );
});

type RecipeListProps = Readonly<{
  recipes: RecipeCardView[];
  onDietVisibleCountChange?: (count: number) => void;
}>;

export function RecipeList({
  recipes,
  onDietVisibleCountChange,
}: RecipeListProps) {
  const { diet, matchRecipe } = useDiet();
  const filterParams = useFilterParams({ filters: RECIPE_FILTER_PARAMS });
  const router = useRouter();
  const [showHidden, setShowHidden] = useState(false);
  const dietMatches = useMemo(
    () =>
      buildDietRecipeMatches(recipes, matchRecipe, (recipe) => ({
        ingredients: recipe.ingredientSlugs.map((slug) => ({ slug })),
      })),
    [matchRecipe, recipes],
  );
  const { visibleRecipes, hiddenCount } = useMemo(
    () =>
      applyDietRecipeVisibility(
        recipes,
        dietMatches,
        { active: diet.active, mode: diet.mode },
        { showHidden },
      ),
    [diet.active, diet.mode, dietMatches, recipes, showHidden],
  );
  useLayoutEffect(() => {
    onDietVisibleCountChange?.(visibleRecipes.length);
  }, [onDietVisibleCountChange, visibleRecipes.length]);

  // Derive the selected values from the raw query strings so their array
  // identities stay stable while a given filter is unchanged — this lets the
  // memoized cards skip re-rendering when an unrelated filter toggles.
  const searchParams = useSearchParams();
  const cuisineKey = searchParams.get("cuisine") ?? "";
  const prepKey = searchParams.get("prepTime") ?? "";
  const totalKey = searchParams.get("totalTime") ?? "";
  const searchParamQuery = searchParams.get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(searchParamQuery);
  const pendingUrlSearchRef = useRef<string | null>(null);
  const searchConfig = useMemo(
    () => ({
      ...RECIPE_SEARCH_CONFIG,
      placeholder: `Search ${visibleRecipes.length} recipes…`,
    }),
    [visibleRecipes.length],
  );
  const selectedCuisines = useMemo(
    () => (cuisineKey ? cuisineKey.split(",").filter(Boolean) : []),
    [cuisineKey],
  );
  const selectedPrepTimes = useMemo(
    () => (prepKey ? prepKey.split(",").filter(Boolean) : []),
    [prepKey],
  );
  const selectedTotalTimes = useMemo(
    () => (totalKey ? totalKey.split(",").filter(Boolean) : []),
    [totalKey],
  );

  // Stable toggle callbacks: useFilterParams returns fresh functions each render
  // (they close over searchParams), so route them through a ref to keep the
  // identities passed to the memoized cards constant. The ref is updated in a
  // commit-phase effect (not during render) so it always reflects committed
  // state, even under concurrent rendering.
  const pathname = usePathname();
  const filterParamsRef = useRef(filterParams);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    filterParamsRef.current = filterParams;
    pathnameRef.current = pathname;
  });
  const onToggleCuisine = useCallback(
    (cuisine: string) =>
      cycleFilterFromCard({
        filterParams: filterParamsRef.current,
        paramName: "cuisine",
        value: cuisine,
        label: cuisine,
        page: pathnameRef.current,
      }),
    [],
  );
  const onTogglePrepTime = useCallback(
    (rangeLabel: string) =>
      cycleFilterFromCard({
        filterParams: filterParamsRef.current,
        paramName: "prepTime",
        value: rangeLabel,
        label: `prep ${rangeLabel}`,
        page: pathnameRef.current,
      }),
    [],
  );
  const onToggleTotalTime = useCallback(
    (rangeLabel: string) =>
      cycleFilterFromCard({
        filterParams: filterParamsRef.current,
        paramName: "totalTime",
        value: rangeLabel,
        label: `total ${rangeLabel}`,
        page: pathnameRef.current,
      }),
    [],
  );

  useEffect(() => {
    if (pendingUrlSearchRef.current === searchParamQuery) {
      pendingUrlSearchRef.current = null;
      return;
    }
    setSearchQuery(searchParamQuery);
  }, [searchParamQuery]);

  useEffect(() => {
    if (searchParamQuery === searchQuery) return;
    const id = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchQuery) {
        params.set("q", searchQuery);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      pendingUrlSearchRef.current = searchQuery;
      router.replace(qs ? `/recipes?${qs}` : "/recipes", { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchParamQuery, searchQuery, searchParams, router]);

  return (
    <>
      {diet.active && (
        <DietListNotice
          hiddenCount={hiddenCount}
          labels={diet.labels}
          mode={diet.mode}
          showingHidden={showHidden}
          onToggleHidden={() => setShowHidden((current) => !current)}
        />
      )}
      <FilterableCardGrid
        items={visibleRecipes}
        getItemKey={(recipe) => recipe.slug}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        stackControls
        searchConfig={searchConfig}
        filterConfigs={RECIPE_FILTER_CONFIGS}
        sortConfig={RECIPE_SORT_CONFIG}
        emptyState={RECIPE_EMPTY_STATE}
        itemName="recipes"
        renderCard={(recipe, index) => (
          <RecipeCard
            recipe={recipe}
            index={index}
            selectedCuisines={selectedCuisines}
            selectedPrepTimes={selectedPrepTimes}
            selectedTotalTimes={selectedTotalTimes}
            onToggleCuisine={onToggleCuisine}
            onTogglePrepTime={onTogglePrepTime}
            onToggleTotalTime={onToggleTotalTime}
            dietMatch={dietMatches.get(recipe.slug) ?? MATCHING_DIET_MATCH}
          />
        )}
      />
    </>
  );
}
