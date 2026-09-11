"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  parseSatelliteSwarmSimulation,
  type SatelliteSwarmSimulation as SimulationData,
} from "@/lib/api/satellite-swarm-simulation";
import { SatelliteSwarmSimulation } from "./satellite-swarm-simulation";

const FIXTURE_URL =
  "/simulations/autonomic-satellite-swarm/demonstration.v1.json";

function Placeholder({ failed }: Readonly<{ failed: boolean }>) {
  return (
    <Card
      className="not-prose my-8 gap-0 overflow-hidden p-0"
      aria-live="polite"
    >
      <div className="space-y-1 border-b p-4">
        <h3 className="text-lg font-semibold">Three-node mission replay</h3>
        <p className="text-sm text-muted-foreground">
          {failed
            ? "The simulation record could not be loaded."
            : "Loading the native simulation record..."}
        </p>
      </div>
      <div className="flex h-72 items-center justify-center bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {failed
          ? "The project description and source remain available below."
          : "The globe loads when this section approaches the viewport."}
      </div>
    </Card>
  );
}

export function DeferredSatelliteSwarmSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SimulationData | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let requested = false;

    const load = () => {
      if (requested) return;
      requested = true;
      fetch(FIXTURE_URL)
        .then((response) => {
          if (!response.ok) throw new Error("Simulation request failed");
          return response.json() as Promise<unknown>;
        })
        .then((value) => {
          if (active) setData(parseSatelliteSwarmSimulation(value));
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      load();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        load();
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(container);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} aria-busy={!data && !failed}>
      {data && visible ? (
        <SatelliteSwarmSimulation data={data} />
      ) : (
        <Placeholder failed={failed} />
      )}
    </div>
  );
}
