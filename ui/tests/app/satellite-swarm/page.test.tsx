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
  it("introduces the native replay and the planned WebAssembly boundary", () => {
    render(<SatelliteSwarmPage />);

    expect(
      screen.getByRole("heading", { name: "Autonomic Satellite Swarm" }),
    ).toBeVisible();
    expect(screen.getByText("Cesium mission replay")).toBeVisible();
    expect(
      screen.getByText(/trace produced by the native C\+\+/i),
    ).toBeVisible();
    expect(screen.getByText(/Emscripten will compile/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open simulation/i }),
    ).toHaveAttribute("href", "#simulation");
  });

  it("publishes route metadata", () => {
    expect(metadata.description).toContain("CesiumJS globe");
  });
});
