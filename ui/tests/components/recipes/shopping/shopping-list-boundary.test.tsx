import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShoppingListBoundary,
  useStartNewShoppingList,
} from "@/components/recipes/shopping/shopping-list-boundary";
import {
  __resetShoppingListForTests,
  addExtra,
  getShoppingListSnapshot,
  setPlannedMeal,
} from "@/lib/shopping/shoppingListStore";

const mocks = vi.hoisted(() => ({
  getCurrentShoppingList: vi.fn(),
  saveCurrentShoppingList: vi.fn(),
  startNewShoppingList: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "user-1" } },
      isPending: false,
    }),
  },
}));

vi.mock("@/lib/api/shopping-lists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/shopping-lists")>()),
  getCurrentShoppingList: mocks.getCurrentShoppingList,
  saveCurrentShoppingList: mocks.saveCurrentShoppingList,
  startNewShoppingList: mocks.startNewShoppingList,
}));

const emptySnapshot = { recipes: [], checked: [], extras: [] };
const storedList = {
  id: "00000000-0000-4000-8000-000000000080",
  resourceId: "user-1",
  revision: "0",
  scope: { type: "personal" as const },
  snapshot: emptySnapshot,
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T08:00:00.000Z",
};

function renderWithQueryClient(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function StartNewButton() {
  const startNew = useStartNewShoppingList();
  return (
    <button type="button" onClick={() => startNew.mutate()}>
      Start new
    </button>
  );
}

describe("ShoppingListBoundary", () => {
  beforeEach(() => {
    __resetShoppingListForTests();
    localStorage.clear();
    vi.clearAllMocks();
    mocks.getCurrentShoppingList.mockResolvedValue(storedList);
    mocks.saveCurrentShoppingList.mockResolvedValue(storedList);
    mocks.startNewShoppingList.mockResolvedValue({
      ...storedList,
      id: "00000000-0000-4000-8000-000000000081",
    });
  });

  it("installs the server list, keeps the local meal plan separate, and saves edits", async () => {
    setPlannedMeal("fri", "dinner", "tomato-soup");
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );

    expect(await screen.findByText("List ready")).toBeInTheDocument();
    expect(getShoppingListSnapshot().plan).toEqual([
      { day: "fri", slot: "dinner", slug: "tomato-soup" },
    ]);

    act(() => addExtra("Milk"));
    await waitFor(
      () =>
        expect(mocks.saveCurrentShoppingList).toHaveBeenCalledWith(
          storedList.id,
          storedList.revision,
          expect.objectContaining({
            extras: [expect.objectContaining({ text: "Milk" })],
          }),
        ),
      { timeout: 1_000 },
    );
    expect(mocks.saveCurrentShoppingList.mock.calls[0]?.[2]).not.toHaveProperty(
      "plan",
    );
  });

  it("archives the loaded list before clearing the optimistic store", async () => {
    renderWithQueryClient(
      <ShoppingListBoundary>
        <StartNewButton />
      </ShoppingListBoundary>,
    );
    await screen.findByRole("button", { name: "Start new" });
    act(() => addExtra("Milk"));

    fireEvent.click(screen.getByRole("button", { name: "Start new" }));

    await waitFor(() =>
      expect(mocks.startNewShoppingList).toHaveBeenCalledWith(
        storedList.id,
        storedList.revision,
        expect.objectContaining({
          extras: [expect.objectContaining({ text: "Milk" })],
        }),
      ),
    );
    await waitFor(() =>
      expect(getShoppingListSnapshot()).toEqual({
        recipes: [],
        plan: [],
        checked: [],
        extras: [],
      }),
    );
  });

  it("does not overwrite local edits when the loaded list refetches", async () => {
    const { queryClient } = renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");

    act(() => addExtra("Milk"));
    act(() => {
      queryClient.setQueryData(
        ["recipes", "private", "user-1", "shopping-list"],
        { ...storedList, revision: "1" },
      );
    });

    expect(getShoppingListSnapshot().extras).toEqual([
      expect.objectContaining({ text: "Milk" }),
    ]);
  });

  it("shows a load error instead of an editable local list", async () => {
    mocks.getCurrentShoppingList.mockRejectedValue(new Error("offline"));

    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );

    expect(
      await screen.findByText("Your shopping list could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.queryByText("List ready")).not.toBeInTheDocument();
  });
});
