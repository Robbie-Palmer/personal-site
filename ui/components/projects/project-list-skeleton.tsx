import { Skeleton } from "@/components/ui/skeleton";

export function ProjectListSkeleton() {
  const skeletonIds: string[] = Array.from(
    { length: 6 },
    (_, i) => `skeleton-${i}`,
  );
  return (
    <div className="space-y-8">
      {/* Badge row */}
      <div className="flex flex-wrap items-baseline gap-4 mb-6"></div>

      {/* Input + Button row */}
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 flex-1 max-w-md rounded-md" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skeletonIds.map((id) => (
          <div key={id} className="space-y-2">
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
