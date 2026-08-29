import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShoppingListBoundary,
  useStartNewShoppingList,
} from "@/components/recipes/shopping/shopping-list-boundary";
import { ApiError } from "@/lib/api/http";
import type { StoredShoppingList } from "@/lib/api/shopping-lists";
import {
  __resetShoppingListForTests,
  addExtra,
  getShoppingListSnapshot,
  setPlannedMeal,
  toggleChecked,
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
    <button type="button" onClick={startNew.start}>
      Start new
    </button>
  );
}

let statefulChildMounts = 0;

function StatefulStartNewButton() {
  const startNew = useStartNewShoppingList();
  const [view, setView] = useState("plan");
  const [mountNumber] = useState(() => {
    statefulChildMounts += 1;
    return statefulChildMounts;
  });
  return (
    <div>
      <p data-testid="current-view" data-mount={mountNumber}>
        Current view: {view}
      </p>
      <button type="button" onClick={() => setView("list")}>
        Show list
      </button>
      <button type="button" onClick={startNew.start}>
        Start new
      </button>
    </div>
  );
}

describe("ShoppingListBoundary", () => {
  beforeEach(() => {
    __resetShoppingListForTests();
    localStorage.clear();
    statefulChildMounts = 0;
    vi.clearAllMocks();
    mocks.getCurrentShoppingList.mockResolvedValue(storedList);
    mocks.saveCurrentShoppingList.mockResolvedValue(storedList);
    mocks.startNewShoppingList.mockResolvedValue({
      ...storedList,
      id: "00000000-0000-4000-8000-000000000081",
    });
  });

  it("installs the server list, keeps the local meal plan separate, and saves edits", async () => {
    mocks.saveCurrentShoppingList.mockResolvedValue({
      ...storedList,
      revision: "1",
    });
    localStorage.setItem("recipe-shopping-plan-resource", "user-1");
    setPlannedMeal("fri", "dinner", "tomato-soup");
    const { queryClient } = renderWithQueryClient(
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
    expect(
      queryClient.getQueryData<StoredShoppingList>([
        "recipes",
        "private",
        "user-1",
        "shopping-list",
      ])?.revision,
    ).toBe("1");
  });

  it("saves a rapid check then uncheck against advancing revisions", async () => {
    mocks.saveCurrentShoppingList
      .mockResolvedValueOnce({ ...storedList, revision: "1" })
      .mockResolvedValueOnce({ ...storedList, revision: "2" });
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");

    act(() => toggleChecked("garlic"));
    await waitFor(() =>
      expect(mocks.saveCurrentShoppingList).toHaveBeenCalledTimes(1),
    );
    act(() => toggleChecked("garlic"));

    await waitFor(() =>
      expect(mocks.saveCurrentShoppingList).toHaveBeenNthCalledWith(
        2,
        storedList.id,
        "1",
        expect.objectContaining({ checked: [] }),
      ),
    );
    expect(getShoppingListSnapshot().checked).toEqual([]);
  });

  it("does not resave a change received from another tab", async () => {
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");
    mocks.saveCurrentShoppingList.mockClear();

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: "recipe-shopping-list:v1",
          newValue: JSON.stringify({
            ...emptySnapshot,
            checked: ["garlic"],
            listId: storedList.id,
          }),
        }),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(getShoppingListSnapshot().checked).toEqual(["garlic"]);
    expect(mocks.saveCurrentShoppingList).not.toHaveBeenCalled();
  });

  it("refreshes the revision before saving a cross-tab change", async () => {
    const remoteList = {
      ...storedList,
      revision: "1",
      snapshot: {
        ...emptySnapshot,
        extras: [{ id: "extra-bread", text: "Bread", checked: false }],
      },
    };
    mocks.getCurrentShoppingList
      .mockResolvedValueOnce(storedList)
      .mockResolvedValue(remoteList);
    mocks.saveCurrentShoppingList.mockResolvedValue({
      ...remoteList,
      revision: "2",
    });
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: "recipe-shopping-list:v1",
          newValue: JSON.stringify({
            ...remoteList.snapshot,
            listId: storedList.id,
          }),
        }),
      );
    });
    await waitFor(
      () => expect(mocks.getCurrentShoppingList).toHaveBeenCalledTimes(2),
      { timeout: 2_000 },
    );
    act(() => addExtra("Milk"));

    await waitFor(
      () =>
        expect(mocks.saveCurrentShoppingList).toHaveBeenCalledWith(
          storedList.id,
          "1",
          expect.objectContaining({
            extras: expect.arrayContaining([
              expect.objectContaining({ text: "Bread" }),
              expect.objectContaining({ text: "Milk" }),
            ]),
          }),
        ),
      { timeout: 2_000 },
    );
  });

  it("rebases a local edit and retries after a revision conflict", async () => {
    const remoteList = {
      ...storedList,
      revision: "1",
      snapshot: {
        ...emptySnapshot,
        extras: [{ id: "extra-bread", text: "Bread", checked: false }],
      },
    };
    mocks.getCurrentShoppingList
      .mockResolvedValueOnce(storedList)
      .mockResolvedValue(remoteList);
    mocks.saveCurrentShoppingList
      .mockRejectedValueOnce(new ApiError("conflict", 409))
      .mockResolvedValueOnce({ ...remoteList, revision: "2" });
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");

    act(() => addExtra("Milk"));

    await waitFor(
      () =>
        expect(mocks.saveCurrentShoppingList).toHaveBeenNthCalledWith(
          2,
          storedList.id,
          "1",
          expect.objectContaining({
            extras: expect.arrayContaining([
              expect.objectContaining({ text: "Bread" }),
              expect.objectContaining({ text: "Milk" }),
            ]),
          }),
        ),
      { timeout: 3_000 },
    );
  });

  it("clears a local meal plan owned by another shopping-list scope", async () => {
    localStorage.setItem("recipe-shopping-plan-resource", "other-user");
    setPlannedMeal("fri", "dinner", "private-recipe");

    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );

    await screen.findByText("List ready");
    expect(getShoppingListSnapshot().plan).toEqual([]);
  });

  it("keeps failed edits local and shows that they are unsaved", async () => {
    mocks.saveCurrentShoppingList.mockRejectedValue(new Error("conflict"));
    renderWithQueryClient(
      <ShoppingListBoundary>
        <p>List ready</p>
      </ShoppingListBoundary>,
    );
    await screen.findByText("List ready");

    act(() => addExtra("Milk"));

    expect(
      await screen.findByText(
        /latest shopping-list changes have not been saved/i,
      ),
    ).toBeInTheDocument();
    expect(getShoppingListSnapshot().extras).toEqual([
      expect.objectContaining({ text: "Milk" }),
    ]);
  });

  it("clears immediately, then archives the loaded list", async () => {
    let finishStarting: ((list: StoredShoppingList) => void) | undefined;
    mocks.startNewShoppingList.mockImplementation(
      () =>
        new Promise<StoredShoppingList>((resolve) => {
          finishStarting = resolve;
        }),
    );
    renderWithQueryClient(
      <ShoppingListBoundary>
        <StartNewButton />
      </ShoppingListBoundary>,
    );
    await screen.findByRole("button", { name: "Start new" });
    act(() => addExtra("Milk"));

    fireEvent.click(screen.getByRole("button", { name: "Start new" }));

    expect(getShoppingListSnapshot()).toEqual({
      recipes: [],
      plan: [],
      checked: [],
      extras: [],
    });
    expect(
      JSON.parse(localStorage.getItem("recipe-shopping-list:v1") ?? "{}"),
    ).toEqual(
      expect.objectContaining({
        extras: [expect.objectContaining({ text: "Milk" })],
        listId: storedList.id,
      }),
    );
    await waitFor(() =>
      expect(mocks.startNewShoppingList).toHaveBeenCalledWith(
        storedList.id,
        storedList.revision,
        expect.objectContaining({
          extras: [expect.objectContaining({ text: "Milk" })],
        }),
      ),
    );
    expect(mocks.saveCurrentShoppingList).not.toHaveBeenCalled();

    act(() =>
      finishStarting?.({
        ...storedList,
        id: "00000000-0000-4000-8000-000000000081",
      }),
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

  it("keeps child view state while installing the replacement list", async () => {
    const nextListId = "00000000-0000-4000-8000-000000000081";
    renderWithQueryClient(
      <ShoppingListBoundary>
        <StatefulStartNewButton />
      </ShoppingListBoundary>,
    );
    await screen.findByRole("button", { name: "Show list" });
    fireEvent.click(screen.getByRole("button", { name: "Show list" }));
    expect(screen.getByTestId("current-view")).toHaveTextContent(
      "Current view: list",
    );
    act(() => addExtra("Milk"));

    fireEvent.click(screen.getByRole("button", { name: "Start new" }));

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem("recipe-shopping-list:v1") ?? "{}",
      ) as { listId?: string };
      expect(stored.listId).toBe(nextListId);
    });
    expect(screen.getByTestId("current-view")).toHaveTextContent(
      "Current view: list",
    );
    expect(screen.getByTestId("current-view")).toHaveAttribute(
      "data-mount",
      "1",
    );
  });

  it("carries unsaved edits into a replacement list without dropping remote items", async () => {
    const nextList = {
      ...storedList,
      id: "00000000-0000-4000-8000-000000000081",
      snapshot: {
        ...emptySnapshot,
        extras: [{ id: "extra-bread", text: "Bread", checked: false }],
      },
    };
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
        nextList,
      );
    });

    await waitFor(
      () =>
        expect(mocks.saveCurrentShoppingList).toHaveBeenCalledWith(
          nextList.id,
          nextList.revision,
          expect.objectContaining({
            extras: expect.arrayContaining([
              expect.objectContaining({ text: "Bread" }),
              expect.objectContaining({ text: "Milk" }),
            ]),
          }),
        ),
      { timeout: 2_000 },
    );
  });

  it("archives against the revision from a save already in flight", async () => {
    let finishSaving: ((list: StoredShoppingList) => void) | undefined;
    mocks.saveCurrentShoppingList.mockImplementation(
      () =>
        new Promise<StoredShoppingList>((resolve) => {
          finishSaving = resolve;
        }),
    );
    renderWithQueryClient(
      <ShoppingListBoundary>
        <StartNewButton />
      </ShoppingListBoundary>,
    );
    await screen.findByRole("button", { name: "Start new" });
    act(() => addExtra("Milk"));
    await waitFor(() =>
      expect(mocks.saveCurrentShoppingList).toHaveBeenCalledOnce(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Start new" }));

    expect(getShoppingListSnapshot().extras).toEqual([]);
    expect(mocks.startNewShoppingList).not.toHaveBeenCalled();

    act(() =>
      finishSaving?.({
        ...storedList,
        revision: "1",
        snapshot:
          mocks.saveCurrentShoppingList.mock.calls[0]?.[2] ?? emptySnapshot,
      }),
    );
    await waitFor(() =>
      expect(mocks.startNewShoppingList).toHaveBeenCalledWith(
        storedList.id,
        "1",
        expect.objectContaining({
          extras: [expect.objectContaining({ text: "Milk" })],
        }),
      ),
    );
  });

  it("restores the previous list when starting a new one fails", async () => {
    mocks.startNewShoppingList.mockRejectedValue(new Error("offline"));
    renderWithQueryClient(
      <ShoppingListBoundary>
        <StartNewButton />
      </ShoppingListBoundary>,
    );
    await screen.findByRole("button", { name: "Start new" });
    act(() => addExtra("Milk"));

    fireEvent.click(screen.getByRole("button", { name: "Start new" }));

    expect(getShoppingListSnapshot().extras).toEqual([]);
    await waitFor(() =>
      expect(getShoppingListSnapshot().extras).toEqual([
        expect.objectContaining({ text: "Milk" }),
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(mocks.saveCurrentShoppingList).not.toHaveBeenCalled();
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
