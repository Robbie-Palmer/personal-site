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
  discardLegacyPantry: vi.fn(
    (pantry: Pantry): Pantry => ({
      scope: pantry.scope,
      stock: pantry.stock,
    }),
  ),
  getPantryWithLegacyMigration: vi.fn(),
  importLegacyPantry: vi.fn(),
  removePantryItem: vi.fn(),
  replacePantry: vi.fn(),
  restorePantry: vi.fn(),
  session: {
    data: { user: { id: "user-1" } } as { user: { id: string } } | null,
    isPending: false,
  },
  setPantryItem: vi.fn(),
}));

vi.mock("@/lib/api/pantry", () => ({
  discardLegacyPantry: mocks.discardLegacyPantry,
  getPantryWithLegacyMigration: mocks.getPantryWithLegacyMigration,
  importLegacyPantry: mocks.importLegacyPantry,
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
    mocks.getPantryWithLegacyMigration.mockResolvedValue(pantry);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useKitchenStockQuery(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(pantry));
    expect(mocks.getPantryWithLegacyMigration).toHaveBeenCalledWith(
      "user-1",
      expect.any(AbortSignal),
    );
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
    expect(mocks.getPantryWithLegacyMigration).not.toHaveBeenCalled();
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
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
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

  it("can optimistically set stock before the pantry query has loaded", async () => {
    const queryClient = createQueryClient();
    mocks.setPantryItem.mockResolvedValue(personalPantry({ onion: "fresh" }));

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setStockLocation("onion", "fresh"));

    await waitFor(() =>
      expect(mocks.setPantryItem).toHaveBeenCalledWith("onion", "fresh"),
    );
  });

  it("imports or discards an explicitly confirmed legacy pantry", async () => {
    const queryClient = createQueryClient();
    const queryKey = recipeQueryKeys.pantry("user-1");
    const pendingPantry: Pantry = {
      ...personalPantry({}),
      pendingLegacyStock: { onion: "fresh" },
    };
    queryClient.setQueryData(queryKey, pendingPantry);
    mocks.importLegacyPantry.mockResolvedValue(
      personalPantry({ onion: "fresh" }),
    );

    const { result } = renderHook(() => useKitchenStockActions(), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.importLegacyStock());
    await waitFor(() =>
      expect(mocks.importLegacyPantry).toHaveBeenCalledWith("user-1"),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(
        personalPantry({ onion: "fresh" }),
      ),
    );

    queryClient.setQueryData(queryKey, pendingPantry);
    act(() => result.current.discardLegacyStock());
    await waitFor(() =>
      expect(mocks.discardLegacyPantry).toHaveBeenCalledWith(pendingPantry),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)).toEqual(personalPantry({})),
    );
  });
});
