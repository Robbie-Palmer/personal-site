import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RecipeLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-[var(--terracotta)]" />
    </div>
  );
}

export function RecipeLoadError({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
  return (
    <div className="container mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="rt-display text-5xl">{title}</h1>
      <p className="rt-body mt-3 text-[var(--ink-2)]">{message}</p>
      <Button asChild variant="outline" className="mt-6 rounded-full">
        <Link href="/recipes">
          <ArrowLeft /> Back to recipes
        </Link>
      </Button>
    </div>
  );
}

export function RecipeQueryStatus({
  error,
  hasData,
  isFetching,
  isStale,
  subject,
}: Readonly<{
  error: unknown;
  hasData: boolean;
  isFetching: boolean;
  isStale: boolean;
  subject: string;
}>) {
  let message: string | null = null;
  let tone = "border-[var(--line)] bg-[var(--paper-warm)]";

  if (error) {
    message = hasData
      ? `The latest refresh failed; cached data for ${subject} is still shown.`
      : `${subject.charAt(0).toUpperCase()}${subject.slice(1)} could not be loaded.`;
    tone =
      "border-[var(--terracotta)]/30 bg-[var(--terracotta)]/5 text-[var(--ink-2)]";
  } else if (hasData && isFetching) {
    message = `Refreshing ${subject}…`;
  } else if (hasData && isStale) {
    message = `Cached data for ${subject} is shown; updates will refresh in the background.`;
  }

  if (!message) return null;

  return (
    <output
      aria-live="polite"
      className={`rt-body container mx-auto my-4 block max-w-5xl rounded-lg border px-4 py-3 text-sm text-[var(--ink-3)] ${tone}`}
    >
      {message}
    </output>
  );
}
