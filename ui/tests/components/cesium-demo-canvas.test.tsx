import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CesiumDemoCanvas } from "@/components/technology/cesium/cesium-demo-canvas";

const runtimeMocks = vi.hoisted(() => ({
  createViewer: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/components/technology/cesium/cesium-runtime", () => ({
  loadCesiumRuntime: runtimeMocks.load,
}));

vi.mock("@/components/technology/cesium/offline-viewer", () => ({
  createOfflineCesiumViewer: runtimeMocks.createViewer,
}));

function createHarness(supportsLabels = true) {
  const add = vi.fn();
  const destroy = vi.fn();
  const flyTo = vi.fn();
  const requestRender = vi.fn();
  const fromDegrees = vi.fn((...coordinates: number[]) => coordinates);
  const fromDegreesArray = vi.fn((coordinates: number[]) => coordinates);
  const color = { withAlpha: vi.fn((alpha: number) => ({ alpha })) };
  const viewer = {
    camera: { flyTo },
    destroy,
    entities: { add },
    isDestroyed: vi.fn(() => false),
    scene: { requestRender },
  };
  const runtime = {
    Cartesian2: class {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}
    },
    Cartesian3: { fromDegrees, fromDegreesArray },
    Color: {
      BLACK: "black",
      WHITE: "white",
      fromCssColorString: vi.fn(() => color),
    },
    FeatureDetection: { supportsWebgl2: vi.fn(() => supportsLabels) },
    HorizontalOrigin: { LEFT: "left" },
    LabelStyle: { FILL_AND_OUTLINE: "fill-and-outline" },
    VerticalOrigin: { CENTER: "center" },
  };
  runtimeMocks.load.mockResolvedValue(runtime);
  runtimeMocks.createViewer.mockReturnValue(viewer);
  return { add, destroy, flyTo, requestRender, runtime, viewer };
}

describe("CesiumDemoCanvas", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("draws the reference points and moves the camera", async () => {
    const harness = createHarness();
    const onFailure = vi.fn();
    const { rerender, unmount } = render(
      <CesiumDemoCanvas
        onFailure={onFailure}
        reducedMotion={false}
        selectedPointId={null}
      />,
    );

    await waitFor(() => expect(harness.requestRender).toHaveBeenCalledOnce());
    expect(harness.add).toHaveBeenCalledTimes(5);
    expect(harness.add.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ id: "belfast", label: expect.any(Object) }),
    );
    expect(harness.flyTo).toHaveBeenLastCalledWith({
      destination: [5, 18, 19_500_000],
      duration: 1.2,
    });

    rerender(
      <CesiumDemoCanvas
        onFailure={onFailure}
        reducedMotion
        selectedPointId="singapore"
      />,
    );
    await waitFor(() =>
      expect(harness.flyTo).toHaveBeenLastCalledWith({
        destination: [103.8198, 1.3521, 5_500_000],
        duration: 0,
      }),
    );

    unmount();
    expect(harness.destroy).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("omits labels on the WebGL 1 fallback", async () => {
    const harness = createHarness(false);
    render(
      <CesiumDemoCanvas
        onFailure={vi.fn()}
        reducedMotion={false}
        selectedPointId="unknown"
      />,
    );

    await waitFor(() => expect(harness.requestRender).toHaveBeenCalledOnce());
    expect(harness.add.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ label: undefined }),
    );
  });

  it("reports runtime startup failures", async () => {
    const error = new Error("runtime unavailable");
    runtimeMocks.load.mockRejectedValue(error);
    const onFailure = vi.fn();

    render(
      <CesiumDemoCanvas
        onFailure={onFailure}
        reducedMotion={false}
        selectedPointId={null}
      />,
    );

    await waitFor(() => expect(onFailure).toHaveBeenCalledWith(error));
    expect(runtimeMocks.createViewer).not.toHaveBeenCalled();
  });
});
