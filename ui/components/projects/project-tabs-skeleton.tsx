import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectTabsSkeleton() {
  return (
    <div className="w-full">
      {/* Tab list - matches ProjectsPageTabs styling */}
      <div className="inline-flex h-auto p-1 bg-muted rounded-md gap-1">
        <Skeleton className="h-8 w-37.5 rounded-sm" />
        <Skeleton className="h-8 w-50 rounded-sm" />
      </div>

      {/* Projects content skeleton (default tab) */}
      <div className="mt-6">
        <CardGridSkeleton />
      </div>
    </div>
  );
}
