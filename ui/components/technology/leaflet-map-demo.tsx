"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-fullscreen";
import "leaflet-fullscreen/dist/leaflet.fullscreen.css";
import { useEffect, useState } from "react";
import {
  AttributionControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Card } from "@/components/ui/card";

const TILE_LAYERS = [
  {
    name: "CPTAC-COAD Slide",
    url: "https://tiles.robbiepalmer.me/cptac_coad/01CO001/1dd2f639-19f0-4e0f-ae0a-316c8544ee73/{z}/{x}/{y}.png?2026-02",
    attribution:
      "Clunie et al. (2024), <a href=https://doi.org/10.5281/ZENODO.12666784>Zenodo</a> | License: <a href=https://creativecommons.org/licenses/by/3.0/>CC BY 3.0</a>",
    crs: L.CRS.Simple,
    minZoom: 0,
    maxZoom: 8,
    tileSize: 256,
    noWrap: true,
    center: [-64, 64] as [number, number],
    zoom: 2,
    maxBounds: [
      [64, -128],
      [-256, 256],
    ],
    maxBoundsViscosity: 1.0,
  },
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    crs: L.CRS.EPSG3857,
  },
  {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    crs: L.CRS.EPSG3857,
  },
  {
    name: "CartoDB Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    crs: L.CRS.EPSG3857,
  },
  {
    name: "CartoDB Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    crs: L.CRS.EPSG3857,
  },
] as const;

// Default center: Belfast, Northern Ireland
const DEFAULT_CENTER: [number, number] = [54.5973, -5.9301];
const DEFAULT_ZOOM = 13;

// Fix default marker icon paths for bundled environments
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FullscreenControl() {
  const map = useMap();

  useEffect(() => {
    if ((!L.Control as any).Fullscreen) return;
    const fullscreenControl = new (L.Control as any).Fullscreen({
      position: "topleft",
      title: {
        false: "Enter Fullscreen",
        true: "Exit Fullscreen",
      },
    });

    map.addControl(fullscreenControl);

    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFullscreen =
        doc.fullscreenElement ||
        doc.mozFullScreenElement ||
        doc.webkitFullscreenElement ||
        doc.msFullscreenElement;

      if (fullscreenControl.link) {
        fullscreenControl.link.title = isFullscreen
          ? "Exit Fullscreen"
          : "Enter Fullscreen";
      }
    };

    const events = [
      "fullscreenchange",
      "mozfullscreenchange",
      "webkitfullscreenchange",
      "MSFullscreenChange",
    ];

    events.forEach((event) => {
      document.addEventListener(event, handleFullscreenChange);
    });

    return () => {
      map.removeControl(fullscreenControl);
      events.forEach((event) => {
        document.removeEventListener(event, handleFullscreenChange);
      });
    };
  }, [map]);

  return null;
}

export function LeafletMapDemo() {
  const [activeLayer, setActiveLayer] = useState(0);
  const selectedLayer = TILE_LAYERS[activeLayer];

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3 space-y-3">
        <h3 className="text-lg font-semibold">Interactive Map Demo</h3>
        <p className="text-sm text-muted-foreground">
          Explore different open tile providers by switching layers below. Pan,
          zoom, and interact with the map.
        </p>
        <div className="flex flex-wrap gap-2">
          {TILE_LAYERS.map((layer, i) => (
            <button
              key={layer.name}
              type="button"
              onClick={() => setActiveLayer(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                i === activeLayer
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {layer.name}
            </button>
          ))}
        </div>
      </div>
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9]">
        {selectedLayer && (
          <MapContainer
            key={`map-${activeLayer}`} // Force re-mount when switching layers (especially for CRS changes)
            center={
              "center" in selectedLayer ? selectedLayer.center : DEFAULT_CENTER
            }
            zoom={"zoom" in selectedLayer ? selectedLayer.zoom : DEFAULT_ZOOM}
            crs={selectedLayer.crs}
            scrollWheelZoom={true}
            className="h-full w-full"
            maxBounds={
              "maxBounds" in selectedLayer
                ? (selectedLayer.maxBounds as any)
                : undefined
            }
            maxBoundsViscosity={
              "maxBoundsViscosity" in selectedLayer
                ? selectedLayer.maxBoundsViscosity
                : 1.0
            }
            bounceAtZoomLimits={false}
            attributionControl={false}
          >
            <TileLayer
              key={selectedLayer.name}
              attribution={selectedLayer.attribution}
              url={selectedLayer.url}
              maxZoom={"maxZoom" in selectedLayer ? selectedLayer.maxZoom : 18}
              minZoom={"minZoom" in selectedLayer ? selectedLayer.minZoom : 0}
              tileSize={
                "tileSize" in selectedLayer ? selectedLayer.tileSize : 256
              }
              noWrap={"noWrap" in selectedLayer ? selectedLayer.noWrap : false}
              keepBuffer={8}
              updateInterval={200}
            />
            <AttributionControl prefix={false} />
            {selectedLayer.crs === L.CRS.EPSG3857 && (
              <Marker position={DEFAULT_CENTER}>
                <Popup>Belfast, Northern Ireland</Popup>
              </Marker>
            )}
            <FullscreenControl />
          </MapContainer>
        )}
      </div>
    </Card>
  );
}
