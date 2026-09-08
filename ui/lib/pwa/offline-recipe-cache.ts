import type { RecipeBootstrap } from "@/lib/api/recipe-bootstrap";

const DATABASE_NAME = "robbies-recipes";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "recipe-snapshots";
const SNAPSHOT_VERSION = 1;
let snapshotMutationQueue = Promise.resolve();

export type OfflineRecipeSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  userId: string;
  savedAt: number;
  bootstrap: RecipeBootstrap;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the recipe cache"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Recipe cache request failed"));
  });
}

function isOfflineRecipeSnapshot(
  value: unknown,
  userId: string,
): value is OfflineRecipeSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OfflineRecipeSnapshot>;
  return (
    candidate.version === SNAPSHOT_VERSION &&
    candidate.userId === userId &&
    typeof candidate.savedAt === "number" &&
    candidate.bootstrap !== undefined
  );
}

export async function loadOfflineRecipeSnapshot(
  userId: string,
): Promise<OfflineRecipeSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    const store = transaction.objectStore(SNAPSHOT_STORE);
    const value = await requestResult(store.get(userId));
    if (!isOfflineRecipeSnapshot(value, userId)) {
      if (value !== undefined) await requestResult(store.delete(userId));
      return null;
    }
    return value;
  } finally {
    database.close();
  }
}

export async function saveOfflineRecipeSnapshot(
  userId: string,
  bootstrap: RecipeBootstrap,
): Promise<void> {
  const write = snapshotMutationQueue.then(async () => {
    if (typeof indexedDB === "undefined") return;
    const database = await openDatabase();
    try {
      const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
      await requestResult(
        transaction.objectStore(SNAPSHOT_STORE).put({
          version: SNAPSHOT_VERSION,
          userId,
          savedAt: Date.now(),
          bootstrap,
        } satisfies OfflineRecipeSnapshot),
      );
    } finally {
      database.close();
    }
  });
  snapshotMutationQueue = write.catch(() => undefined);
  await write;
}

export async function clearOfflineRecipeSnapshots(): Promise<void> {
  const clear = snapshotMutationQueue.then(async () => {
    if (typeof indexedDB === "undefined") return;
    const database = await openDatabase();
    try {
      const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
      await requestResult(transaction.objectStore(SNAPSHOT_STORE).clear());
    } finally {
      database.close();
    }
  });
  snapshotMutationQueue = clear.catch(() => undefined);
  await clear;
}
