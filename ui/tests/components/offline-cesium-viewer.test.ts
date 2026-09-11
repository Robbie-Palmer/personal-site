import { describe, expect, it, vi } from "vitest";
import type { CesiumRuntime } from "@/components/technology/cesium/cesium-runtime";
import { createOfflineCesiumViewer } from "@/components/technology/cesium/offline-viewer";

describe("offline Cesium viewer", () => {
  it("uses conservative WebGL settings for mobile compatibility", () => {
    const container = document.createElement("div");
    const setView = vi.fn();
    let viewerOptions: Record<string, unknown> | undefined;

    class Viewer {
      camera = { setView };
      scene = {
        globe: { showGroundAtmosphere: false },
        highDynamicRange: true,
      };

      constructor(_container: HTMLElement, options: Record<string, unknown>) {
        viewerOptions = options;
      }
    }

    const cesium = {
      buildModuleUrl: vi.fn((path: string) => `/cesium/${path}`),
      Cartesian3: { fromDegrees: vi.fn(() => "camera-position") },
      EllipsoidTerrainProvider: class {},
      ImageryLayer: { fromProviderAsync: vi.fn(() => "base-layer") },
      TileMapServiceImageryProvider: {
        fromUrl: vi.fn(() => Promise.resolve("imagery-provider")),
      },
      Viewer,
    } as unknown as CesiumRuntime;

    createOfflineCesiumViewer(container, cesium);

    expect(viewerOptions).toEqual(
      expect.objectContaining({
        contextOptions: {
          webgl: {
            antialias: false,
            powerPreference: "default",
          },
        },
        msaaSamples: 1,
        orderIndependentTranslucency: false,
        useBrowserRecommendedResolution: true,
      }),
    );
    expect(setView).toHaveBeenCalledWith({ destination: "camera-position" });
  });
});
