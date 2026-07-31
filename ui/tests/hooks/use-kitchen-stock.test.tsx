import {
  QueryClient,
  QueryClientProvider,
  type QueryClientProviderProps,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useKitchenStock,
  useKitchenStockActions,
  useKitchenStockQuery,
} from "@/hooks/use-kitchen-stock";
import type { Pantry } from "@/lib/api/pantry";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const mocks = vi.hoisted(() => ({
  captureRecipeProductActivity: vi.fn(),
  getPantry: vi.fn(),
  removePantryItem: vi.fn(),
  replacePantry: vi.fn(),
  restorePantry: vi.fn(),
  session: {
    data: { user: { id: "user-1" } } as { user: { id: string } } | null,
    isPending: false,
  },
  setPantryItem: vi.fn(),
}));

vi.mock("@/lib/analytics/recipe-product", () => ({
  captureRecipeProductActivity: mocks.captureRecipeProductActivity,
}));

vi.mock("@/lib/api/pantry", () => ({
  getPantry: mocks.getPantry,
  removePantryItem: mocks.removePantryItem,
  replacePantry: mocks.replacePantry,
  restorePantry: mocks.restorePantry,
  setPantryItem: mocks.setPantryItem,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mocks.session,
  },
}));

const personalPantry = (stock: Pantry["stock"]): Pantry => ({
  scope: { type: "personal" },
  stock,
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({
    children,
  }: Readonly<Pick<QueryClientProviderProps, "children">>) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useKitchenStockQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.data = { user: { id: "user-1" } };
    mocks.session.isPending = false;
  });

  it("loads persisted pantry stock for the signed-in user", async () => {
    const pantry = personalPantry({ onion: "fresh" });
    mocks.getPantry.mockResolvedValue(pantry);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useKitchenStockQuery(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(pantry));
    expect(mocks.getPantry).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("stays disabled while the session is pending", () => {
    mocks.session.data = null;
    mocks.session.isPending = true;
    const queryClient = createQueryClient();

    const query = renderHook(() => useKitchenStockQuery(), {
      wrapper: wrapper(queryClient),
    });
    const stock = renderHook(() => useKitchenStock(), {
      wrapper: wrapper(queryClient),
    });

    expect(query.result.current.fetchStatus).toBe("idle");
    expect(stock.result.current).toEqual({});
    expect(mocks.getPantry).not.toHaveBeenCalled();
  });
});

describe("useKitchenStockActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.data = { user: { id: "user-1" } };
    mocks.session.isPending = false;
  });

  it("sets, removes, replaces, and clears stock in sequence", async () => {
    const queryClient = createQueryClient();
    const queryKey = recipeQueryKeys.pantry("user-1");
    queryClient.setQueryData(queryKey, personalPantry({ milk: "fridge" }));
    mocks.setPantryItem.mockResolvedValue(
      personalPantry({ milk: "fridge", onion: "fresh" }),
    );
    mocks.removePantryItem.mockResolvedValue(
      personalPantry({ onion: "fresh" }),
    );
    mocks.replacePantry
      .mockResolvedValueOnce(personalPantry({ egg: "cupboards" }))
      .mockResolvedValueOnce(personalPantry({}));
    mocks.restorePantry.mockResolvedValue(
      personalPantry({ milk: "fridge", onion: "fresh" }),
    );

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setStockLocation("onion", "fresh"));
    await waitFor(() =>
      expect(mocks.setPantryItem).toHaveBeenCalledWith("onion", "fresh"),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ milk: "fridge", onion: "fresh" }),
      ),
    );
    expect(mocks.captureRecipeProductActivity).toHaveBeenCalledWith(
      "kitchen_ingredient_added",
      {
        ingredient_slug: "onion",
        kitchen_location: "fresh",
        stocked_ingredient_count: 2,
      },
    );

    act(() => result.current.removeFromStock("milk"));
    await waitFor(() =>
      expect(mocks.removePantryItem).toHaveBeenCalledWith("milk"),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ onion: "fresh" }),
      ),
    );

    act(() => result.current.replaceStock({ egg: "cupboards" }));
    await waitFor(() =>
      expect(mocks.replacePantry).toHaveBeenCalledWith({
        egg: "cupboards",
      }),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ egg: "cupboards" }),
      ),
    );

    act(() => result.current.clearStock());
    await waitFor(() => expect(mocks.replacePantry).toHaveBeenCalledWith({}));
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(personalPantry({})),
    );

    act(() =>
      result.current.restoreStock({
        milk: "fridge",
        onion: "fresh",
      }),
    );
    await waitFor(() =>
      expect(mocks.restorePantry).toHaveBeenCalledWith({
        milk: "fridge",
        onion: "fresh",
      }),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ milk: "fridge", onion: "fresh" }),
      ),
    );
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.isPending).toBe(false);
    });
  });

  it("rolls an optimistic update back when persistence fails", async () => {
    const queryClient = createQueryClient();
    const queryKey = recipeQueryKeys.pantry("user-1");
    const original = personalPantry({ milk: "fridge" });
    queryClient.setQueryData(queryKey, original);
    mocks.setPantryItem.mockRejectedValue(new Error("network unavailable"));

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setStockLocation("onion", "fresh"));

    await waitFor(() =>
      expect(result.current.error).toEqual(new Error("network unavailable")),
    );
    expect(queryClient.getQueryData(queryKey)).toEqual(original);
  });

  it("bases optimistic removal on the cache after pending queries are cancelled", async () => {
    const queryClient = createQueryClient();
    const queryKey = recipeQueryKeys.pantry("user-1");
    queryClient.setQueryData(
      queryKey,
      personalPantry({ milk: "fridge", onion: "fresh" }),
    );
    vi.spyOn(queryClient, "cancelQueries").mockImplementation(async () => {
      queryClient.setQueryData(
        queryKey,
        personalPantry({
          egg: "cupboards",
          milk: "fridge",
          onion: "fresh",
        }),
      );
    });
    let resolveRemoval: ((pantry: Pantry) => void) | undefined;
    mocks.removePantryItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemoval = resolve;
        }),
    );

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.removeFromStock("milk"));

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ egg: "cupboards", onion: "fresh" }),
      ),
    );

    act(() =>
      resolveRemoval?.(personalPantry({ egg: "cupboards", onion: "fresh" })),
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("can optimistically set stock before the pantry query has loaded", async () => {
    const queryClient = createQueryClient();
    const queryKey = recipeQueryKeys.pantry("user-1");
    mocks.setPantryItem.mockResolvedValue(personalPantry({ onion: "fresh" }));

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setStockLocation("onion", "fresh"));

    await waitFor(() =>
      expect(mocks.setPantryItem).toHaveBeenCalledWith("onion", "fresh"),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ onion: "fresh" }),
      ),
    );
  });
});
