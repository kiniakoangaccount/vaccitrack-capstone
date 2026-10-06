"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapAnimal {
  id: number | string;
  name: string;
  species: string;
  owner: string;
  purok: string;
  vaccinated: boolean;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapPurok {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

// Path data lifted from lucide-react's Dog/Cat icons so map markers match the
// species icons used elsewhere in the app, rendered as raw SVG since Leaflet
// divIcon only accepts an HTML string, not a React component.
const DOG_MARKER_PATHS = [
  "M11.25 16.25h1.5L12 17z",
  "M16 14v.5",
  "M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309",
  "M8 14v.5",
  "M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5",
];
const CAT_MARKER_PATHS = [
  "M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z",
  "M8 14v.5",
  "M16 14v.5",
  "M11.25 16.25h1.5L12 17l-.75-.75Z",
];

function speciesMarkerSvg(species: string): string {
  const paths = species === "Cat" ? CAT_MARKER_PATHS : DOG_MARKER_PATHS;
  const d = paths.map((p) => `<path d="${p}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

export interface LeafletMapHandle {
  /** Smoothly pan/zoom the map to a coordinate, e.g. after a geolocation fix. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface LeafletMapProps {
  animals: MapAnimal[];
  puroks: MapPurok[];
  onPickCoordinates?: (lat: number, lng: number) => void;
  pickMode?: boolean;
  // A plain callback instead of a forwarded ref: this component is loaded via
  // next/dynamic, whose wrapper is a plain function component and silently
  // drops any ref passed through it.
  onMapReady?: (handle: LeafletMapHandle) => void;
}

export default function LeafletMap({ animals, puroks, onPickCoordinates, pickMode = false, onMapReady }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const heatLayer = useRef<L.LayerGroup | null>(null);
  const purokLayer = useRef<L.LayerGroup | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showPuroks, setShowPuroks] = useState(true);
  const [mapSearch, setMapSearch] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState<MapAnimal | null>(null);

  // Read the latest pickMode/onPickCoordinates from the click handler via refs
  // instead of the effect below, so the map is created once per mount and
  // never torn down just because the parent re-rendered with a new callback
  // identity (e.g. after every pin placement, which itself triggers a
  // re-render — recreating the map on every click broke picking a 2nd pin).
  const pickModeRef = useRef(pickMode);
  const onPickCoordinatesRef = useRef(onPickCoordinates);
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    pickModeRef.current = pickMode;
    onPickCoordinatesRef.current = onPickCoordinates;
    onMapReadyRef.current = onMapReady;
  }, [pickMode, onPickCoordinates, onMapReady]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [10.6695, 122.987],
      zoom: 15,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    heatLayer.current = L.layerGroup().addTo(map);
    purokLayer.current = L.layerGroup().addTo(map);

    mapInstance.current = map;

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onPickCoordinatesRef.current && e.latlng) {
        onPickCoordinatesRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    onMapReadyRef.current?.({
      flyTo: (lat, lng, zoom = 16) => {
        mapInstance.current?.flyTo([lat, lng], zoom, { animate: true });
      },
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Purok zone circles
  useEffect(() => {
    if (!mapInstance.current || !purokLayer.current) return;
    purokLayer.current.clearLayers();
    if (!showPuroks) return;

    for (const p of puroks) {
      L.circle([p.latitude, p.longitude], { radius: 180, color: "#2f8065", weight: 2, fillColor: "#2f806520", fillOpacity: 0.15 })
        .addTo(purokLayer.current)
        .bindTooltip(`<strong>${p.name}</strong>`);
    }
  }, [puroks, showPuroks]);

  // Animal markers + heatmap
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !heatLayer.current) return;

    markersLayer.current.clearLayers();
    heatLayer.current.clearLayers();

    const normalized = mapSearch.trim().toLowerCase();
    const visible = normalized
      ? animals.filter((a) => [a.name, a.owner, a.purok, a.species].some((v) => v.toLowerCase().includes(normalized)))
      : animals;

    const heatPoints: [number, number, number][] = [];

    for (const animal of visible) {
      let lat = animal.latitude;
      let lng = animal.longitude;

      // Fallback to purok center
      if ((lat === undefined || lat === null) && (lng === undefined || lng === null)) {
        const purok = puroks.find((p) => p.name === animal.purok);
        if (purok) {
          lat = purok.latitude;
          lng = purok.longitude;
        }
      }
      if (lat === undefined || lng === undefined || lat === null || lng === null) continue;

      const color = animal.vaccinated ? "#2f8065" : animal.status === "Overdue" ? "#c85f57" : "#c48732";

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "animal-marker",
          html: `<span style="background:${color};border-radius:50%;display:grid;place-items:center;width:26px;height:26px;">${speciesMarkerSvg(animal.species)}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(markersLayer.current)
        .bindTooltip(
          `<strong>${animal.name}</strong><br/>${animal.species} · ${animal.purok}<br/>${animal.owner}<br/><em>${animal.status}</em>`,
          { direction: "top" }
        );

      marker.on("click", () => setSelectedAnimal(animal));

      heatPoints.push([lat, lng, animal.vaccinated ? 1 : 0.5]);
    }

    // Simple density heat layer using semi-transparent circles
    if (showHeat) {
      for (const [lat, lng, weight] of heatPoints) {
        L.circle([lat, lng], {
          radius: 90,
          color: "transparent",
          weight: 0,
          fillColor: "#2f8065",
          fillOpacity: 0.12 * weight,
        }).addTo(heatLayer.current);
      }
    }
  }, [animals, puroks, showHeat, mapSearch]);

  return (
    <div className="leaflet-map-wrap">
      <div className="leaflet-map-toolbar">
        <div className="leaflet-map-search">
          <input
            aria-label="Search map"
            placeholder="Search animals on map..."
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
          />
        </div>
        <div className="leaflet-map-toggles">
          <button
            type="button"
            className={`leaflet-toggle${showHeat ? " active" : ""}`}
            onClick={() => setShowHeat(!showHeat)}
          >
            Heatmap
          </button>
          <button
            type="button"
            className={`leaflet-toggle${showPuroks ? " active" : ""}`}
            onClick={() => setShowPuroks(!showPuroks)}
          >
            Purok zones
          </button>
        </div>
      </div>
      <div ref={mapRef} className="leaflet-map-canvas" />
      {selectedAnimal && (
        <div className="leaflet-popup">
          <button className="leaflet-popup-close" onClick={() => setSelectedAnimal(null)}>×</button>
          <strong>{selectedAnimal.name}</strong>
          <span>{selectedAnimal.species} · {selectedAnimal.purok}</span>
          <span>{selectedAnimal.owner}</span>
          <em className={`status ${selectedAnimal.vaccinated ? "status-good" : selectedAnimal.status === "Overdue" ? "status-danger" : "status-warn"}`}>
            <i />{selectedAnimal.status}
          </em>
        </div>
      )}
    </div>
  );
}