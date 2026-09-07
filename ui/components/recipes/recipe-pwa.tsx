"use client";

import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearOfflineRecipeSnapshots } from "@/lib/pwa/offline-recipe-cache";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export async function clearOfflineRecipeData(): Promise<void> {
  await clearOfflineRecipeSnapshots();
  if (!("serviceWorker" in navigator)) return;
  const message = { type: "CLEAR_RECIPE_OFFLINE_DATA" };
  navigator.serviceWorker.controller?.postMessage(message);
  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage(message);
  });
}

export function RecipePwa() {
  const [offline, setOffline] = useState(false);
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const userId = session?.user.id;
    void navigator.serviceWorker
      .register("/recipes-sw.js", { scope: "/recipes" })
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        if (!userId) return;
        if (!navigator.onLine) return;
        await fetch("/api/auth/get-session", { credentials: "same-origin" });
        await queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.bootstrap(userId),
        });
      })
      .catch(() => {
        // The web app remains usable online when registration or priming fails.
      });
  }, [queryClient, session?.user.id]);

  if (!offline) return null;

  return (
    <output
      aria-live="polite"
      className="rt-mono sticky top-[61px] z-40 flex items-center justify-center gap-2 border-b border-[var(--line-strong)] bg-[var(--butter-soft)] px-4 py-2 text-center text-[var(--ink-2)] sm:top-[65px]"
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      Offline. Saved recipes are read-only until you reconnect.
    </output>
  );
}
