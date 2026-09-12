"use client";

import type { Viewer } from "cesium";
import { useEffect, useRef, useState } from "react";
import {
  CESIUM_REFERENCE_POINTS,
  type CesiumReferencePoint,
} from "./cesium-demo-data";
import type { CesiumRuntime } from "./cesium-runtime";
import { loadCesiumRuntime } from "./cesium-runtime";
import { createOfflineCesiumViewer } from "./offline-viewer";

const GLOBAL_CAMERA_HEIGHT_METRES = 19_500_000;
const LOCAL_CAMERA_HEIGHT_METRES = 5_500_000;

function findPoint(id: string): CesiumReferencePoint | undefined {
  return CESIUM_REFERENCE_POINTS.find((point) => point.id === id);
}

export interface CesiumDemoCanvasProps {
  onFailure: (error: unknown) => void;
  reducedMotion: boolean;
  selectedPointId: string | null;
}

export function CesiumDemoCanvas({
  onFailure,
  reducedMotion,
  selectedPointId,
}: Readonly<CesiumDemoCanvasProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cesiumRef = useRef<CesiumRuntime | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    let viewer: Viewer | undefined;
    loadCesiumRuntime()
      .then((cesium) => {
        if (!active) return;
        const {
          Cartesian2,
          Cartesian3,
          Color,
          FeatureDetection,
          HorizontalOrigin,
          LabelStyle,
          VerticalOrigin,
        } = cesium;
        viewer = createOfflineCesiumViewer(container, cesium);
        const supportsLabels = FeatureDetection.supportsWebgl2(viewer.scene);
        cesiumRef.current = cesium;
        viewerRef.current = viewer;

        for (const point of CESIUM_REFERENCE_POINTS) {
          viewer.entities.add({
            id: point.id,
            label: supportsLabels
              ? {
                  fillColor: Color.WHITE,
                  font: "600 14px sans-serif",
                  horizontalOrigin: HorizontalOrigin.LEFT,
                  outlineColor: Color.BLACK,
                  outlineWidth: 3,
                  pixelOffset: new Cartesian2(12, 0),
                  style: LabelStyle.FILL_AND_OUTLINE,
                  text: point.label,
                  verticalOrigin: VerticalOrigin.CENTER,
                }
              : undefined,
            point: {
              color: Color.fromCssColorString("#38bdf8"),
              outlineColor: Color.WHITE,
              outlineWidth: 2,
              pixelSize: 11,
            },
            position: Cartesian3.fromDegrees(
              point.longitudeDegrees,
              point.latitudeDegrees,
            ),
          });
        }

        viewer.entities.add({
          polyline: {
            material: Color.fromCssColorString("#38bdf8").withAlpha(0.6),
            positions: Cartesian3.fromDegreesArray(
              CESIUM_REFERENCE_POINTS.flatMap((point) => [
                point.longitudeDegrees,
                point.latitudeDegrees,
              ]),
            ),
            width: 2,
          },
        });
        viewer.scene.requestRender();
        setViewerReady(true);
      })
      .catch((error: unknown) => {
        if (active) onFailure(error);
      });

    return () => {
      active = false;
      cesiumRef.current = null;
      viewerRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [onFailure]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const cesium = cesiumRef.current;
    if (!viewerReady || !viewer || !cesium) return;
    const { Cartesian3 } = cesium;
    const selected = selectedPointId ? findPoint(selectedPointId) : undefined;
    const destination = selected
      ? Cartesian3.fromDegrees(
          selected.longitudeDegrees,
          selected.latitudeDegrees,
          LOCAL_CAMERA_HEIGHT_METRES,
        )
      : Cartesian3.fromDegrees(5, 18, GLOBAL_CAMERA_HEIGHT_METRES);
    viewer.camera.flyTo({ destination, duration: reducedMotion ? 0 : 1.2 });
  }, [reducedMotion, selectedPointId, viewerReady]);

  return (
    <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
  );
}
