"use client";

import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DietListNotice } from "@/components/recipes/diet-notice";
import { useDiet } from "@/components/recipes/diet-provider";
import { MealPlanner } from "@/components/recipes/shopping/meal-planner";
import { RecipePicker } from "@/components/recipes/shopping/recipe-picker";
import { ShoppingList } from "@/components/recipes/shopping/shopping-list";
import { useShoppingList } from "@/hooks/use-shopping-list";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import { clearList } from "@/lib/shopping/shoppingListStore";

type Step = "plan" | "list";

const STEPS: { id: Step; label: string }[] = [
  { id: "plan", label: "1 · Plan the week" },
  { id: "list", label: "2 · Shopping list" },
];

export function ShoppingView({ recipes }: { recipes: ShoppingRecipe[] }) {
  const { diet, matchRecipe } = useDiet();
  const { recipes: selected, plan, extras } = useShoppingList();
  const [step, setStep] = useState<Step>("plan");
  const [showHidden, setShowHidden] = useState(false);
  const selectedSlugs = useMemo(
    () => new Set(selected.map((entry) => entry.slug)),
    [selected],
  );
  const dietMatches = useMemo(
    () =>
      new Map(
        recipes.map((recipe) => [
          recipe.slug,
          matchRecipe({
            ingredients: recipe.ingredients.map((ingredient) => ({
              slug: ingredient.ingredient,
              name: ingredient.name,
            })),
          }),
        ]),
      ),
    [matchRecipe, recipes],
  );
  const hiddenCount = Array.from(dietMatches.values()).filter(
    (match) => !match.matches,
  ).length;
  const availableRecipes = useMemo(
    () =>
      diet.active && diet.mode === "hide" && !showHidden
        ? recipes.filter((recipe) => dietMatches.get(recipe.slug)?.matches)
        : recipes,
    [diet.active, diet.mode, dietMatches, recipes, showHidden],
  );
  const pickerRecipes = useMemo(
    () =>
      recipes.filter(
        (recipe) =>
          availableRecipes.includes(recipe) || selectedSlugs.has(recipe.slug),
      ),
    [availableRecipes, recipes, selectedSlugs],
  );
  const count = selected.length;
  const recipeNoun = count === 1 ? "recipe" : "recipes";
  const plannedCount = plan.length;
  const plannedNoun = plannedCount === 1 ? "meal" : "meals";
  const extraNoun = extras.length === 1 ? "extra item" : "extra items";
  const hasListContent = count > 0 || plannedCount > 0 || extras.length > 0;
  let summary =
    "Plan meals for the week or choose recipes directly and we'll build the list.";
  if (count > 0) {
    summary = `${count} ${recipeNoun} selected · ${plannedCount} ${plannedNoun} scheduled.`;
  } else if (plannedCount > 0) {
    summary = `${plannedCount} ${plannedNoun} scheduled.`;
  } else if (extras.length > 0) {
    summary = `${extras.length} ${extraNoun} on the shopping list.`;
  }

  return (
    <div className="container mx-auto px-4 pt-5 pb-16 md:pt-7 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="rt-mono text-[var(--terracotta)]">
            Shopping · weekly plan
          </p>
          <h1 className="rt-display text-5xl md:text-6xl mt-2">
            {step === "plan" ? "What's the plan?" : "Shopping list."}
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">{summary}</p>
        </div>
        {hasListContent && (
          <button
            type="button"
            onClick={() => {
              clearList();
              setStep("plan");
            }}
            className="inline-flex items-center gap-1.5 rt-mono text-[var(--ink-3)] hover:text-[var(--berry)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> clear list
          </button>
        )}
      </div>

      {diet.active && (
        <DietListNotice
          hiddenCount={hiddenCount}
          labels={diet.labels}
          mode={diet.mode}
          showingHidden={showHidden}
          onToggleHidden={() => setShowHidden((current) => !current)}
        />
      )}

      {/* Step tabs — mirror the recipe read-view tabs so the two feel of a piece. */}
      <div className="flex items-center border-b border-[var(--line)] mb-6">
        {STEPS.map((s) => {
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={[
                "px-3.5 py-2.5 rt-body text-[0.95rem] -mb-px border-b-2 transition-colors",
                active
                  ? "border-[var(--terracotta)] text-[var(--ink)] font-bold"
                  : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {step === "plan" ? (
        <div className="space-y-8">
          <MealPlanner recipes={recipes} availableRecipes={availableRecipes} />
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="rt-mono text-[var(--terracotta)]">
                  Recipe picker
                </p>
                <h2 className="rt-display text-3xl text-[var(--ink)]">
                  Add anything else.
                </h2>
              </div>
              <p className="rt-body text-sm text-[var(--ink-3)]">
                Selected recipes appear in the plan pool and shopping list.
              </p>
            </div>
            <RecipePicker recipes={pickerRecipes} dietMatches={dietMatches} />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setStep("list")}
              disabled={!hasListContent}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--terracotta)] px-4 py-2 text-white font-medium hover:bg-[var(--terracotta-deep)] disabled:opacity-40 disabled:hover:bg-[var(--terracotta)] transition-colors"
            >
              View shopping list
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setStep("plan")}
            className="inline-flex items-center gap-1.5 rt-mono text-[var(--ink-3)] hover:text-[var(--terracotta)] mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> back to plan
          </button>
          <ShoppingList recipes={recipes} />
        </div>
      )}
    </div>
  );
}
