"use client";

import { Leaf, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { DietMatch } from "@/lib/domain/diet";
import { cn } from "@/lib/generic/styles";

export function DietListNotice({
  hiddenCount,
  labels,
  mode,
  showingHidden,
  onToggleHidden,
}: Readonly<{
  hiddenCount: number;
  labels: string[];
  mode: "hide" | "warn";
  showingHidden: boolean;
  onToggleHidden?: () => void;
}>) {
  const summary =
    labels.length > 0 ? labels.join(", ") : "your saved exclusions";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--sage)] bg-[var(--sage)]/10 px-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--sage)] text-white">
        <Leaf className="size-3.5" />
      </span>
      <p className="rt-body min-w-0 flex-1 text-sm text-[var(--ink-2)]">
        <b className="text-[var(--ink)]">Your diet</b> · {summary}.{" "}
        <span className="text-[var(--ink-3)]">
          {mode === "hide"
            ? hiddenCount === 0
              ? "No recipes hidden."
              : `${hiddenCount} ${hiddenCount === 1 ? "recipe" : "recipes"} hidden.`
            : "Recipes that don't match are marked with a warning."}
        </span>
      </p>
      <Link
        href="/recipes/settings?section=diet"
        className="rt-mono text-[var(--sage)] hover:underline"
      >
        edit diet →
      </Link>
      {mode === "hide" && hiddenCount > 0 && onToggleHidden && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="rt-mono text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          {showingHidden ? "respect diet" : "show anyway"}
        </button>
      )}
    </div>
  );
}

export function DietWarning({
  match,
  compact = false,
  className,
}: Readonly<{
  match: DietMatch;
  compact?: boolean;
  className?: string;
}>) {
  if (match.matches) return null;
  const names = match.excludedIngredients.map((ingredient) => ingredient.name);
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-[var(--butter)] bg-[var(--butter-soft)] text-[var(--terracotta-deep)]",
        compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        className,
      )}
    >
      <TriangleAlert
        className={cn("shrink-0", compact ? "size-3.5" : "size-4")}
      />
      <span className="rt-body leading-tight">
        Doesn't match your diet: {names.join(", ")}.
      </span>
    </div>
  );
}
