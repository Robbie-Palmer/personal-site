import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { metadata } from "@/app/satellite-swarm/layout";
import SatelliteSwarmPage from "@/app/satellite-swarm/page";

vi.mock(
  "@/components/projects/satellite-swarm/deferred-satellite-swarm-simulation",
  () => ({
    DeferredSatelliteSwarmSimulation: () => <div>Cesium mission replay</div>,
  }),
);

describe("satellite swarm project space", () => {
  it("introduces the C++ WebAssembly simulation and Cesium view", () => {
    render(<SatelliteSwarmPage />);

    expect(
      screen.getByRole("heading", { name: "Autonomic Satellite Swarm" }),
    ).toBeVisible();
    expect(screen.getByText("Cesium mission replay")).toBeVisible();
    expect(screen.getByText(/executes as WebAssembly/i)).toBeVisible();
    expect(screen.getByText(/Emscripten compiles/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open simulation/i }),
    ).toHaveAttribute("href", "#simulation");
  });

  it("publishes route metadata", () => {
    expect(metadata.description).toContain("CesiumJS globe");
  });
});
