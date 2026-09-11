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
      Credit: class {
        constructor(readonly html: string) {}
      },
      CreditDisplay: { cesiumCredit: { html: "default" } },
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
    expect(cesium.CreditDisplay.cesiumCredit).toEqual({ html: "" });
  });

  it("retries with WebGL 1 when WebGL 2 initialization fails", () => {
    const container = document.createElement("div");
    const attempts: Record<string, unknown>[] = [];
    const loseContext = vi.fn();

    class Viewer {
      camera = { setView: vi.fn() };
      scene = {
        globe: { showGroundAtmosphere: false },
        highDynamicRange: true,
      };

      constructor(target: HTMLElement, options: Record<string, unknown>) {
        attempts.push(options);
        if (attempts.length === 1) {
          const canvas = document.createElement("canvas");
          vi.spyOn(canvas, "getContext").mockReturnValue({
            getExtension: vi.fn(() => ({ loseContext })),
          } as unknown as WebGL2RenderingContext);
          target.appendChild(canvas);
          throw new Error("WebGL 2 initialization failed");
        }
      }
    }

    const cesium = {
      buildModuleUrl: vi.fn((path: string) => `/cesium/${path}`),
      Cartesian3: { fromDegrees: vi.fn(() => "camera-position") },
      Credit: class {
        constructor(readonly html: string) {}
      },
      CreditDisplay: { cesiumCredit: { html: "default" } },
      EllipsoidTerrainProvider: class {},
      ImageryLayer: { fromProviderAsync: vi.fn(() => "base-layer") },
      TileMapServiceImageryProvider: {
        fromUrl: vi.fn(() => Promise.resolve("imagery-provider")),
      },
      Viewer,
    } as unknown as CesiumRuntime;

    createOfflineCesiumViewer(container, cesium);

    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual(
      expect.objectContaining({
        contextOptions: expect.not.objectContaining({ requestWebgl1: true }),
      }),
    );
    expect(attempts[1]).toEqual(
      expect.objectContaining({
        contextOptions: expect.objectContaining({ requestWebgl1: true }),
      }),
    );
    expect(loseContext).toHaveBeenCalledOnce();
    expect(container).toBeEmptyDOMElement();
  });
});
