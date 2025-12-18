import { Skeleton } from "@/components/ui/skeleton";

export function CardGridSkeleton() {
  const skeletonIds: string[] = Array.from(
    { length: 6 },
    (_, i) => `skeleton-${i}`,
  );
  return (
    <div className="space-y-6">
      {/* Input + Button row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 flex-1 max-w-md rounded-md" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      {/* Cards grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {skeletonIds.map((id) => (
          <div key={id} className="rounded-lg border bg-card overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
