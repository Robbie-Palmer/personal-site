import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecipeAccountCacheBoundary,
  RecipeQueryProvider,
} from "@/components/recipes/recipe-query-provider";
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

  it("keeps only the current account's private cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-1"),
      "first",
    );
    queryClient.setQueryData(
      recipeQueryKeys.recipeBoxRecipes("user-2"),
      "second",
    );
    queryClient.setQueryData(recipeQueryKeys.publicRecipes(), "public");
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RecipeAccountCacheBoundary />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-2")),
      ).toBeUndefined();
    });
    expect(
      queryClient.getQueryData(recipeQueryKeys.recipeBoxRecipes("user-1")),
    ).toBe("first");
    expect(queryClient.getQueryData(recipeQueryKeys.publicRecipes())).toBe(
      "public",
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
    expect(queryClient.getQueryData(recipeQueryKeys.publicRecipes())).toBe(
      "public",
    );
  });

  it("retains the browser cache when the recipe layout remounts", () => {
    let firstClient: QueryClient | undefined;
    let secondClient: QueryClient | undefined;

    function FirstProbe() {
      firstClient = useQueryClient();
      return null;
    }

    function SecondProbe() {
      secondClient = useQueryClient();
      return null;
    }

    const firstView = render(
      <RecipeQueryProvider>
        <FirstProbe />
      </RecipeQueryProvider>,
    );
    firstClient?.setQueryData(recipeQueryKeys.publicRecipes(), "cached");
    firstView.unmount();

    render(
      <RecipeQueryProvider>
        <SecondProbe />
      </RecipeQueryProvider>,
    );

    expect(secondClient).toBe(firstClient);
    expect(secondClient?.getQueryData(recipeQueryKeys.publicRecipes())).toBe(
      "cached",
    );
  });
});
