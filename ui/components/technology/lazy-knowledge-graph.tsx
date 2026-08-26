"use client";

import dynamic from "next/dynamic";
import type { GraphData } from "@/lib/api/graph-data";

const CosmosGraphClient = dynamic(
  () =>
    import("@/components/technology/cosmos-graph-client").then(
      (mod) => mod.CosmosGraphClient,
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

export function LazyKnowledgeGraph({ data }: Readonly<{ data: GraphData }>) {
  return <CosmosGraphClient data={data} />;
}
