export interface CesiumReferencePoint {
  id: string;
  label: string;
  latitudeDegrees: number;
  longitudeDegrees: number;
}

export const CESIUM_REFERENCE_POINTS: readonly CesiumReferencePoint[] = [
  {
    id: "belfast",
    label: "Belfast",
    latitudeDegrees: 54.5973,
    longitudeDegrees: -5.9301,
  },
  {
    id: "vancouver",
    label: "Vancouver",
    latitudeDegrees: 49.2827,
    longitudeDegrees: -123.1207,
  },
  {
    id: "singapore",
    label: "Singapore",
    latitudeDegrees: 1.3521,
    longitudeDegrees: 103.8198,
  },
  {
    id: "cape-town",
    label: "Cape Town",
    latitudeDegrees: -33.9249,
    longitudeDegrees: 18.4241,
  },
] as const;
