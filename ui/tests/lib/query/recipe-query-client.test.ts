import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import {
  clearOtherPrivateRecipeQueries,
  clearPrivateRecipeQueries,
  shouldRetryRecipeRequest,
} from "@/lib/query/recipe-query-client";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

describe("recipe query policy", () => {
  it("does not retry deterministic or authorization responses", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(
        shouldRetryRecipeRequest(0, new ApiError("request failed", status)),
      ).toBe(false);
    }
  });

  it("bounds retries for transient network and server failures", () => {
    expect(shouldRetryRecipeRequest(0, new ApiError("unavailable", 503))).toBe(
      true,
    );
    expect(shouldRetryRecipeRequest(2, new ApiError("unavailable", 503))).toBe(
      false,
    );
    expect(shouldRetryRecipeRequest(1, new TypeError("offline"))).toBe(true);
    expect(shouldRetryRecipeRequest(2, new TypeError("offline"))).toBe(false);
    expect(
      shouldRetryRecipeRequest(0, new DOMException("aborted", "AbortError")),
    ).toBe(false);
  });

  it("removes one user's private cache without touching another user or public data", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(recipeQueryKeys.publicRecipes(), ["public"]);
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-1"),
      "first",
    );
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-2"),
      "second",
    );

    await clearPrivateRecipeQueries(queryClient, "user-1");

    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-1")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-2")),
    ).toBe("second");
    expect(queryClient.getQueryData(recipeQueryKeys.publicRecipes())).toEqual([
      "public",
    ]);
  });

  it("removes every private query during sign-out", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-1"),
      "first",
    );
    queryClient.setQueryData(recipeQueryKeys.dietProfile("user-2"), "second");

    await clearPrivateRecipeQueries(queryClient);

    expect(
      queryClient.getQueriesData({
        queryKey: recipeQueryKeys.private(),
      }),
    ).toHaveLength(0);
  });

  it("removes private data even when query cancellation fails", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-1"),
      "private",
    );
    vi.spyOn(queryClient, "cancelQueries").mockRejectedValueOnce(
      new Error("cancellation failed"),
    );

    await expect(
      clearPrivateRecipeQueries(queryClient),
    ).resolves.toBeUndefined();

    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-1")),
    ).toBeUndefined();
  });

  it("does not let a stale account cleanup remove the active account", async () => {
    const queryClient = new QueryClient();
    let releaseCancellation: () => void = () => {};
    const cancellation = new Promise<void>((resolve) => {
      releaseCancellation = resolve;
    });
    vi.spyOn(queryClient, "cancelQueries").mockReturnValueOnce(cancellation);
    let currentAccount = true;
    const cleanup = clearOtherPrivateRecipeQueries(
      queryClient,
      "user-1",
      () => currentAccount,
    );

    currentAccount = false;
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-2"),
      "active",
    );
    releaseCancellation();
    await cleanup;

    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-2")),
    ).toBe("active");
  });
});
