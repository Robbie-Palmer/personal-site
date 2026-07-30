"use client";

import { useEffect } from "react";
import { flushCookingCompletionOutbox } from "@/lib/api/cooking-insights";
import { authClient } from "@/lib/auth-client";

const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;

export function CookingCompletionOutbox() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const userId = session?.user.id;
    if (isPending || !userId) return;

    let cancelled = false;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = async () => {
      if (retryTimer) clearTimeout(retryTimer);
      try {
        await flushCookingCompletionOutbox(userId);
        retryDelay = INITIAL_RETRY_DELAY_MS;
      } catch (error) {
        console.error(
          "[CookingCompletionOutbox] Could not flush cooked meals",
          error,
        );
        if (!cancelled) {
          retryTimer = setTimeout(flush, retryDelay);
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        }
      }
    };

    const handleOnline = () => {
      retryDelay = INITIAL_RETRY_DELAY_MS;
      void flush();
    };

    void flush();
    globalThis.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      globalThis.removeEventListener("online", handleOnline);
    };
  }, [isPending, session?.user.id]);

  return null;
}
