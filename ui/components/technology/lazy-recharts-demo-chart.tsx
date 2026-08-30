"use client";

import dynamic from "next/dynamic";

const RechartsDemoChart = dynamic(
  () =>
    import("@/components/technology/recharts-demo-chart").then(
      (mod) => mod.RechartsDemoChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 w-full items-center justify-center rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">Loading charts...</p>
      </div>
    ),
  },
);

export function LazyRechartsDemoChart() {
  return <RechartsDemoChart />;
}
