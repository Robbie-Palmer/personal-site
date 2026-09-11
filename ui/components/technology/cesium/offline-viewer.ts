import type { Viewer } from "cesium";
import type { CesiumRuntime } from "./cesium-runtime";

function createViewer(
  container: HTMLElement,
  cesium: CesiumRuntime,
  requestWebgl1: boolean,
): Viewer {
  const {
    buildModuleUrl,
    EllipsoidTerrainProvider,
    ImageryLayer,
    TileMapServiceImageryProvider,
    Viewer,
  } = cesium;
  return new Viewer(container, {
    animation: false,
    baseLayer: ImageryLayer.fromProviderAsync(
      TileMapServiceImageryProvider.fromUrl(
        buildModuleUrl("Assets/Textures/NaturalEarthII"),
      ),
    ),
    baseLayerPicker: false,
    contextOptions: {
      ...(requestWebgl1 ? { requestWebgl1: true } : {}),
      webgl: {
        antialias: false,
        powerPreference: "default",
      },
    },
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    msaaSamples: 1,
    navigationHelpButton: false,
    orderIndependentTranslucency: false,
    requestRenderMode: true,
    scene3DOnly: true,
    sceneModePicker: false,
    selectionIndicator: false,
    shouldAnimate: false,
    skyBox: false,
    terrainProvider: new EllipsoidTerrainProvider(),
    timeline: false,
    useBrowserRecommendedResolution: true,
  });
}

export function createOfflineCesiumViewer(
  container: HTMLElement,
  cesium: CesiumRuntime,
): Viewer {
  const { Cartesian3 } = cesium;
  let viewer: Viewer;
  try {
    viewer = createViewer(container, cesium, false);
  } catch (webgl2Error) {
    container.replaceChildren();
    try {
      viewer = createViewer(container, cesium, true);
    } catch (webgl1Error) {
      throw new AggregateError(
        [webgl2Error, webgl1Error],
        "The browser could not create a Cesium WebGL context",
      );
    }
  }
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.highDynamicRange = false;
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(5, 18, 18_500_000),
  });
  return viewer;
}
