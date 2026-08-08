"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthButton } from "@/components/recipes/auth-button";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import { RecipeThumb } from "@/components/recipes/recipe-card";
import { RecipeQueryStatus } from "@/components/recipes/recipe-load-state";
import { RecipePageLink } from "@/components/recipes/recipe-page-link";
import { Button } from "@/components/ui/button";
import type {
  CookFollowStatus,
  PublicCookProfile,
  PublicCookSummary,
} from "@/lib/api/public-cooks";
import { setCookFollowing } from "@/lib/api/public-cooks";
import { authClient } from "@/lib/auth-client";
import { savedRecipeCard } from "@/lib/domain/recipe/recipeDraft";
import {
  cookFollowStatusQuery,
  publicCookQuery,
  publicCooksQuery,
} from "@/lib/query/public-cook-queries";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

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

function FollowCookAction({
  cook,
  currentUserId,
}: Readonly<{ cook: PublicCookProfile; currentUserId?: string }>) {
  const queryClient = useQueryClient();
  const isOwnProfile = currentUserId === cook.id;
  const status = useQuery({
    ...cookFollowStatusQuery(currentUserId ?? "anonymous", cook.id),
    enabled: Boolean(currentUserId) && !isOwnProfile,
  });
  const mutation = useMutation({
    mutationFn: (following: boolean) => setCookFollowing(cook.id, following),
    onSuccess: async (nextStatus: CookFollowStatus) => {
      if (!currentUserId) return;
      queryClient.setQueryData(
        recipeQueryKeys.cookFollowStatus(currentUserId, cook.id),
        nextStatus,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.followingDiscoverFeed(currentUserId),
        }),
        queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.publicCook(cook.id),
        }),
      ]);
    },
  });

  if (isOwnProfile) return null;
  if (!currentUserId) {
    return (
      <div className="sm:ml-auto">
        <AuthButton label="Log in to follow" />
      </div>
    );
  }

  const following = status.data?.following ?? false;
  const pending = status.isPending || mutation.isPending;
  const followError = mutation.error ?? status.error;
  let followIcon = <UserPlus />;
  if (pending) {
    followIcon = <LoaderCircle className="animate-spin" />;
  } else if (following) {
    followIcon = <UserCheck />;
  }
  return (
    <div className="sm:ml-auto sm:text-right">
      <Button
        type="button"
        variant={following ? "outline" : "default"}
        aria-pressed={following}
        disabled={pending}
        className={
          following
            ? ""
            : "bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
        }
        onClick={() => mutation.mutate(!following)}
      >
        {followIcon}
        {following ? "Following" : "Follow"}
      </Button>
      {followError ? (
        <p
          role="alert"
          className="rt-body mt-2 max-w-52 text-xs text-[var(--terracotta-deep)]"
        >
          {followError instanceof Error
            ? followError.message
            : "Follow status could not be updated."}
        </p>
      ) : null}
    </div>
  );
}

function CookConnectionList({
  label,
  cooks,
}: Readonly<{
  label: "Followers" | "Following";
  cooks: PublicCookProfile["followers"];
}>) {
  return (
    <section className="rounded-xl border border-[var(--line-strong)] bg-[var(--card)] p-4 shadow-[var(--paper-shadow)]">
      <h2 className="rt-display text-2xl">
        {cooks.length} {label}
      </h2>
      {cooks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {cooks.map((cook) => (
            <Link
              key={cook.id}
              href={`/recipes/cooks?cook=${encodeURIComponent(cook.id)}`}
              className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper-warm)] py-1.5 pr-3 pl-1.5 text-sm font-bold transition-colors hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              <RecipeAvatar name={cook.name} image={cook.image} size={28} />
              {cook.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rt-body mt-2 text-sm text-[var(--ink-3)]">
          No {label.toLowerCase()} yet.
        </p>
      )}
    </section>
  );
}

function CookProfile({
  cook,
  currentUserId,
}: Readonly<{ cook: PublicCookProfile; currentUserId?: string }>) {
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
        <div className="min-w-0 flex-1">
          <p className="rt-mono text-[var(--terracotta)]">Cook profile</p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
            {firstName}’s{" "}
            <span className="text-[var(--terracotta)]">recipe activity.</span>
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            Public recipes this cook has recently added.
          </p>
        </div>
        <FollowCookAction cook={cook} currentUserId={currentUserId} />
      </header>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <CookConnectionList label="Followers" cooks={cook.followers} />
        <CookConnectionList label="Following" cooks={cook.following} />
      </div>
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

function fatalCooksError(
  data: unknown,
  error: unknown,
  subject: string,
): string | null {
  if (data !== undefined || !error) return null;
  return error instanceof Error
    ? error.message
    : `${subject} could not be loaded.`;
}

function CooksContent({
  cooks,
  error,
  selectedCook,
  selectedCookId,
  currentUserId,
}: Readonly<{
  cooks: PublicCookSummary[];
  error: string | null;
  selectedCook: PublicCookProfile | null;
  selectedCookId: string | null;
  currentUserId?: string;
}>) {
  if (error) return <CooksError error={error} />;
  if (selectedCook) {
    return <CookProfile cook={selectedCook} currentUserId={currentUserId} />;
  }
  if (selectedCookId) return <CookNotFound />;
  return <CookDirectory cooks={cooks} />;
}

export function PublicCooksView() {
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const selectedCookId = searchParams.get("cook");
  const subject = selectedCookId ? "This cook" : "The cooks directory";
  const directory = useQuery({
    ...publicCooksQuery(),
    enabled: !selectedCookId,
  });
  const profile = useQuery({
    ...publicCookQuery(selectedCookId ?? "none"),
    enabled: Boolean(selectedCookId),
  });
  const result = selectedCookId ? profile : directory;

  if (result.isPending) {
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
    <>
      <RecipeQueryStatus
        error={result.error}
        hasData={result.data !== undefined}
        isFetching={result.isFetching}
        isStale={result.isStale}
        subject={subject.toLowerCase()}
      />
      <div className="container mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
        <CooksContent
          cooks={directory.data ?? []}
          error={fatalCooksError(result.data, result.error, subject)}
          selectedCook={profile.data ?? null}
          selectedCookId={selectedCookId}
          currentUserId={session?.user.id}
        />
      </div>
    </>
  );
}
