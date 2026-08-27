"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getNotificationPage } from "@/lib/api/notifications";
import { authClient } from "@/lib/auth-client";
import { recipeBootstrapQuery } from "@/lib/query/recipe-queries";

const NOTIFICATION_REFRESH_INTERVAL_MS = 10_000;

export function NotificationBell() {
  const { data: session } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const bootstrap = useQuery({
    ...recipeBootstrapQuery(sessionUserId ?? "pending"),
    enabled: Boolean(sessionUserId),
  });
  const [unread, setUnread] = useState({ userId: "", count: 0 });
  const count =
    unread.userId === sessionUserId
      ? unread.count
      : (bootstrap.data?.unreadNotificationCount ?? 0);

  useEffect(() => {
    if (!sessionUserId) return;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      void getNotificationPage(0, controller.signal)
        .then((page) =>
          setUnread({ userId: sessionUserId, count: page.unreadCount }),
        )
        .catch(() => undefined);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const interval = globalThis.setInterval(
      refreshWhenVisible,
      NOTIFICATION_REFRESH_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      globalThis.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      controller?.abort();
    };
  }, [sessionUserId]);

  if (!session) return null;
  return (
    <Link
      href="/recipes/notifications"
      aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
      className="relative inline-flex size-9 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--paper-warm)] hover:text-[var(--ink)]"
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-[var(--terracotta)] px-1 text-[0.625rem] font-bold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
