import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function RecipeHomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading recipes"
      className="container mx-auto min-h-screen max-w-7xl px-4 pt-5 pb-10 md:pt-7 md:pb-14"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-16 w-72 max-w-[75vw] sm:h-20 sm:w-96" />
          <Skeleton className="h-5 w-52 max-w-[60vw]" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <CardGridSkeleton variant="filters" />
      <span className="sr-only">Loading recipes…</span>
    </div>
  );
}
