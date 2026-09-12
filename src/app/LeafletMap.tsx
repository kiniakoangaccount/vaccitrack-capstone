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

interface LeafletMapProps {
  animals: MapAnimal[];
  puroks: MapPurok[];
  onPickCoordinates?: (lat: number, lng: number) => void;
  pickMode?: boolean;
}

export default function LeafletMap({ animals, puroks, onPickCoordinates, pickMode = false }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const heatLayer = useRef<L.LayerGroup | null>(null);
  const purokLayer = useRef<L.LayerGroup | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showPuroks, setShowPuroks] = useState(true);
  const [mapSearch, setMapSearch] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState<MapAnimal | null>(null);

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

    if (pickMode && onPickCoordinates) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        if (e.latlng) onPickCoordinates(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [pickMode, onPickCoordinates]);

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
      const icon = animal.species === "Cat" ? "🐈" : "🐕";

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "animal-marker",
          html: `<span style="background:${color};color:#fff;border-radius:50%;display:grid;place-items:center;width:26px;height:26px;font-size:13px;">${icon}</span>`,
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