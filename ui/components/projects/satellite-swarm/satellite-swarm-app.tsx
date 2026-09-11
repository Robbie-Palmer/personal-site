import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeferredSatelliteSwarmSimulation } from "./deferred-satellite-swarm-simulation";

export function SatelliteSwarmApp() {
  return (
    <div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.13),transparent_32rem)]">
      <section className="container mx-auto max-w-7xl px-4 pt-16 pb-8 sm:pt-24 sm:pb-12">
        <div className="max-w-3xl space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
            Research prototype
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Autonomic Satellite Swarm
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Replay a deterministic three-node mission on a self-hosted CesiumJS
            globe. The browser currently reads a trace produced by the native
            C++ simulation. A later pass will run that same coordination code
            through WebAssembly.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="#simulation">
                Open simulation
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/Robbie-Palmer/personal-site/tree/main/cpp/autonomic-satellite-swarm"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                View C++ source
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="simulation"
        aria-labelledby="simulation-heading"
        className="scroll-mt-20 border-y bg-background/65"
      >
        <div className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="max-w-3xl space-y-2">
            <h2
              id="simulation-heading"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Native mission replay
            </h2>
            <p className="leading-7 text-muted-foreground">
              Step through the mission request, candidate scores, messages, and
              final assignment. The positions are scripted inputs for this
              demonstration, not propagated orbits.
            </p>
          </div>
          <DeferredSatelliteSwarmSimulation />
        </div>
      </section>

      <section className="container mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:py-16 md:grid-cols-2">
        <div className="rounded-xl border bg-card/60 p-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Running now
          </p>
          <h2 className="mb-3 text-xl font-semibold">CesiumJS presentation</h2>
          <p className="leading-7 text-muted-foreground">
            Cesium draws the Earth, node positions, message links, and mission
            objective from a checked native trace. Its imagery and runtime
            assets are served by this site, with no Cesium ion token.
          </p>
        </div>
        <div className="rounded-xl border bg-card/60 p-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Next integration
          </p>
          <h2 className="mb-3 text-xl font-semibold">
            C++ through WebAssembly
          </h2>
          <p className="leading-7 text-muted-foreground">
            Emscripten will compile the portable coordination core for a Web
            Worker. React will control and display it without copying mission
            selection or health-state logic into TypeScript.
          </p>
        </div>
      </section>
    </div>
  );
}
