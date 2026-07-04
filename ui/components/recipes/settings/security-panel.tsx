"use client";

import { Check, LoaderCircle, Monitor, Plus, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AUTH_PROVIDERS,
  type Provider,
  ProviderIcon,
} from "@/components/recipes/auth-providers";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { PanelHead } from "./panel-head";

type LinkedAccount = { providerId: string; accountId: string };
type DeviceSession = {
  token: string;
  userAgent?: string | null;
  updatedAt: Date;
};

const KNOWN_PROVIDER_IDS = new Set<string>(AUTH_PROVIDERS.map((p) => p.id));

function describeDevice(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome|CriOS/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "device";
  return `${browser} · ${os}`;
}

function isMobileUa(ua?: string | null): boolean {
  return !!ua && /iPhone|iPad|Android/.test(ua);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "active now";
  if (minutes < 60) return `active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `active ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `active ${days}d ago`;
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`rt-mono mb-2 text-[var(--terracotta)] ${className ?? ""}`}>
      {children}
    </p>
  );
}

export function SecurityPanel({
  currentSessionToken,
}: {
  currentSessionToken: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setAccountsError(false);
    const result = await authClient.listAccounts();
    if (result.error) {
      setAccountsError(true);
      return;
    }
    setAccounts(
      (result.data ?? []).map((account) => ({
        providerId: account.providerId,
        accountId: account.accountId,
      })),
    );
  }

  async function loadSessions() {
    setSessionsError(false);
    const result = await authClient.listSessions();
    if (result.error) {
      setSessionsError(true);
      return;
    }
    const rows = (result.data ?? []).map((session) => ({
      token: session.token,
      userAgent: session.userAgent,
      updatedAt: session.updatedAt,
    }));
    // Current device first, then most-recently active.
    rows.sort((a, b) => {
      if (a.token === currentSessionToken) return -1;
      if (b.token === currentSessionToken) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    setSessions(rows);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load linked accounts + devices once on mount
  useEffect(() => {
    void loadAccounts();
    void loadSessions();
  }, []);

  const linkedIds = new Set(accounts?.map((account) => account.providerId));
  const linkedKnown = (accounts ?? []).filter((account) =>
    KNOWN_PROVIDER_IDS.has(account.providerId),
  );
  const unlinked = AUTH_PROVIDERS.filter(
    (provider) => !linkedIds.has(provider.id),
  );
  const isOnlySignIn = (accounts?.length ?? 0) <= 1;

  async function linkProvider(provider: Provider) {
    setPending(`link:${provider}`);
    setError(null);
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: "/recipes/settings",
      });
      if (result.error) {
        setError(result.error.message ?? "Couldn't start linking.");
        setPending(null);
      }
      // On success the browser is redirected to the provider.
    } catch {
      setError("Couldn't start linking. Please try again.");
      setPending(null);
    }
  }

  async function unlinkProvider(account: LinkedAccount) {
    setPending(`unlink:${account.providerId}`);
    setError(null);
    const result = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });
    if (result.error) {
      setError(result.error.message ?? "Couldn't unlink that account.");
    } else {
      await loadAccounts();
    }
    setPending(null);
  }

  async function signOutSession(token: string) {
    setPending(`session:${token}`);
    setError(null);
    const result = await authClient.revokeSession({ token });
    if (result.error) {
      setError(result.error.message ?? "Couldn't sign out that device.");
    } else {
      await loadSessions();
    }
    setPending(null);
  }

  return (
    <div>
      <PanelHead
        kicker="SIGN-IN & SECURITY"
        title="How you log in."
        sub="You sign in with a linked account — there's no password to set or forget. Link both so you're never locked out."
      />

      <SectionLabel>Linked accounts</SectionLabel>
      {accounts === null && !accountsError && (
        <div className="flex items-center gap-2 py-2 text-[var(--ink-3)]">
          <LoaderCircle className="size-4 animate-spin" />
          <span className="rt-mono">Checking accounts…</span>
        </div>
      )}
      {accountsError && (
        <p className="rt-mono text-[var(--destructive)]">
          Linked accounts couldn't be loaded.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {linkedKnown.map((account) => {
          const provider = AUTH_PROVIDERS.find(
            (candidate) => candidate.id === account.providerId,
          );
          if (!provider) return null;
          return (
            <div
              key={account.providerId}
              className="flex items-center gap-3.5 rounded-xl border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--paper-warm)]">
                <ProviderIcon path={provider.iconPath} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="rt-body text-[0.95rem] text-[var(--ink)]">
                  {provider.name}
                </p>
                <p className="rt-mono mt-0.5 flex items-center gap-1 text-[var(--sage)]">
                  <Check className="size-3" />
                  connected
                </p>
              </div>
              {isOnlySignIn ? (
                <span className="rt-mono text-right text-[var(--ink-4)]">
                  can't unlink your only sign-in
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--terracotta-deep)]"
                  disabled={pending !== null}
                  onClick={() => void unlinkProvider(account)}
                >
                  {pending === `unlink:${account.providerId}` ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  Unlink
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {unlinked.length > 0 && (
        <>
          <p className="rt-mono mt-5 mb-2 text-[var(--ink-3)]">Link another</p>
          <div className="flex flex-wrap gap-2">
            {unlinked.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                className="bg-[var(--card)]"
                disabled={pending !== null}
                onClick={() => void linkProvider(provider.id)}
              >
                {pending === `link:${provider.id}` ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Plus />
                )}
                <ProviderIcon path={provider.iconPath} className="size-4" />
                {provider.name}
              </Button>
            ))}
          </div>
        </>
      )}

      <SectionLabel className="mt-8">Where you're signed in</SectionLabel>
      {sessions === null && !sessionsError && (
        <div className="flex items-center gap-2 py-2 text-[var(--ink-3)]">
          <LoaderCircle className="size-4 animate-spin" />
          <span className="rt-mono">Checking devices…</span>
        </div>
      )}
      {sessionsError && (
        <p className="rt-mono text-[var(--destructive)]">
          Active devices couldn't be loaded.
        </p>
      )}
      {sessions?.map((session) => {
        const here = session.token === currentSessionToken;
        const Icon = isMobileUa(session.userAgent) ? Smartphone : Monitor;
        return (
          <div
            key={session.token}
            className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-3"
          >
            <Icon className="size-4 text-[var(--ink-2)]" />
            <div className="min-w-0 flex-1">
              <p className="rt-body text-[0.95rem] text-[var(--ink)]">
                {describeDevice(session.userAgent)}
              </p>
              <p className="rt-mono text-[var(--ink-3)]">
                {here ? "this device" : timeAgo(session.updatedAt)}
              </p>
            </div>
            {here ? (
              <span className="rt-mono text-[var(--sage)]">● this device</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--terracotta-deep)]"
                disabled={pending !== null}
                onClick={() => void signOutSession(session.token)}
              >
                {pending === `session:${session.token}` ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Sign out
              </Button>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="rt-mono mt-4 text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
