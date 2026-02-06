"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
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
const DEFAULT_CENTER = { lat: 54.5973, lng: -5.9301 };
const DEFAULT_ZOOM = 13;

export function LeafletMapDemo() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;

      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      const layer = L.tileLayer(TILE_LAYERS[0].url, {
        attribution: TILE_LAYERS[0].attribution,
        maxZoom: 18,
      }).addTo(map);

      // Fix default marker icon paths for bundled environments
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng])
        .addTo(map)
        .bindPopup("Belfast, Northern Ireland")
        .openPopup();

      leafletMapRef.current = map;
      tileLayerRef.current = layer;
      setIsLoaded(true);
    }

    init();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;

    const selected = TILE_LAYERS[activeLayer];
    if (!selected) return;
    tileLayerRef.current.setUrl(selected.url);
    tileLayerRef.current.options.attribution = selected.attribution;
    leafletMapRef.current.attributionControl.removeAttribution("");

    // Force attribution refresh
    tileLayerRef.current.remove();

    import("leaflet").then((L) => {
      if (!leafletMapRef.current) return;
      const newLayer = L.default
        .tileLayer(selected.url, {
          attribution: selected.attribution,
          maxZoom: 18,
        })
        .addTo(leafletMapRef.current);
      tileLayerRef.current = newLayer;
    });
  }, [activeLayer]);

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
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" />
      </div>
    </Card>
  );
}
