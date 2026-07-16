"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getNotificationPage } from "@/lib/api/notifications";
import { authClient } from "@/lib/auth-client";

export function NotificationBell() {
  const { data: session } = authClient.useSession();
  const sessionUserId = session?.user.id;
  const [unread, setUnread] = useState({ userId: "", count: 0 });
  const count = unread.userId === sessionUserId ? unread.count : 0;

  useEffect(() => {
    if (!sessionUserId) return;
    const controller = new AbortController();
    void getNotificationPage(0, controller.signal)
      .then((page) =>
        setUnread({ userId: sessionUserId, count: page.unreadCount }),
      )
      .catch(() => undefined);
    return () => controller.abort();
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
