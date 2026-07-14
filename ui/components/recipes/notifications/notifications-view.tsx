"use client";

import { Bell, House, LoaderCircle, Lock, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  type HouseholdNotification,
  markAllNotificationsRead,
  respondToHouseholdInvitation,
  updateNotification,
} from "@/lib/api/notifications";
import { authClient } from "@/lib/auth-client";

function copyFor(item: HouseholdNotification) {
  const actor = item.actorName ?? "Someone";
  switch (item.type) {
    case "household_invited":
      return `${actor} invited you to join ${item.householdName}.`;
    case "household_removed":
      return `${actor} removed you from ${item.householdName}.`;
    case "household_deleted":
      return `${actor} deleted ${item.householdName}.`;
    case "household_invite_accepted":
      return `${actor} accepted your invitation to ${item.householdName}.`;
    case "household_invite_declined":
      return `${actor} declined your invitation to ${item.householdName}.`;
    case "household_member_left":
      return `${actor} left ${item.householdName}.`;
  }
}

function bucket(date: string) {
  const age = Date.now() - new Date(date).getTime();
  if (age < 24 * 60 * 60 * 1000) return "Today";
  if (age < 7 * 24 * 60 * 60 * 1000) return "This week";
  return "Earlier";
}

function relativeTime(date: string) {
  const seconds = Math.max(
    1,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function NotificationsView() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [items, setItems] = useState<HouseholdNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setItems(await getNotifications(signal));
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't load notifications.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);

  async function respond(
    item: HouseholdNotification,
    response: "accept" | "decline",
  ) {
    if (!item.invitationId) return;
    setActing(item.id);
    try {
      await respondToHouseholdInvitation(item.invitationId, response);
      await updateNotification(item.id, { read: true, dismissed: true });
      setItems((current) => current.filter(({ id }) => id !== item.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't respond to invitation.",
      );
    } finally {
      setActing(null);
    }
  }

  if (sessionPending || (session && loading)) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <LoaderCircle className="size-6 animate-spin text-[var(--ink-3)]" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <Lock className="mx-auto mb-4 size-8 text-[var(--terracotta)]" />
        <h1 className="rt-display text-4xl">Sign in to see notifications.</h1>
        <Button asChild className="mt-5">
          <Link href="/recipes">Back to recipes</Link>
        </Button>
      </div>
    );
  }

  const unread = items.filter((item) => !item.readAt).length;
  const groups = ["Today", "This week", "Earlier"].map((label) => ({
    label,
    items: items.filter((item) => bucket(item.createdAt) === label),
  }));

  return (
    <div className="container mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rt-mono text-[var(--terracotta)]">
            <Bell className="mr-1 inline size-3.5" /> Notifications
          </p>
          <h1 className="rt-display mt-1 text-5xl md:text-6xl">
            Everything,{" "}
            <span className="text-[var(--terracotta)]">in one place.</span>
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            {unread} unread · household invitations and activity.
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await markAllNotificationsRead();
              setItems((current) =>
                current.map((item) => ({
                  ...item,
                  readAt: item.readAt ?? new Date().toISOString(),
                })),
              );
            }}
          >
            Mark all read
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rt-body mt-5 rounded-xl border border-[var(--berry)]/40 bg-[var(--card)] p-3 text-[var(--berry)]"
        >
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--card)] px-6 py-14 text-center">
          <House className="mx-auto size-9 text-[var(--sage)]" />
          <h2 className="rt-display mt-3 text-3xl">You're all caught up.</h2>
          <p className="rt-body mt-1 text-[var(--ink-3)]">
            Household updates will land here.
          </p>
        </div>
      ) : (
        groups.map(
          (group) =>
            group.items.length > 0 && (
              <section key={group.label} className="mt-7">
                <div className="mb-1 flex items-center gap-3">
                  <h2 className="rt-mono text-[var(--ink-3)]">{group.label}</h2>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <article
                      key={item.id}
                      className={`group flex gap-3 rounded-xl p-3 sm:p-4 ${item.readAt ? "" : "bg-[var(--butter)]/15"}`}
                    >
                      <span
                        className="mt-4 size-2 shrink-0 rounded-full bg-[var(--terracotta)]"
                        style={{
                          visibility: item.readAt ? "hidden" : "visible",
                        }}
                      />
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--ink)] bg-[var(--sage)] text-white">
                        <House className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="rt-body text-[0.95rem] text-[var(--ink-2)]">
                          {copyFor(item)}
                        </p>
                        {item.type === "household_invited" &&
                          item.invitationId && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                disabled={acting === item.id}
                                onClick={() => void respond(item, "accept")}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={acting === item.id}
                                onClick={() => void respond(item, "decline")}
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <time className="rt-mono text-[var(--ink-4)]">
                          {relativeTime(item.createdAt)}
                        </time>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          className="flex size-6 items-center justify-center rounded-full border border-[var(--line-strong)] text-[var(--ink-3)] opacity-100 transition-colors hover:bg-[var(--terracotta)] hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={async () => {
                            await updateNotification(item.id, {
                              dismissed: true,
                            });
                            setItems((current) =>
                              current.filter(({ id }) => id !== item.id),
                            );
                          }}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ),
        )
      )}
    </div>
  );
}
