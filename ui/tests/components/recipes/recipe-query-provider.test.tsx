import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeAccountCacheBoundary } from "@/components/recipes/recipe-query-provider";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const authMocks = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user-1" } },
    isPending: false,
  } as {
    data: { user: { id: string } } | null;
    isPending: boolean;
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => authMocks.session,
  },
}));

describe("RecipeAccountCacheBoundary", () => {
  beforeEach(() => {
    authMocks.session = {
      data: { user: { id: "user-1" } },
      isPending: false,
    };
  });

  it("clears the previous account without removing the next account's cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-1"),
      "first",
    );
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-2"),
      "second",
    );
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RecipeAccountCacheBoundary />
      </QueryClientProvider>,
    );

    authMocks.session = {
      data: { user: { id: "user-2" } },
      isPending: false,
    };
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <RecipeAccountCacheBoundary />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-1")),
      ).toBeUndefined();
    });
    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-2")),
    ).toBe("second");
  });
});
