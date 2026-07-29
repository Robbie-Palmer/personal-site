"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Joins pre-auth recipe activity to the authenticated user without sending
 * names or email addresses to product analytics.
 */
export function RecipeAnalyticsIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isPending) return;

    const userId = session?.user.id ?? null;
    if (userId && identifiedUserId.current !== userId) {
      posthog.identify(userId, {
        recipe_user_role: session?.user.role ?? "user",
      });
      identifiedUserId.current = userId;
      return;
    }

    if (!userId && identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [isPending, session?.user.id, session?.user.role]);

  return null;
}
