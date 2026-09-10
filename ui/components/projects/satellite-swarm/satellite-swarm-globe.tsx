"use client";

import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  Ellipsoid,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useRef } from "react";
import { createOfflineCesiumViewer } from "@/components/technology/cesium/offline-viewer";
import type {
  SatelliteSwarmEvent,
  SatelliteSwarmFrame,
  SatelliteSwarmSimulation,
} from "@/lib/api/satellite-swarm-simulation";

const STATE_COLORS: Record<string, Color> = {
  active: Color.fromCssColorString("#22c55e"),
  "awaiting acknowledgement": Color.fromCssColorString("#f59e0b"),
  "awaiting assignment": Color.fromCssColorString("#eab308"),
  idle: Color.fromCssColorString("#94a3b8"),
  leading: Color.fromCssColorString("#38bdf8"),
  quiescent: Color.fromCssColorString("#a78bfa"),
  "safe-disabled": Color.fromCssColorString("#ef4444"),
};

const EARTH_RADIUS_METRES = Ellipsoid.WGS84.maximumRadius;

function altitude(frame: SatelliteSwarmFrame, nodeId: number): number {
  const node = frame.nodes.find((candidate) => candidate.id === nodeId);
  return Math.max(
    100_000,
    (node?.orbitalRadiusMetres ?? 0) - EARTH_RADIUS_METRES,
  );
}

function position(
  frame: SatelliteSwarmFrame,
  nodeId: number,
): Cartesian3 | null {
  const node = frame.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  return Cartesian3.fromDegrees(
    node.position.longitudeDegrees,
    node.position.latitudeDegrees,
    altitude(frame, nodeId),
  );
}

function addMessageLinks(
  viewer: Viewer,
  frame: SatelliteSwarmFrame,
  events: readonly SatelliteSwarmEvent[],
) {
  for (const event of events) {
    if (event.type !== "message-sent") continue;
    const sender = position(frame, event.nodeId);
    if (!sender) continue;
    const targets =
      event.message.target === null
        ? frame.nodes
            .filter((node) => node.id !== event.nodeId)
            .map((node) => node.id)
        : [event.message.target];

    for (const targetId of targets) {
      const target = position(frame, targetId);
      const targetNode = frame.nodes.find((node) => node.id === targetId);
      const senderNode = frame.nodes.find((node) => node.id === event.nodeId);
      if (!target || !targetNode || !senderNode) continue;
      const middle = Cartesian3.fromDegrees(
        (senderNode.position.longitudeDegrees +
          targetNode.position.longitudeDegrees) /
          2,
        (senderNode.position.latitudeDegrees +
          targetNode.position.latitudeDegrees) /
          2,
        Math.max(altitude(frame, event.nodeId), altitude(frame, targetId)) +
          350_000,
      );
      viewer.entities.add({
        polyline: {
          arcType: ArcType.NONE,
          material: Color.WHITE.withAlpha(0.72),
          positions: [sender, middle, target],
          width: 2,
        },
      });
    }
  }
}

export interface SatelliteSwarmGlobeProps {
  currentFrameIndex: number;
  data: SatelliteSwarmSimulation;
  events: readonly SatelliteSwarmEvent[];
  onFailure: () => void;
  selectedNodeId: number;
}

export function SatelliteSwarmGlobe({
  currentFrameIndex,
  data,
  events,
  onFailure,
  selectedNodeId,
}: Readonly<SatelliteSwarmGlobeProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let viewer: Viewer;
    try {
      viewer = createOfflineCesiumViewer(container);
    } catch {
      onFailure();
      return;
    }

    viewerRef.current = viewer;
    return () => {
      viewerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [onFailure]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const frame = data.frames[currentFrameIndex];
    if (!viewer || !frame) return;

    viewer.entities.removeAll();
    for (const node of frame.nodes) {
      const nodeColor = STATE_COLORS[node.state] ?? Color.WHITE;
      const selected = node.id === selectedNodeId;
      viewer.entities.add({
        id: `node-${node.id}`,
        label: {
          distanceDisplayCondition: undefined,
          fillColor: Color.WHITE,
          font: selected ? "600 16px sans-serif" : "500 14px sans-serif",
          horizontalOrigin: HorizontalOrigin.LEFT,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cartesian2(14, 0),
          scaleByDistance: new NearFarScalar(1_000_000, 1, 30_000_000, 0.7),
          style: LabelStyle.FILL_AND_OUTLINE,
          text: `Node ${node.id} · ${node.state}`,
          verticalOrigin: VerticalOrigin.CENTER,
        },
        point: {
          color: nodeColor,
          outlineColor: selected ? Color.WHITE : Color.BLACK,
          outlineWidth: selected ? 3 : 1,
          pixelSize: selected ? 15 : 11,
        },
        position: Cartesian3.fromDegrees(
          node.position.longitudeDegrees,
          node.position.latitudeDegrees,
          Math.max(100_000, node.orbitalRadiusMetres - EARTH_RADIUS_METRES),
        ),
      });

      const trackPositions = data.frames
        .slice(0, currentFrameIndex + 1)
        .flatMap((candidateFrame) => {
          const candidate = candidateFrame.nodes.find(
            (candidateNode) => candidateNode.id === node.id,
          );
          return candidate
            ? [
                candidate.position.longitudeDegrees,
                candidate.position.latitudeDegrees,
                Math.max(
                  100_000,
                  candidate.orbitalRadiusMetres - EARTH_RADIUS_METRES,
                ),
              ]
            : [];
        });
      if (trackPositions.length >= 6) {
        viewer.entities.add({
          polyline: {
            material: nodeColor.withAlpha(0.55),
            positions: Cartesian3.fromDegreesArrayHeights(trackPositions),
            width: selected ? 3 : 1.5,
          },
        });
      }
    }

    viewer.entities.add({
      ellipse: {
        height: 0,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        material: Color.fromCssColorString("#f43f5e").withAlpha(0.32),
        outline: true,
        outlineColor: Color.fromCssColorString("#fb7185"),
        semiMajorAxis: 250_000,
        semiMinorAxis: 250_000,
      },
      label: {
        fillColor: Color.WHITE,
        font: "600 14px sans-serif",
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        pixelOffset: new Cartesian2(0, -22),
        style: LabelStyle.FILL_AND_OUTLINE,
        text: "Mission objective",
      },
      position: Cartesian3.fromDegrees(
        data.objective.longitudeDegrees,
        data.objective.latitudeDegrees,
      ),
    });
    addMessageLinks(viewer, frame, events);
    viewer.scene.requestRender();
  }, [currentFrameIndex, data, events, selectedNodeId]);

  return (
    <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
  );
}
