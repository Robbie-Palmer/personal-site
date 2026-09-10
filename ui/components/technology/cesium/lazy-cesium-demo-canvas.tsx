"use client";

import dynamic from "next/dynamic";

export const LazyCesiumDemoCanvas = dynamic(
  () =>
    import("./cesium-demo-canvas").then((module) => module.CesiumDemoCanvas),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading globe...
      </div>
    ),
    ssr: false,
  },
);
