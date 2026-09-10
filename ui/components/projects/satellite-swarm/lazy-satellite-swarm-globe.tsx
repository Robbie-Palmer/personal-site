"use client";

import dynamic from "next/dynamic";

export const LazySatelliteSwarmGlobe = dynamic(
  () => {
    (
      window as typeof window & {
        CESIUM_BASE_URL: string;
      }
    ).CESIUM_BASE_URL = "/cesium/";
    return import("./satellite-swarm-globe").then(
      (module) => module.SatelliteSwarmGlobe,
    );
  },
  {
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading globe...
      </div>
    ),
    ssr: false,
  },
);
