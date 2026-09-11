import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredSatelliteSwarmSimulation } from "@/components/projects/satellite-swarm/deferred-satellite-swarm-simulation";
import { SatelliteSwarmSimulation } from "@/components/projects/satellite-swarm/satellite-swarm-simulation";
import { parseSatelliteSwarmSimulation } from "@/lib/api/satellite-swarm-simulation";

const globeState = vi.hoisted(() => ({
  onFailure: null as ((error: unknown) => void) | null,
}));

let intersectionCallback: IntersectionObserverCallback;
const disconnect = vi.fn();
const observe = vi.fn();

vi.mock(
  "@/components/projects/satellite-swarm/lazy-satellite-swarm-globe",
  () => ({
    LazySatelliteSwarmGlobe: ({
      onFailure,
    }: {
      onFailure: (error: unknown) => void;
    }) => {
      globeState.onFailure = onFailure;
      return <div>Cesium globe</div>;
    },
  }),
);

const data = parseSatelliteSwarmSimulation({
  schemaVersion: 1,
  traceVersion: 1,
  scenario: "test",
  source: "native C++ SimulationTrace",
  positionModel: "scripted simulation data; not orbit propagation",
  objective: { longitudeDegrees: 0, latitudeDegrees: -90 },
  frames: [
    {
      timeMs: 0,
      nodes: [
        {
          id: 0,
          state: "leading",
          position: { longitudeDegrees: 0, latitudeDegrees: 10 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 60,
          missionId: 1,
          assignedNode: null,
        },
        {
          id: 1,
          state: "awaiting assignment",
          position: { longitudeDegrees: 1, latitudeDegrees: 0 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 81,
          missionId: 1,
          assignedNode: null,
        },
      ],
    },
    {
      timeMs: 100,
      nodes: [
        {
          id: 0,
          state: "idle",
          position: { longitudeDegrees: 0, latitudeDegrees: 9 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 60,
          missionId: 1,
          assignedNode: 1,
        },
        {
          id: 1,
          state: "active",
          position: { longitudeDegrees: 1, latitudeDegrees: -1 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 81,
          missionId: 1,
          assignedNode: 1,
        },
      ],
    },
  ],
  events: [
    {
      type: "message-sent",
      timeMs: 0,
      nodeId: 1,
      message: {
        type: "candidacy",
        origin: 1,
        target: 0,
        missionId: 1,
        score: 81,
      },
    },
    {
      type: "message-sent",
      timeMs: 100,
      nodeId: 0,
      message: {
        type: "mission-assignment",
        origin: 0,
        target: 1,
        missionId: 1,
        score: 0,
      },
    },
  ],
});

describe("SatelliteSwarmSimulation", () => {
  beforeEach(() => {
    disconnect.mockClear();
    observe.mockClear();
  });

  afterEach(() => {
    globeState.onFailure = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads and validates the checked native fixture at the project boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => data,
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<DeferredSatelliteSwarmSimulation />);

    expect(await screen.findByText("trace v1 · 0 ms")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/simulations/autonomic-satellite-swarm/demonstration.v1.json",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("aborts the native fixture request when unmounted", () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );
    vi.stubGlobal("IntersectionObserver", undefined);

    const { unmount } = render(<DeferredSatelliteSwarmSimulation />);
    expect(requestSignal?.aborted).toBe(false);

    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("keeps the replay mounted after its first intersection", async () => {
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      disconnect() {
        disconnect();
      }

      observe(target: Element) {
        observe(target);
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => data, ok: true }),
    );

    render(<DeferredSatelliteSwarmSimulation />);

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByText("trace v1 · 0 ms")).toBeVisible();
    expect(disconnect).toHaveBeenCalledOnce();

    act(() => {
      intersectionCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByText("trace v1 · 0 ms")).toBeVisible();
  });

  it("steps through the native state and event record", async () => {
    const user = userEvent.setup();
    render(<SatelliteSwarmSimulation data={data} />);

    expect(screen.getByText("South Pole mission replay")).toBeVisible();
    expect(screen.getByText(/deliberate coordinate edge case/i)).toBeVisible();
    expect(screen.getByText("Cesium globe")).toBeVisible();
    expect(
      document.querySelector(
        'link[href="/cesium/Widgets/widgets.css"][rel="stylesheet"]',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("awaiting assignment")).toBeVisible();
    expect(screen.queryByText(/assigned mission 1/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next frame" }));

    expect(screen.getByText("active")).toBeVisible();
    expect(screen.getByText(/assigned mission 1 to node 1/i)).toBeVisible();
    expect(screen.getByText("trace v1 · 100 ms")).toBeVisible();
  });

  it("disables autoplay when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    });

    render(<SatelliteSwarmSimulation data={data} />);

    expect(screen.getByRole("button", { name: "Play replay" })).toBeDisabled();
    expect(screen.getByText(/autoplay is off/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Next frame" })).toBeEnabled();
  });

  it("stops playback when reduced motion becomes active", async () => {
    let reducedMotion = false;
    let changeListener: (() => void) | undefined;
    vi.spyOn(window, "matchMedia").mockReturnValue({
      get matches() {
        return reducedMotion;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn((_event, listener) => {
        changeListener = listener as () => void;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    });
    const user = userEvent.setup();

    render(<SatelliteSwarmSimulation data={data} />);
    await user.click(screen.getByRole("button", { name: "Play replay" }));
    expect(screen.getByRole("button", { name: "Pause replay" })).toBeEnabled();

    act(() => {
      reducedMotion = true;
      changeListener?.();
    });

    expect(screen.getByRole("button", { name: "Play replay" })).toBeDisabled();
  });

  it("shows the globe startup error and offers a retry", async () => {
    const user = userEvent.setup();
    render(<SatelliteSwarmSimulation data={data} />);

    act(() => {
      globeState.onFailure?.(new Error("Both WebGL contexts failed"));
    });

    expect(screen.getByText(/Both WebGL contexts failed/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Retry globe" }));

    expect(screen.getByText("Cesium globe")).toBeVisible();
  });
});
