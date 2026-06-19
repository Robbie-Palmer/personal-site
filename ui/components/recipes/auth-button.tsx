"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, LoaderCircle, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { siGithub, siGoogle } from "simple-icons";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "github";
type LinkedAccount = { providerId: string; accountId: string };

const providers: ReadonlyArray<{
  id: Provider;
  name: string;
  iconPath: string;
}> = [
  { id: "google", name: "Google", iconPath: siGoogle.path },
  { id: "github", name: "GitHub", iconPath: siGithub.path },
];

function ProviderIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function AuthButton() {
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[] | null>(
    null,
  );
  const [accountsError, setAccountsError] = useState(false);
  const [lastUsedProvider, setLastUsedProvider] = useState<Provider | null>(
    null,
  );

  // Read from the client-side cookie after mount to avoid a hydration mismatch.
  useEffect(() => {
    const method = authClient.getLastUsedLoginMethod();
    if (method === "google" || method === "github") {
      setLastUsedProvider(method);
    }
  }, []);

  async function loadLinkedAccounts() {
    setAccountsError(false);
    const result = await authClient.listAccounts();
    if (result.error) {
      setAccountsError(true);
      return;
    }
    setLinkedAccounts(result.data ?? []);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && session && linkedAccounts === null && !accountsError) {
      void loadLinkedAccounts();
    }
  }

  async function signOut() {
    setError(null);
    try {
      const result = await authClient.signOut({
        fetchOptions: { onSuccess: () => window.location.reload() },
      });
      if (result?.error) {
        setError(result.error.message ?? "Sign-out failed. Please try again.");
      }
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  }

  if (isPending) {
    return (
      <Button variant="outline" size="sm" disabled aria-label="Loading session">
        <LoaderCircle className="animate-spin" />
        <span className="hidden sm:inline">Sign in</span>
      </Button>
    );
  }

  if (session) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Account for ${session.user.name}`}
            aria-expanded={open}
          >
            <span className="max-w-32 truncate">{session.user.name}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            sideOffset={6}
            className="bg-popover text-popover-foreground z-50 w-64 rounded-md border p-3 shadow-md outline-none"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              {session.user.name}
              {session.user.role === "admin" && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  Admin
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>

            <div className="my-3 border-t" />
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Connected identities
            </p>

            {linkedAccounts === null && !accountsError && (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <LoaderCircle className="animate-spin" />
                Checking accounts…
              </div>
            )}

            {linkedAccounts?.map((account) => {
              const provider = providers.find(
                (candidate) => candidate.id === account.providerId,
              );
              if (!provider) return null;
              const accountSuffix = account.accountId.slice(-6);

              return (
                <div
                  key={`${account.providerId}:${account.accountId}`}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-2"
                >
                  <ProviderIcon path={provider.iconPath} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{provider.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Provider account ending {accountSuffix}
                    </p>
                  </div>
                </div>
              );
            })}

            {accountsError && (
              <p className="text-xs text-destructive">
                Connected identities could not be loaded.
              </p>
            )}

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="my-3 border-t" />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={signOut}
            >
              <LogOut />
              Sign out
            </Button>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  async function signIn(provider: Provider) {
    setPendingProvider(provider);
    setError(null);

    const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: currentURL,
        errorCallbackURL: currentURL,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign-in could not be started.");
      }
    } catch {
      setError("Sign-in could not be started. Please try again.");
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" size="sm" aria-expanded={open}>
          <LogIn />
          <span className="hidden sm:inline">Sign in</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="bg-popover text-popover-foreground z-50 w-56 rounded-md border p-2 shadow-md outline-none"
        >
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Sign in to your recipes
          </p>
          <div className="flex flex-col gap-1">
            {providers.map((provider) => (
              <Button
                key={provider.id}
                variant="ghost"
                className="w-full justify-start"
                disabled={pendingProvider !== null}
                onClick={() => signIn(provider.id)}
              >
                {pendingProvider === provider.id ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ProviderIcon path={provider.iconPath} />
                )}
                Continue with {provider.name}
                {lastUsedProvider === provider.id && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                    Last used
                  </span>
                )}
              </Button>
            ))}
          </div>
          {error && (
            <p role="alert" className="px-2 pt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
