import "leaflet";

declare module "leaflet" {
  namespace Control {
    class Fullscreen extends Control<FullscreenControlOptions> {
      constructor(options?: FullscreenControlOptions);
    }
  }
}
