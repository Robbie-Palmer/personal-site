import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeBootstrap } from "@/lib/api/recipe-bootstrap";
import {
  clearOfflineRecipeSnapshots,
  loadOfflineRecipeSnapshot,
  saveOfflineRecipeSnapshot,
} from "@/lib/pwa/offline-recipe-cache";

type MutableRequest<T> = Omit<IDBRequest<T>, "error" | "result"> & {
  error: DOMException | null;
  result: T;
};

function successfulRequest<T>(action: () => T): IDBRequest<T> {
  const request = {
    error: null,
    onerror: null,
    onsuccess: null,
    result: undefined,
  } as unknown as MutableRequest<T>;
  queueMicrotask(() => {
    request.result = action();
    request.onsuccess?.call(request, new Event("success"));
  });
  return request;
}

function failingRequest<T>(): IDBRequest<T> {
  const request = {
    error: null,
    onerror: null,
    onsuccess: null,
    result: undefined,
  } as unknown as MutableRequest<T>;
  queueMicrotask(() => {
    request.onerror?.call(request, new Event("error"));
  });
  return request;
}

function delayedSuccessfulRequest<T>(
  action: () => T,
  waitFor: Promise<void>,
): IDBRequest<T> {
  const request = {
    error: null,
    onerror: null,
    onsuccess: null,
    result: undefined,
  } as unknown as MutableRequest<T>;
  void waitFor.then(() => {
    request.result = action();
    request.onsuccess?.call(request, new Event("success"));
  });
  return request;
}

function fakeIndexedDb(
  options: {
    failOpen?: boolean;
    failRead?: boolean;
    writeGate?: Promise<void>;
  } = {},
) {
  const records = new Map<string, unknown>();
  let storeCreated = false;
  const store = {
    clear: () =>
      successfulRequest(() => {
        records.clear();
      }),
    delete: (key: IDBValidKey) =>
      successfulRequest(() => {
        records.delete(String(key));
      }),
    get: (key: IDBValidKey) =>
      options.failRead
        ? failingRequest()
        : successfulRequest(() => records.get(String(key))),
    put: (value: { userId: string }) => {
      const write = () => {
        records.set(value.userId, value);
        return value.userId;
      };
      return options.writeGate
        ? delayedSuccessfulRequest(write, options.writeGate)
        : successfulRequest(write);
    },
  } as unknown as IDBObjectStore;
  const database = {
    close: vi.fn(),
    createObjectStore: vi.fn(() => {
      storeCreated = true;
      return store;
    }),
    objectStoreNames: {
      contains: () => storeCreated,
    },
    transaction: vi.fn(() => ({
      objectStore: () => store,
    })),
  } as unknown as IDBDatabase;
  const indexedDb = {
    open: vi.fn(() => {
      if (options.failOpen) return failingRequest() as IDBOpenDBRequest;
      const request = {
        error: null,
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: database,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (!storeCreated) {
          request.onupgradeneeded?.call(
            request,
            new Event("upgradeneeded") as IDBVersionChangeEvent,
          );
        }
        request.onsuccess?.call(request, new Event("success"));
      });
      return request;
    }),
  } as unknown as IDBFactory;

  return { database, indexedDb, records };
}

const bootstrap = {
  recipeBox: {
    box: { completed: true, recipeSlugs: ["lentil-soup"] },
    recipes: [{ slug: "lentil-soup", title: "Lentil soup" }],
  },
} as unknown as RecipeBootstrap;

describe("offline recipe cache", () => {
  let harness: ReturnType<typeof fakeIndexedDb>;

  beforeEach(() => {
    harness = fakeIndexedDb();
    vi.stubGlobal("indexedDB", harness.indexedDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a recipe snapshot regardless of its age", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1);
    await saveOfflineRecipeSnapshot("user-1", bootstrap);
    vi.mocked(Date.now).mockReturnValue(Number.MAX_SAFE_INTEGER);

    await expect(loadOfflineRecipeSnapshot("user-1")).resolves.toEqual({
      version: 1,
      userId: "user-1",
      savedAt: 1,
      bootstrap,
    });
  });

  it("keeps accounts separate and clears all snapshots on sign-out", async () => {
    await saveOfflineRecipeSnapshot("user-1", bootstrap);
    await saveOfflineRecipeSnapshot("user-2", bootstrap);

    expect(await loadOfflineRecipeSnapshot("user-1")).toMatchObject({
      userId: "user-1",
    });
    expect(await loadOfflineRecipeSnapshot("user-2")).toMatchObject({
      userId: "user-2",
    });

    await clearOfflineRecipeSnapshots();
    expect(harness.records).toHaveLength(0);
  });

  it("waits for an in-flight snapshot write before clearing", async () => {
    let releaseWrite: (() => void) | undefined;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    harness = fakeIndexedDb({ writeGate });
    vi.stubGlobal("indexedDB", harness.indexedDb);

    const save = saveOfflineRecipeSnapshot("user-1", bootstrap);
    const clear = clearOfflineRecipeSnapshots();
    releaseWrite?.();

    await Promise.all([save, clear]);
    expect(harness.records.size).toBe(0);
  });

  it("deletes an incompatible snapshot", async () => {
    harness.records.set("user-1", {
      version: 0,
      userId: "user-1",
      savedAt: 1,
      bootstrap,
    });

    await expect(loadOfflineRecipeSnapshot("user-1")).resolves.toBeNull();
    expect(harness.records.has("user-1")).toBe(false);
  });

  it("does nothing when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadOfflineRecipeSnapshot("user-1")).resolves.toBeNull();
    await expect(
      saveOfflineRecipeSnapshot("user-1", bootstrap),
    ).resolves.toBeUndefined();
    await expect(clearOfflineRecipeSnapshots()).resolves.toBeUndefined();
  });

  it("rejects with an Error when opening IndexedDB fails without one", async () => {
    harness = fakeIndexedDb({ failOpen: true });
    vi.stubGlobal("indexedDB", harness.indexedDb);

    await expect(loadOfflineRecipeSnapshot("user-1")).rejects.toThrow(
      "Could not open the recipe cache",
    );
  });

  it("rejects with an Error when an IndexedDB request fails without one", async () => {
    harness = fakeIndexedDb({ failRead: true });
    vi.stubGlobal("indexedDB", harness.indexedDb);

    await expect(loadOfflineRecipeSnapshot("user-1")).rejects.toThrow(
      "Recipe cache request failed",
    );
  });
});
