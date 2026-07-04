"use client";

import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { RecipePicker } from "@/components/recipes/shopping/recipe-picker";
import { ShoppingList } from "@/components/recipes/shopping/shopping-list";
import { useShoppingList } from "@/hooks/use-shopping-list";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import { clearList } from "@/lib/shopping/shoppingListStore";

type Step = "pick" | "list";

const STEPS: { id: Step; label: string }[] = [
  { id: "pick", label: "1 · Pick recipes" },
  { id: "list", label: "2 · Shopping list" },
];

export function ShoppingView({ recipes }: { recipes: ShoppingRecipe[] }) {
  const { recipes: selected } = useShoppingList();
  const [step, setStep] = useState<Step>("pick");
  const count = selected.length;
  const recipeNoun = count === 1 ? "recipe" : "recipes";

  return (
    <div className="container mx-auto px-4 pt-5 pb-16 md:pt-7 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="rt-mono text-[var(--terracotta)]">Shopping</p>
          <h1 className="rt-display text-5xl md:text-6xl mt-2">
            {step === "pick" ? "What are you cooking?" : "Shopping list."}
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            {count === 0
              ? "Choose the recipes you want to cook and we'll build the list."
              : `${count} ${recipeNoun} selected.`}
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => {
              clearList();
              setStep("pick");
            }}
            className="inline-flex items-center gap-1.5 rt-mono text-[var(--ink-3)] hover:text-[var(--berry)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> clear list
          </button>
        )}
      </div>

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

      {step === "pick" ? (
        <div>
          <RecipePicker recipes={recipes} />
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setStep("list")}
              disabled={count === 0}
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
            onClick={() => setStep("pick")}
            className="inline-flex items-center gap-1.5 rt-mono text-[var(--ink-3)] hover:text-[var(--terracotta)] mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> back to recipes
          </button>
          <ShoppingList recipes={recipes} />
        </div>
      )}
    </div>
  );
}
