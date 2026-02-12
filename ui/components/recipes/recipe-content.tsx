"use client";

import { Clock, Minus, Plus, Timer, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  IngredientGroupView,
  RecipeDetailView,
  RecipeIngredientView,
} from "@/lib/domain/recipe";
import { UNIT_LABELS } from "@/lib/domain/recipe";

function formatAmount(item: RecipeIngredientView, scale: number): string {
  const parts: string[] = [];

  if (item.amount != null) {
    const scaled = item.amount * scale;
    const display = Number.isInteger(scaled)
      ? scaled.toString()
      : parseFloat(scaled.toFixed(2)).toString();
    parts.push(display);
  }

  if (item.unit) {
    const labels = UNIT_LABELS[item.unit];
    if (labels) {
      const scaledAmount =
        item.amount != null ? item.amount * scale : undefined;
      const label =
        scaledAmount != null && scaledAmount !== 1
          ? labels.plural
          : labels.singular;
      if (label) {
        if (labels.noSpace && parts.length > 0) {
          parts[parts.length - 1] += label;
        } else {
          parts.push(label);
        }
      }
    }
  }

  return parts.join(" ");
}

function pluralizeName(item: RecipeIngredientView): string {
  if (item.pluralName) return item.pluralName;
  return `${item.name}s`;
}

function formatIngredient(item: RecipeIngredientView, scale: number): string {
  const isPiece = item.unit === "piece";
  const amount = isPiece
    ? item.amount != null
      ? (item.amount * scale).toString()
      : ""
    : formatAmount(item, scale);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
    if (item.unit && !isPiece) {
      parts.push("of");
    }
  }

  const scaledAmount = item.amount != null ? item.amount * scale : undefined;
  const needsPlural = isPiece && scaledAmount != null && scaledAmount !== 1;
  parts.push(needsPlural ? pluralizeName(item) : item.name);

  if (item.preparation) {
    parts.push(`(${item.preparation})`);
  }

  if (item.note) {
    parts.push(`\u2013 ${item.note}`);
  }

  return parts.join(" ");
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function IngredientGroup({
  group,
  scale,
}: {
  group: IngredientGroupView;
  scale: number;
}) {
  return (
    <div>
      {group.name && (
        <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
      )}
      <ul className="space-y-1">
        {group.items.map((item) => (
          <li key={item.ingredient} className="flex items-start gap-2">
            <span className="text-muted-foreground mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
            <span>{formatIngredient(item, scale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecipeContent({ recipe }: { recipe: RecipeDetailView }) {
  const [portions, setPortions] = useState(recipe.servings);
  const scale = portions / recipe.servings;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {recipe.description}
        </p>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPortions((p) => Math.max(1, p - 1))}
                disabled={portions <= 1}
                aria-label="Decrease portions"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[4ch] text-center tabular-nums">
                {portions} {portions === 1 ? "serving" : "servings"}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPortions((p) => p + 1)}
                aria-label="Increase portions"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {recipe.prepTime != null && (
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>Prep: {formatTime(recipe.prepTime)}</span>
            </div>
          )}
          {recipe.cookTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Cook: {formatTime(recipe.cookTime)}</span>
            </div>
          )}
          {recipe.totalTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Total: {formatTime(recipe.totalTime)}</span>
            </div>
          )}
        </div>

        {recipe.cuisine && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="secondary">{recipe.cuisine}</Badge>
          </div>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Ingredients</h2>
        <div className="space-y-4">
          {recipe.ingredientGroups.map((group, i) => (
            <IngredientGroup
              key={group.name ?? i}
              group={group}
              scale={scale}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Instructions</h2>
        <ol className="space-y-3 list-decimal list-inside">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="leading-relaxed pl-2">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
