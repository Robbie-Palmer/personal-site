"use client";

import dynamic from "next/dynamic";
import type { ForceGraphData } from "@/lib/api/force-graph-data";

const ForceGraphClient = dynamic(
  () =>
    import("@/components/technology/force-graph-client").then(
      (mod) => mod.ForceGraphClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] sm:aspect-[16/9] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading graph...</p>
      </div>
    ),
  },
);

export function LazyForceGraphClient({ data }: { data: ForceGraphData }) {
  return <ForceGraphClient data={data} />;
}
