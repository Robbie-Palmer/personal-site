import {
  buildModuleUrl,
  Cartesian3,
  EllipsoidTerrainProvider,
  ImageryLayer,
  TileMapServiceImageryProvider,
  Viewer,
} from "cesium";

export function createOfflineCesiumViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    animation: false,
    baseLayer: ImageryLayer.fromProviderAsync(
      TileMapServiceImageryProvider.fromUrl(
        buildModuleUrl("Assets/Textures/NaturalEarthII"),
      ),
    ),
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    requestRenderMode: true,
    scene3DOnly: true,
    sceneModePicker: false,
    selectionIndicator: false,
    shouldAnimate: false,
    skyBox: false,
    terrainProvider: new EllipsoidTerrainProvider(),
    timeline: false,
  });
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.highDynamicRange = false;
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(5, 18, 18_500_000),
  });
  return viewer;
}
