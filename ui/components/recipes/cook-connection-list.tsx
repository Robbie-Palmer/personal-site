import Link from "next/link";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import type { PublicCookConnection } from "@/lib/api/public-cooks";

export function CookConnectionList({
  label,
  cooks,
  count,
}: Readonly<{
  label: "Followers" | "Following";
  cooks: PublicCookConnection[];
  count: number;
}>) {
  return (
    <section className="rounded-xl border border-[var(--line-strong)] bg-[var(--card)] p-4 shadow-[var(--paper-shadow)]">
      <h2 className="rt-display text-2xl">
        {count} {label}
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
      {count > cooks.length ? (
        <p className="rt-body mt-3 text-xs text-[var(--ink-3)]">
          Showing the {cooks.length} most recent.
        </p>
      ) : null}
    </section>
  );
}
