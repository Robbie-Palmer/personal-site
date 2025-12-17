import { Skeleton } from "@/components/ui/skeleton";

export function ProjectTabsSkeleton() {
  return (
    <div className="w-full">
      {/* Tab list */}
      <div className="inline-flex h-auto p-1 bg-muted rounded-md gap-1">
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[250px]" />
      </div>

      {/* Content area */}
      <div className="mt-4 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
