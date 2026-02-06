"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Card } from "@/components/ui/card";

const TILE_LAYERS = [
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
  {
    name: "CartoDB Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    name: "CartoDB Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
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
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              key={selectedLayer.name}
              attribution={selectedLayer.attribution}
              url={selectedLayer.url}
              maxZoom={18}
            />
            <Marker position={DEFAULT_CENTER}>
              <Popup>Belfast, Northern Ireland</Popup>
            </Marker>
          </MapContainer>
        )}
      </div>
    </Card>
  );
}
