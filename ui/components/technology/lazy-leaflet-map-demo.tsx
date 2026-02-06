"use client";

import dynamic from "next/dynamic";

const LeafletMapDemo = dynamic(
  () =>
    import("@/components/technology/leaflet-map-demo").then(
      (mod) => mod.LeafletMapDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] sm:aspect-[16/9] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  },
);

export function LazyLeafletMapDemo() {
  return <LeafletMapDemo />;
}
