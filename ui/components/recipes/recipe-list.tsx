"use client";

import { Tag, UtensilsCrossed } from "lucide-react";
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
import type { RecipeDetailView } from "@/lib/api/recipes";
import { formatDate } from "@/lib/generic/date";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

interface RecipeListProps {
  recipes: RecipeDetailView[];
}

export function RecipeList({ recipes }: RecipeListProps) {
  const filterParams = useFilterParams({
    filters: [{ paramName: "tags", isMulti: true }],
  });
  const selectedTags = filterParams.getValues("tags");

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
          { name: "tags", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.1,
      }}
      filterConfigs={[
        {
          paramName: "tags",
          isMulti: true,
          label: "Tags",
          getItemValues: (recipe) => recipe.tags,
          icon: <Tag className="h-4 w-4" />,
          getValueLabel: (value) => value,
          getOptionIcon: () => <Tag className="h-3 w-3" />,
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
              {recipe.tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isActive ? "default" : "secondary"}
                    interactive
                    active={isActive}
                    className="gap-1 cursor-pointer"
                    onClick={() => filterParams.toggleValue("tags", tag)}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                );
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              <time>{formatDate(recipe.date)}</time>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
