import { cn } from "@/lib/generic/styles";

/**
 * A circular avatar: the account photo when there is one, otherwise the first
 * initial on a butter-yellow disc with a handwritten (Caveat) letter.
 */
export function RecipeAvatar({
  name,
  email,
  image,
  size = 40,
  className,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (
    name?.trim()?.[0] ??
    email?.trim()?.[0] ??
    "?"
  ).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "rt-display inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[var(--ink)] bg-[var(--butter)] text-[var(--terracotta-deep)] leading-none select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {image ? (
        // Avatar hosts vary, so a plain <img> avoids configuring next/image
        // remotePatterns for each one.
        // biome-ignore lint/performance/noImgElement: small, external avatar
        <img
          src={image}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}
