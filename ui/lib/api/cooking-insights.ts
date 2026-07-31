import { ApiError, isApiError } from "@/lib/api/api-error";

export type CookingSession = {
  id: string;
  recipeSlug: string;
  recipeTitle: string;
  servings: number;
  startedAt: string;
  completedAt: string | null;
};

export type CookingInsights = {
  cookModeStarts: number;
  mealsCooked: number;
  distinctRecipesCooked: number;
  recent: CookingSession[];
};

export type CookingSessionEvent = {
  sessionId: string;
  recipeSlug: string;
  recipeTitle: string;
  servings: number;
  event: "started" | "completed";
};

export type CookingCompletionEvent = CookingSessionEvent & {
  event: "completed";
};

type PendingCookingCompletion = {
  userId: string;
  event: CookingCompletionEvent;
  queuedAt: number;
};

export const COOKING_COMPLETION_OUTBOX_STORAGE_KEY =
  "recipe-cooking-completion-outbox:v1";
const OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const OUTBOX_MAX_ENTRIES = 100;

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isCompletionEvent(value: unknown): value is CookingCompletionEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CookingCompletionEvent>;
  return (
    event.event === "completed" &&
    typeof event.sessionId === "string" &&
    typeof event.recipeSlug === "string" &&
    typeof event.recipeTitle === "string" &&
    typeof event.servings === "number"
  );
}

function readCompletionOutbox(): PendingCookingCompletion[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(COOKING_COMPLETION_OUTBOX_STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    const oldestAllowed = Date.now() - OUTBOX_RETENTION_MS;
    return parsed.filter(
      (item): item is PendingCookingCompletion =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.userId === "string" &&
        typeof item.queuedAt === "number" &&
        item.queuedAt >= oldestAllowed &&
        isCompletionEvent(item.event),
    );
  } catch {
    return [];
  }
}

function writeCompletionOutbox(entries: PendingCookingCompletion[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (entries.length === 0) {
      storage.removeItem(COOKING_COMPLETION_OUTBOX_STORAGE_KEY);
      return;
    }
    storage.setItem(
      COOKING_COMPLETION_OUTBOX_STORAGE_KEY,
      JSON.stringify(entries.slice(-OUTBOX_MAX_ENTRIES)),
    );
  } catch {
    // Completion still gets an immediate network attempt when storage is full
    // or unavailable, so persistence remains a best-effort enhancement.
  }
}

function removeQueuedCompletion(userId: string, sessionId: string): void {
  writeCompletionOutbox(
    readCompletionOutbox().filter(
      (item) => item.userId !== userId || item.event.sessionId !== sessionId,
    ),
  );
}

export function queueCookingCompletion(
  userId: string,
  event: CookingCompletionEvent,
): void {
  const entries = readCompletionOutbox().filter(
    (item) =>
      item.userId !== userId || item.event.sessionId !== event.sessionId,
  );
  entries.push({ userId, event, queuedAt: Date.now() });
  writeCompletionOutbox(entries);
}

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(body?.error ?? fallbackMessage, response.status);
  }
  return response.json() as Promise<T>;
}

export async function getCookingInsights(
  signal?: AbortSignal,
): Promise<CookingInsights> {
  return parseResponse(
    await fetch("/api/profile/cooking-insights", {
      credentials: "same-origin",
      signal,
    }),
    "Cooking insights could not be loaded.",
  );
}

export async function recordCookingSession(
  event: CookingSessionEvent,
): Promise<CookingSession> {
  const result = await parseResponse<{ cookingSession: CookingSession }>(
    await fetch("/api/profile/cooking-insights", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }),
    "Cooking activity could not be saved.",
  );
  return result.cookingSession;
}

export async function recordCookingCompletionReliably(
  userId: string,
  event: CookingCompletionEvent,
): Promise<CookingSession> {
  queueCookingCompletion(userId, event);
  const cookingSession = await recordCookingSession(event);
  removeQueuedCompletion(userId, event.sessionId);
  return cookingSession;
}

function isPermanentOutboxFailure(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 403, 408, 429].includes(error.status)
  );
}

export async function flushCookingCompletionOutbox(
  userId: string,
): Promise<void> {
  const pending = readCompletionOutbox().filter(
    (item) => item.userId === userId,
  );
  for (const item of pending) {
    try {
      await recordCookingSession(item.event);
      removeQueuedCompletion(userId, item.event.sessionId);
    } catch (error) {
      if (isPermanentOutboxFailure(error)) {
        removeQueuedCompletion(userId, item.event.sessionId);
        continue;
      }
      // Stop after the first transient failure to avoid hammering a degraded
      // connection. The app-level retry will resume from persisted state.
      throw error;
    }
  }
}
