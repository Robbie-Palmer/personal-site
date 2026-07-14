"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  ChevronDown,
  FlaskConical,
  LoaderCircle,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type Provider,
  ProviderIcon,
  AUTH_PROVIDERS as providers,
} from "@/components/recipes/auth-providers";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/generic/styles";
import { isPreviewDeployment } from "@/lib/preview-environment";

type PreviewScenario = {
  id: string;
  name: string;
  description: string;
};

function authPrompt(
  isPreview: boolean,
  previewBackendDisabled: boolean,
  intent: "signin" | "signup",
): string {
  if (isPreview) {
    return previewBackendDisabled
      ? "Sign-in unavailable"
      : intent === "signup"
        ? "Start a fresh preview account"
        : "Choose a preview scenario";
  }
  return intent === "signup"
    ? "Create your recipe box"
    : "Log in to your recipes";
}

export function AuthButton({
  intent = "signin",
}: Readonly<{ intent?: "signin" | "signup" }>) {
  const previewBackendDisabled =
    process.env.NEXT_PUBLIC_PREVIEW_BACKEND === "false";
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [pendingSignIn, setPendingSignIn] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [previewScenarios, setPreviewScenarios] = useState<
    PreviewScenario[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const preview = isPreviewDeployment(window.location.hostname);
    setIsPreview(preview);
    if (!preview) return;

    if (previewBackendDisabled) {
      setError("Sign-in is disabled on this frontend-only preview.");
      return;
    }

    if (intent === "signup") return;

    void fetch("/api/auth/preview/scenarios")
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview scenarios unavailable");
        return (await response.json()) as PreviewScenario[];
      })
      .then(setPreviewScenarios)
      .catch(() => setError("Preview sign-in is not configured."));
  }, [intent, previewBackendDisabled]);

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
    if (intent === "signup") return null;
    return (
      <Button variant="outline" size="sm" disabled aria-label="Loading session">
        <LoaderCircle className="animate-spin" />
        <span className="hidden sm:inline">Log in</span>
      </Button>
    );
  }

  if (session && intent === "signup") return null;

  if (session) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={`Account for ${session.user.name}`}
            aria-expanded={open}
            className="rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] data-[state=open]:ring-2 data-[state=open]:ring-[var(--terracotta)] data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-[var(--paper)]"
          >
            <RecipeAvatar
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
              size={36}
            />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            sideOffset={8}
            className="bg-popover text-popover-foreground z-50 w-64 overflow-hidden rounded-xl border shadow-md outline-none"
          >
            <div className="flex items-center gap-3 border-b bg-[var(--paper-warm)] px-4 py-3">
              <RecipeAvatar
                name={session.user.name}
                email={session.user.email}
                image={session.user.image}
                size={40}
              />
              <div className="min-w-0">
                <p className="rt-display flex items-center gap-2 text-lg leading-none">
                  {session.user.name}
                  {session.user.role === "admin" && (
                    <span className="rt-mono rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                      Admin
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            </div>

            <div className="p-1.5">
              <Button
                variant="ghost"
                className="w-full justify-start"
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href="/recipes/settings">
                  <Settings />
                  Settings
                </Link>
              </Button>
            </div>

            <div className="border-t p-1.5">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={signOut}
              >
                <LogOut />
                Sign out
              </Button>
            </div>

            {error && (
              <p role="alert" className="px-3 pb-3 text-xs text-destructive">
                {error}
              </p>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  async function signIn(provider: Provider) {
    setPendingSignIn(provider);
    setError(null);

    const currentURL =
      intent === "signup"
        ? "/recipes/onboarding"
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
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
      setPendingSignIn(null);
    }
  }

  async function previewSignIn(scenario: PreviewScenario) {
    setPendingSignIn(scenario.id);
    setError(null);
    try {
      const response = await fetch("/api/auth/preview/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: scenario.id }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Preview sign-in failed.");
        return;
      }
      if (intent === "signup") {
        window.location.assign("/recipes/onboarding");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Preview sign-in failed.");
    } finally {
      setPendingSignIn(null);
    }
  }

  async function previewSignUp() {
    setPendingSignIn("fresh-signup");
    setError(null);
    try {
      const response = await fetch("/api/auth/preview/sign-up", {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Preview sign-up failed.");
        return;
      }
      window.location.assign("/recipes/onboarding");
    } catch {
      setError("Preview sign-up failed.");
    } finally {
      setPendingSignIn(null);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant={intent === "signup" ? "default" : "outline"}
          size="sm"
          aria-expanded={open}
          className={cn(
            intent === "signup" &&
              "max-w-full rounded-full bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]",
          )}
        >
          {intent === "signup" ? <UserPlus /> : <LogIn />}
          <span className="min-w-0 truncate">
            {intent === "signup" ? "Sign up — free" : "Log in"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="bg-popover text-popover-foreground z-50 w-[calc(100vw-2rem)] max-w-56 rounded-md border p-2 shadow-md outline-none"
        >
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            {authPrompt(isPreview, previewBackendDisabled, intent)}
          </p>
          <div className="flex flex-col gap-1">
            {isPreview ? (
              intent === "signup" ? (
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start py-2"
                  disabled={pendingSignIn !== null}
                  onClick={previewSignUp}
                >
                  {pendingSignIn === "fresh-signup" ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <FlaskConical />
                  )}
                  <span className="min-w-0 text-left">
                    <span className="block">Start fresh</span>
                    <span className="block whitespace-normal text-xs font-normal text-muted-foreground">
                      Create a new empty QA account
                    </span>
                  </span>
                </Button>
              ) : (
                previewScenarios?.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant="ghost"
                    className="h-auto w-full justify-start py-2"
                    disabled={pendingSignIn !== null}
                    onClick={() => previewSignIn(scenario)}
                  >
                    {pendingSignIn === scenario.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <FlaskConical />
                    )}
                    <span className="min-w-0 text-left">
                      <span className="block">{scenario.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {scenario.description}
                      </span>
                    </span>
                  </Button>
                ))
              )
            ) : (
              providers.map((provider) => (
                <Button
                  key={provider.id}
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={pendingSignIn !== null}
                  onClick={() => signIn(provider.id)}
                >
                  {pendingSignIn === provider.id ? (
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
              ))
            )}
            {isPreview &&
              intent === "signin" &&
              previewScenarios === null &&
              !error && (
                <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                  <LoaderCircle className="animate-spin" />
                  Loading scenarios…
                </div>
              )}
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
