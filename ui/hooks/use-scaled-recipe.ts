"use client";

import { useEffect, useMemo, useState } from "react";
import { useCooklangRecipe } from "@/hooks/use-cooklang-recipe";
import type { ScaledRecipeParts } from "@/lib/domain/recipe/cooklangTransform";
import type {
  IngredientGroupView,
  RecipeDetailView,
} from "@/lib/domain/recipe/recipeViews";

export interface UseScaledRecipeState {
  view: RecipeDetailView;
  /** 1 when the returned view's amounts are already scaled by cooklang-rs;
   * the requested scale when caller is responsible for multiplying. */
  scaleMultiplier: number;
  isScaling: boolean;
  error: Error | null;
}

type TransformModule = typeof import("@/lib/domain/recipe/cooklangTransform");

let transformModulePromise: Promise<TransformModule> | null = null;
function loadTransformModule(): Promise<TransformModule> {
  if (!transformModulePromise) {
    transformModulePromise = import(
      "@/lib/domain/recipe/cooklangTransform"
    ).catch((error) => {
      transformModulePromise = null;
      throw error;
    });
  }
  return transformModulePromise;
}

function reconstructAnnotations(
  ingredientGroups: IngredientGroupView[],
): Record<string, { preparation?: string; note?: string }> {
  const annotations: Record<string, { preparation?: string; note?: string }> =
    {};
  for (const group of ingredientGroups) {
    for (const item of group.items) {
      if (item.preparation || item.note) {
        annotations[item.ingredient] = {
          preparation: item.preparation,
          note: item.note,
        };
      }
    }
  }
  return annotations;
}

function overlayScaledParts(
  base: RecipeDetailView,
  parts: ScaledRecipeParts,
): RecipeDetailView {
  const viewItemBySlug = new Map<
    string,
    IngredientGroupView["items"][number]
  >();
  for (const group of base.ingredientGroups) {
    for (const item of group.items) {
      viewItemBySlug.set(item.ingredient, item);
    }
  }

  return {
    ...base,
    cookware: parts.cookware,
    ingredientGroups: parts.ingredientGroups.map((group) => ({
      name: group.name,
      items: group.items.map((item) => {
        const viewItem = viewItemBySlug.get(item.ingredient);
        return {
          ingredient: item.ingredient,
          name: viewItem?.name ?? item.ingredient,
          pluralName: viewItem?.pluralName,
          category: viewItem?.category,
          amount: item.amount,
          unit: item.unit,
          preparation: item.preparation,
          note: item.note,
        };
      }),
    })),
    instructions: parts.instructions,
    instructionSdk: parts.instructionSdk,
  };
}

export function useScaledRecipe(
  view: RecipeDetailView,
  scale: number,
): UseScaledRecipeState {
  const isIdentity = scale === 1;
  const {
    recipe: parsedRecipe,
    loading,
    error,
  } = useCooklangRecipe(
    isIdentity ? "" : view.cookBody,
    isIdentity ? undefined : scale,
  );

  const annotations = useMemo(
    () => reconstructAnnotations(view.ingredientGroups),
    [view.ingredientGroups],
  );

  const [scaledParts, setScaledParts] = useState<ScaledRecipeParts | null>(
    null,
  );
  const [transformError, setTransformError] = useState<Error | null>(null);

  useEffect(() => {
    if (isIdentity || !parsedRecipe) {
      setScaledParts(null);
      return;
    }

    let isActive = true;
    loadTransformModule()
      .then(({ buildScaledRecipeParts }) => {
        if (!isActive) return;
        setScaledParts(buildScaledRecipeParts(parsedRecipe, annotations));
        setTransformError(null);
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        setTransformError(
          err instanceof Error
            ? err
            : new Error("Failed to load cooklang transform"),
        );
        setScaledParts(null);
      });

    return () => {
      isActive = false;
    };
  }, [isIdentity, parsedRecipe, annotations]);

  const scaledView = useMemo(
    () => (scaledParts ? overlayScaledParts(view, scaledParts) : null),
    [scaledParts, view],
  );

  if (isIdentity) {
    return { view, scaleMultiplier: 1, isScaling: false, error: null };
  }

  if (scaledView) {
    return {
      view: scaledView,
      scaleMultiplier: 1,
      isScaling: loading,
      error: error ?? transformError,
    };
  }

  return {
    view,
    scaleMultiplier: scale,
    isScaling: loading || (parsedRecipe !== null && scaledParts === null),
    error: error ?? transformError,
  };
}
