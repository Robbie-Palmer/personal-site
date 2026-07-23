"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import { RecipeThumb } from "@/components/recipes/recipe-card";
import { RecipePageLink } from "@/components/recipes/recipe-page-link";
import { Button } from "@/components/ui/button";
import {
  getPublicCook,
  getPublicCooks,
  type PublicCookProfile,
  type PublicCookSummary,
} from "@/lib/api/public-cooks";
import { savedRecipeCard } from "@/lib/domain/recipe/recipeDraft";

function CookCard({ cook }: Readonly<{ cook: PublicCookSummary }>) {
  return (
    <Link
      href={`/recipes/cooks?cook=${encodeURIComponent(cook.id)}`}
      className="group rounded-2xl border border-[var(--line-strong)] bg-[var(--card)] p-5 shadow-[var(--paper-shadow)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-4">
        <RecipeAvatar
          name={cook.name}
          image={cook.image}
          size={56}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="rt-display truncate text-3xl">{cook.name}</h2>
          <p className="rt-mono mt-1 text-[var(--ink-3)]">
            {cook.activityCount} public{" "}
            {cook.activityCount === 1 ? "addition" : "additions"}
          </p>
        </div>
        <ArrowRight className="size-4 text-[var(--ink-3)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--terracotta)]" />
      </div>
      <p className="rt-body mt-5 border-t border-dashed border-[var(--line)] pt-4 text-sm text-[var(--ink-2)]">
        Recently added{" "}
        <span className="font-bold text-[var(--ink)]">
          {cook.latestRecipeTitle}
        </span>
      </p>
    </Link>
  );
}

function CookProfile({ cook }: Readonly<{ cook: PublicCookProfile }>) {
  const firstName = cook.name.trim().split(/\s+/)[0] || "This cook";
  return (
    <div>
      <Button asChild variant="ghost" className="-ml-3 mb-6">
        <Link href="/recipes/cooks">
          <ArrowLeft /> All cooks
        </Link>
      </Button>
      <header className="flex flex-col gap-5 border-b border-dashed border-[var(--line-strong)] pb-8 sm:flex-row sm:items-center">
        <RecipeAvatar
          name={cook.name}
          image={cook.image}
          size={88}
          className="shadow-[var(--paper-shadow)]"
        />
        <div>
          <p className="rt-mono text-[var(--terracotta)]">Cook profile</p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
            {firstName}’s{" "}
            <span className="text-[var(--terracotta)]">recipe activity.</span>
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            Public recipes this cook has recently added.
          </p>
        </div>
      </header>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cook.activity.map((item) => {
          const recipe = savedRecipeCard(item.recipe);
          return (
            <RecipePageLink
              key={`${item.recipe.slug}-${item.createdAt}`}
              href={`/recipes/${encodeURIComponent(item.recipe.slug)}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--line-strong)] bg-[var(--card)] p-4 shadow-[var(--paper-shadow)]"
            >
              {recipe ? (
                <RecipeThumb recipe={recipe} size={72} />
              ) : (
                <span className="flex size-[72px] shrink-0 items-center justify-center rounded-lg bg-[var(--paper-warm)] text-[var(--terracotta)]">
                  <Users className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="rt-mono text-[var(--terracotta)]">Added</p>
                <h2 className="rt-display mt-1 text-2xl leading-none transition-colors group-hover:text-[var(--terracotta)]">
                  {item.recipe.title}
                </h2>
              </div>
            </RecipePageLink>
          );
        })}
      </div>
    </div>
  );
}

function CookNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-8 text-center">
      <p className="rt-display text-3xl">Cook not found.</p>
      <p className="rt-body mt-2 text-sm text-[var(--ink-3)]">
        This cook has no public recipe activity.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href="/recipes/cooks">Browse all cooks</Link>
      </Button>
    </div>
  );
}

function CookDirectoryResults({
  cooks,
}: Readonly<{ cooks: PublicCookSummary[] }>) {
  if (cooks.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-[var(--line-strong)] p-8 text-center">
        <Users className="mx-auto size-7 text-[var(--terracotta)]" />
        <p className="rt-display mt-3 text-3xl">No public cooks yet.</p>
        <p className="rt-body mt-2 text-sm text-[var(--ink-3)]">
          Profiles appear here when someone adds a public recipe.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {cooks.map((cook) => (
        <CookCard key={cook.id} cook={cook} />
      ))}
    </div>
  );
}

function CookDirectory({ cooks }: Readonly<{ cooks: PublicCookSummary[] }>) {
  return (
    <>
      <header className="max-w-3xl">
        <p className="rt-mono text-[var(--terracotta)]">Cooks</p>
        <h1 className="rt-display mt-3 text-6xl sm:text-7xl">
          Meet the people{" "}
          <span className="text-[var(--terracotta)]">behind the recipes.</span>
        </h1>
        <p className="rt-body mt-4 text-lg text-[var(--ink-2)]">
          Explore home cooks through the public recipes they’ve been adding.
        </p>
      </header>
      <CookDirectoryResults cooks={cooks} />
    </>
  );
}

function CooksError({ error }: Readonly<{ error: string }>) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-8 text-center">
      <p className="rt-display text-3xl">The kitchen is quiet.</p>
      <p className="rt-body mt-2 text-sm text-[var(--ink-3)]">{error}</p>
    </div>
  );
}

function CooksContent({
  cooks,
  error,
  selectedCook,
  selectedCookId,
}: Readonly<{
  cooks: PublicCookSummary[];
  error: string | null;
  selectedCook: PublicCookProfile | null;
  selectedCookId: string | null;
}>) {
  if (error) return <CooksError error={error} />;
  if (selectedCook) return <CookProfile cook={selectedCook} />;
  if (selectedCookId) return <CookNotFound />;
  return <CookDirectory cooks={cooks} />;
}

export function PublicCooksView() {
  const searchParams = useSearchParams();
  const selectedCookId = searchParams.get("cook");
  const [cooks, setCooks] = useState<PublicCookSummary[]>([]);
  const [selectedCook, setSelectedCook] = useState<PublicCookProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSelectedCook(null);
    const request = selectedCookId
      ? getPublicCook(selectedCookId, controller.signal).then((cook) => {
          if (!controller.signal.aborted) setSelectedCook(cook);
        })
      : getPublicCooks(controller.signal).then((nextCooks) => {
          if (!controller.signal.aborted) setCooks(nextCooks);
        });
    void request
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The cooks directory could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedCookId]);

  if (loading) {
    return (
      <output
        aria-label="Loading cooks"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <LoaderCircle className="size-6 animate-spin text-[var(--terracotta)]" />
      </output>
    );
  }

  return (
    <div className="container mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <CooksContent
        cooks={cooks}
        error={error}
        selectedCook={selectedCook ?? null}
        selectedCookId={selectedCookId}
      />
    </div>
  );
}
