"use client";

import { Clock, Globe, Leaf, Timer, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterableCardGrid } from "@/components/ui/filterable-card-grid";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { RecipeCardView } from "@/lib/api/recipes";
import { formatDate } from "@/lib/generic/date";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

const TIME_RANGES = [
  { label: "Under 15 min", max: 14 },
  { label: "15–30 min", min: 15, max: 30 },
  { label: "30–60 min", min: 31, max: 60 },
  { label: "Over 60 min", min: 61 },
] as const;

function getTimeRangeLabel(minutes: number): string {
  for (const range of TIME_RANGES) {
    const aboveMin = !("min" in range) || minutes >= range.min;
    const belowMax = !("max" in range) || minutes <= range.max;
    if (aboveMin && belowMax) return range.label;
  }
  // Fallback to last range (should never reach here given the ranges cover all values)
  return TIME_RANGES[TIME_RANGES.length - 1]!.label;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface RecipeListProps {
  recipes: RecipeCardView[];
}

export function RecipeList({ recipes }: RecipeListProps) {
  const filterParams = useFilterParams({
    filters: [
      { paramName: "cuisine", isMulti: true },
      { paramName: "ingredient", isMulti: true },
      { paramName: "prepTime", isMulti: true },
      { paramName: "totalTime", isMulti: true },
    ],
  });
  const selectedCuisines = filterParams.getValues("cuisine");

  return (
    <FilterableCardGrid
      items={recipes}
      getItemKey={(recipe) => recipe.slug}
      searchConfig={{
        placeholder: "Search recipes...",
        ariaLabel: "Search recipes",
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "cuisine", weight: 2 },
          { name: "ingredientNames", weight: 1 },
        ],
        threshold: 0.1,
      }}
      filterConfigs={[
        {
          paramName: "cuisine",
          isMulti: true,
          label: "Cuisines",
          getItemValues: (recipe) => (recipe.cuisine ? [recipe.cuisine] : []),
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
            recipe.totalTime != null
              ? [getTimeRangeLabel(recipe.totalTime)]
              : [],
          icon: <Clock className="h-4 w-4" />,
          getOptionIcon: () => <Clock className="h-3 w-3" />,
        },
      ]}
      sortConfig={{
        getDate: (recipe) => recipe.date,
      }}
      emptyState={{
        icon: (
          <UtensilsCrossed className="w-10 h-10 text-muted-foreground/50" />
        ),
        message: "No recipes found matching your criteria.",
      }}
      itemName="recipes"
      renderCard={(recipe, index) => (
        <Card className="h-full flex flex-col overflow-hidden">
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
          <CardHeader>
            <Link href={`/recipes/${recipe.slug}`}>
              <CardTitle className="hover:text-primary transition-colors">
                {recipe.title}
              </CardTitle>
            </Link>
            <CardDescription>{recipe.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="flex flex-wrap gap-2 mb-3">
              {recipe.cuisine && (
                <Badge
                  variant={
                    selectedCuisines.includes(recipe.cuisine)
                      ? "default"
                      : "secondary"
                  }
                  interactive
                  active={selectedCuisines.includes(recipe.cuisine)}
                  className="gap-1 cursor-pointer"
                  onClick={() =>
                    filterParams.toggleValue("cuisine", recipe.cuisine!)
                  }
                >
                  <Globe className="h-3 w-3" />
                  {recipe.cuisine}
                </Badge>
              )}
              {recipe.prepTime != null && (
                <Badge variant="outline" className="gap-1">
                  <Timer className="h-3 w-3" />
                  Prep: {formatTime(recipe.prepTime)}
                </Badge>
              )}
              {recipe.totalTime != null && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Total: {formatTime(recipe.totalTime)}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <time dateTime={recipe.date}>{formatDate(recipe.date)}</time>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
