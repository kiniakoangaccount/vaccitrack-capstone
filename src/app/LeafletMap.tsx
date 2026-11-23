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
  const [showHeat, setShowHeat] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [mapSearch, setMapSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [purokFilter, setPurokFilter] = useState("All");
  const [zoomLevel, setZoomLevel] = useState(15);
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

    mapInstance.current = map;
    map.on("zoomend", () => setZoomLevel(map.getZoom()));

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

  // Animal markers + heatmap
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !heatLayer.current) return;

    markersLayer.current.clearLayers();
    heatLayer.current.clearLayers();

    const normalized = mapSearch.trim().toLowerCase();
    const visible = animals.filter((animal) => {
      const matchesSearch = !normalized || [animal.name, animal.owner, animal.purok, animal.species].some((value) => value.toLowerCase().includes(normalized));
      const matchesSpecies = speciesFilter === "All" || animal.species === speciesFilter;
      const matchesPurok = purokFilter === "All" || animal.purok === purokFilter;
      const matchesStatus = statusFilter === "All"
        || (statusFilter === "Unvaccinated" && !animal.vaccinated)
        || (statusFilter === "Overdue" && animal.vaccinated && animal.status === "Overdue")
        || (statusFilter === "To expire" && animal.vaccinated && animal.status === "Due soon")
        || (statusFilter === "Vaxxed" && animal.vaccinated && animal.status !== "Overdue" && animal.status !== "Due soon");
      return matchesSearch && matchesSpecies && matchesPurok && matchesStatus;
    });

    const heatPoints: [number, number, number][] = [];
    const positioned: Array<{ animal: MapAnimal; lat: number; lng: number }> = [];

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

      positioned.push({ animal, lat, lng });
      heatPoints.push([lat, lng, animal.vaccinated ? 1 : 0.5]);
    }

    const precision = zoomLevel >= 16 ? 0 : zoomLevel >= 14 ? 3 : zoomLevel >= 12 ? 2 : 1;
    const groups = new Map<string, Array<{ animal: MapAnimal; lat: number; lng: number }>>();

    for (const point of positioned) {
      const key = precision === 0 ? String(point.animal.id) : `${Math.round(point.lat * 10 ** precision)}:${Math.round(point.lng * 10 ** precision)}`;
      const group = groups.get(key) ?? [];
      group.push(point);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (showClusters && zoomLevel < 16 && group.length > 1) {
        const lat = group.reduce((sum, point) => sum + point.lat, 0) / group.length;
        const lng = group.reduce((sum, point) => sum + point.lng, 0) / group.length;
        const size = group.length >= 10 ? 40 : group.length >= 5 ? 36 : 32;
        const cluster = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "animal-marker cluster-marker",
            html: `<span style="width:${size}px;height:${size}px;background:#315b4a;color:#fff;border-radius:50%;display:grid;place-items:center;font-weight:800;border:3px solid #fff;box-shadow:0 2px 8px #17312655">${group.length}</span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        }).addTo(markersLayer.current).bindTooltip(`${group.length} animals in this area`, { direction: "top" });
        cluster.on("click", () => mapInstance.current?.setView([lat, lng], Math.min(17, mapInstance.current.getZoom() + 2)));
        continue;
      }

      for (const point of group) {
        const animal = point.animal;
        const color = !animal.vaccinated ? "#dc2626" : animal.status === "Overdue" ? "#f97316" : animal.status === "Due soon" ? "#eab308" : "#16a34a";
        const icon = animal.species === "Cat" ? "🐈" : "🐕";
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "animal-marker",
            html: `<span style="background:${color};color:#fff;border-radius:50%;display:grid;place-items:center;width:26px;height:26px;font-size:13px;">${icon}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(markersLayer.current).bindTooltip(
          `<strong>${animal.name}</strong><br/>${animal.species} · ${animal.purok}<br/>${animal.owner}<br/><em>${animal.status}</em>`,
          { direction: "top" }
        );
        marker.on("click", () => setSelectedAnimal(animal));
      }
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
  }, [animals, puroks, showHeat, showClusters, mapSearch, speciesFilter, statusFilter, purokFilter, zoomLevel]);

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
        {!pickMode && <select aria-label="Filter by species" value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)}>
          <option value="All">All species</option>
          <option value="Dog">Dogs</option>
          <option value="Cat">Cats</option>
        </select>}
        {!pickMode && <select aria-label="Filter by vaccination status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="All">All statuses</option>
          <option value="Vaxxed">Vaxxed</option>
          <option value="To expire">To expire</option>
          <option value="Overdue">Overdue</option>
          <option value="Unvaccinated">Unvaccinated</option>
        </select>}
        {!pickMode && <select aria-label="Filter by purok or service area" value={purokFilter} onChange={(event) => setPurokFilter(event.target.value)}>
          <option value="All">All puroks</option>
          {puroks.map((purok) => <option key={purok.id} value={purok.name}>{purok.name}</option>)}
        </select>}
        <div className="leaflet-map-toggles">
          {!pickMode && <button type="button" className={`leaflet-toggle${showHeat ? " active" : ""}`} onClick={() => setShowHeat(!showHeat)}>Heatmap</button>}
          {!pickMode && <button type="button" className={`leaflet-toggle${showClusters ? " active" : ""}`} onClick={() => setShowClusters(!showClusters)}>Clusters</button>}
        </div>
      </div>
      {!pickMode && <div className="leaflet-map-legend" aria-label="Vaccination status legend">
        <span><i style={{ background: "#16a34a" }} /> Vaxxed</span>
        <span><i style={{ background: "#eab308" }} /> To expire</span>
        <span><i style={{ background: "#f97316" }} /> Overdue</span>
        <span><i style={{ background: "#dc2626" }} /> Unvaccinated</span>
        <span><i className="species-key" /> Dog / Cat</span>
      </div>}
      <div ref={mapRef} className="leaflet-map-canvas" />
      {selectedAnimal && (
        <div className="leaflet-popup">
          <button className="leaflet-popup-close" onClick={() => setSelectedAnimal(null)}>×</button>
          <strong>{selectedAnimal.name}</strong>
          <span>{selectedAnimal.species} · {selectedAnimal.purok}</span>
          <span>{selectedAnimal.owner}</span>
          <em className={`status ${!selectedAnimal.vaccinated ? "status-danger" : selectedAnimal.status === "Overdue" ? "status-overdue" : selectedAnimal.status === "Due soon" ? "status-warn" : "status-good"}`}>
            <i />{selectedAnimal.status}
          </em>
        </div>
      )}
    </div>
  );
}