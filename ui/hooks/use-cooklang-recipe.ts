"use client";

import type { Parser } from "@cooklang/cooklang";
import { useEffect, useState } from "react";

type ParsedRecipe = ReturnType<Parser["parse"]>["recipe"];

export interface UseCooklangRecipeState {
  recipe: ParsedRecipe | null;
  loading: boolean;
  error: Error | null;
}

let parserPromise: Promise<Parser> | null = null;
const MAX_PARSE_CACHE_SIZE = 50;
const parsePromiseCache = new Map<string, Promise<ParsedRecipe>>();

function getCacheKey(cookBody: string, scale?: number): string {
  return `${scale ?? "default"}::${cookBody}`;
}

async function getParser(): Promise<Parser> {
  if (parserPromise) {
    return parserPromise;
  }

  parserPromise = (async () => {
    try {
      const module = await import("@cooklang/cooklang");
      return new module.Parser();
    } catch (error) {
      parserPromise = null;
      throw error;
    }
  })();

  return parserPromise;
}

function getMemoizedParsePromise(
  cookBody: string,
  scale?: number,
): Promise<ParsedRecipe> {
  const cacheKey = getCacheKey(cookBody, scale);
  const existingPromise = parsePromiseCache.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const parsePromise = (async () => {
    try {
      const parser = await getParser();
      const { recipe } = parser.parse(cookBody, scale);
      return recipe;
    } catch (error) {
      parsePromiseCache.delete(cacheKey);
      throw error;
    }
  })();

  parsePromiseCache.set(cacheKey, parsePromise);
  if (parsePromiseCache.size > MAX_PARSE_CACHE_SIZE) {
    parsePromiseCache.delete(parsePromiseCache.keys().next().value!);
  }
  return parsePromise;
}

export function useCooklangRecipe(
  cookBody: string,
  scale?: number,
): UseCooklangRecipeState {
  const [state, setState] = useState<UseCooklangRecipeState>({
    recipe: null,
    loading: Boolean(cookBody),
    error: null,
  });

  useEffect(() => {
    if (!cookBody) {
      setState({ recipe: null, loading: false, error: null });
      return;
    }

    let isActive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const recipe = await getMemoizedParsePromise(cookBody, scale);
        if (!isActive) {
          return;
        }

        setState({ recipe, loading: false, error: null });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          recipe: null,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error("Failed to parse Cooklang recipe"),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [cookBody, scale]);

  return state;
}
