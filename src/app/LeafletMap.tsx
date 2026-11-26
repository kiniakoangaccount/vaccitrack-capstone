"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { ESTEFANIA_SEARCH_VIEWBOX, isWithinEstefaniaSearchArea } from "@/lib/map-data";
import { escapeHtml, normalizeName, resolvePosition, type PlacedAnimal } from "@/lib/map-position";

export interface MapAnimal {
  id: number | string;
  name: string;
  species: string;
  classification?: string;
  owner: string;
  purok: string;
  vaccinated: boolean;
  status: string;
  vaccineDate?: string | null;
  nextDueDate?: string | null;
  vaccineType?: string;
  breed?: string;
  age?: number | null;
  contact?: string;
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

function markerHtml(color: string, species: string, approximate: boolean): string {
  const ring = approximate ? "border:2px dashed #fff;opacity:.8;" : "";
  return `<span style="background:${color};border-radius:50%;display:grid;place-items:center;width:26px;height:26px;box-sizing:border-box;${ring}">${speciesMarkerSvg(species)}</span>`;
}

function clusterHtml(count: number): string {
  return `<span style="background:#2f8065;color:#fff;border:3px solid #fff;border-radius:50%;display:grid;place-items:center;width:36px;height:36px;box-sizing:border-box;font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.35);">${count}</span>`;
}

type MapVaccinationCategory = "Vaccinated" | "Expiring soon" | "Expired" | "Unvaccinated";

function vaccinationCategory(animal: MapAnimal): MapVaccinationCategory {
  if (!animal.vaccinated) return "Unvaccinated";
  if (animal.status === "Expired") return "Expired";
  if (animal.status === "Due soon") return "Expiring soon";
  return "Vaccinated";
}

function statusColor(category: MapVaccinationCategory): string {
  switch (category) {
    case "Vaccinated": return "#2f8065";
    case "Expiring soon": return "#f2c94c";
    case "Expired": return "#f28c28";
    case "Unvaccinated": return "#d64545";
  }
}

function statusClass(category: MapVaccinationCategory): string {
  switch (category) {
    case "Vaccinated": return "status-good";
    case "Expiring soon": return "status-warn";
    case "Expired": return "status-overdue";
    case "Unvaccinated": return "status-danger";
  }
}

function formatMapDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export interface LeafletMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => boolean;
}

interface LeafletMapProps {
  animals: MapAnimal[];
  puroks: MapPurok[];
  onAnimalSelect?: (animalId: MapAnimal["id"]) => void;
  onPickCoordinates?: (lat: number, lng: number) => void;
  onPickOutsideArea?: () => void;
  pickMode?: boolean;
  // A plain callback instead of a forwarded ref: this component is loaded via
  // next/dynamic, whose wrapper is a plain function component and silently
  // drops any ref passed through it.
  onMapReady?: (handle: LeafletMapHandle) => void;
}

export default function LeafletMap({
  animals,
  puroks,
  onAnimalSelect,
  onPickCoordinates,
  onPickOutsideArea,
  pickMode = false,
  onMapReady,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.MarkerClusterGroup | null>(null);
  const individualMarkersLayer = useRef<L.LayerGroup | null>(null);
  const heatLayer = useRef<L.LayerGroup | null>(null);
  const purokLayer = useRef<L.LayerGroup | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showPuroks, setShowPuroks] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [classificationFilter, setClassificationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [purokFilter, setPurokFilter] = useState("All");
  const [mapSearch, setMapSearch] = useState("");
  const [selectedId, setSelectedId] = useState<MapAnimal["id"] | null>(null);

  // Read the latest pickMode/onPickCoordinates from the click handler via refs
  // instead of the effect below, so the map is created once per mount and
  // never torn down just because the parent re-rendered with a new callback
  // identity (e.g. after every pin placement, which itself triggers a
  // re-render — recreating the map on every click broke picking a 2nd pin).
  const pickModeRef = useRef(pickMode);
  const onPickCoordinatesRef = useRef(onPickCoordinates);
  const onPickOutsideAreaRef = useRef(onPickOutsideArea);
  const onMapReadyRef = useRef(onMapReady);
  const onAnimalSelectRef = useRef(onAnimalSelect);
  useEffect(() => {
    pickModeRef.current = pickMode;
    onPickCoordinatesRef.current = onPickCoordinates;
    onPickOutsideAreaRef.current = onPickOutsideArea;
    onMapReadyRef.current = onMapReady;
    onAnimalSelectRef.current = onAnimalSelect;
  }, [pickMode, onPickCoordinates, onPickOutsideArea, onMapReady, onAnimalSelect]);

  const purokByName = useMemo(() => new Map(puroks.map((p) => [normalizeName(p.name), p] as const)), [puroks]);
  const placed = useMemo<PlacedAnimal<MapAnimal>[]>(
    () =>
      animals.flatMap((animal) => {
        const result = resolvePosition(animal, purokByName);
        return result ? [result] : [];
      }),
    [animals, purokByName],
  );
  const unplacedCount = animals.length - placed.length;
  const approximateCount = placed.filter((p) => p.approximate).length;

  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstance.current) return;

    const bounds = L.latLngBounds(
      [ESTEFANIA_SEARCH_VIEWBOX.south, ESTEFANIA_SEARCH_VIEWBOX.west],
      [ESTEFANIA_SEARCH_VIEWBOX.north, ESTEFANIA_SEARCH_VIEWBOX.east]
    );
    const map = L.map(el, {
      zoomControl: false,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      scrollWheelZoom: true,
    });
    map.setView([10.6695, 122.987], 14);
    L.control.zoom({
      position: "topright",
      zoomInTitle: "Zoom in",
      zoomOutTitle: "Zoom out to the Estefania area limit",
    }).addTo(map);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    heatLayer.current = L.layerGroup().addTo(map);
    purokLayer.current = L.layerGroup().addTo(map);
    individualMarkersLayer.current = L.layerGroup().addTo(map);
    markersLayer.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 28,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          className: "animal-cluster",
          html: clusterHtml(cluster.getChildCount()),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
    }).addTo(map);

    mapInstance.current = map;

    let fitted = false;
    const fitToArea = () => {
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const minZoom = map.getBoundsZoom(bounds, false, L.point(16, 16));
      map.setMinZoom(minZoom);
      if (!fitted) {
        map.fitBounds(bounds, { padding: [8, 8] });
        fitted = true;
      } else if (map.getZoom() < minZoom) {
        map.setZoom(minZoom);
      }
    };
    const observer = new ResizeObserver(fitToArea);
    observer.observe(el);
    fitToArea();

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!pickModeRef.current || !onPickCoordinatesRef.current) return;
      if (isWithinEstefaniaSearchArea(e.latlng.lat, e.latlng.lng)) {
        onPickCoordinatesRef.current(e.latlng.lat, e.latlng.lng);
      } else {
        onPickOutsideAreaRef.current?.();
      }
    });

    onMapReadyRef.current?.({
      flyTo: (lat, lng, zoom = 16) => {
        const currentMap = mapInstance.current;
        if (!currentMap || !isWithinEstefaniaSearchArea(lat, lng)) return false;
        currentMap.flyTo([lat, lng], zoom, { animate: true });
        return true;
      },
    });

    return () => {
      observer.disconnect();
      map.remove();
      mapInstance.current = null;
      markersLayer.current = null;
      individualMarkersLayer.current = null;
      heatLayer.current = null;
      purokLayer.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (map) map.getContainer().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode]);

  // Purok zone circles
  useEffect(() => {
    if (!mapInstance.current || !purokLayer.current) return;
    purokLayer.current.clearLayers();
    if (!showPuroks) return;

    for (const p of puroks) {
      L.circle([p.latitude, p.longitude], { radius: 180, color: "#2f8065", weight: 2, fillColor: "#2f806520", fillOpacity: 0.15 })
        .addTo(purokLayer.current)
        .bindTooltip(`<strong>${escapeHtml(p.name)}</strong>`);
    }
  }, [puroks, showPuroks]);

  // Animal markers + heatmap
  useEffect(() => {
    const cluster = markersLayer.current;
    const individualMarkers = individualMarkersLayer.current;
    const heat = heatLayer.current;
    if (!mapInstance.current || !cluster || !individualMarkers || !heat) return;

    cluster.clearLayers();
    individualMarkers.clearLayers();
    heat.clearLayers();

    const term = mapSearch.trim().toLowerCase();
    const visible = placed.filter(({ animal: animal }) => {
      const classification = animal.classification ?? "Pet";
      const matchesSearch = !term || [animal.name, animal.owner, animal.purok, animal.species, classification].some((value) => String(value ?? "").toLowerCase().includes(term));
      const matchesSpecies = speciesFilter === "All" || animal.species === speciesFilter;
      const matchesClassification = classificationFilter === "All" || classification === classificationFilter;
      const matchesStatus = statusFilter === "All" || vaccinationCategory(animal) === statusFilter;
      const matchesPurok = purokFilter === "All" || animal.purok === purokFilter;
      return matchesSearch && matchesSpecies && matchesClassification && matchesStatus && matchesPurok;
    });

    const markers: L.Marker[] = [];
    for (const { animal, lat, lng, approximate } of visible) {
      const category = vaccinationCategory(animal);
      const color = statusColor(category);
      const classification = animal.classification ?? "Pet";

      const tooltip =
        `<strong>${escapeHtml(animal.name)}</strong><br/>${escapeHtml(animal.species)} · ${escapeHtml(animal.purok)}` +
        `<br/>${escapeHtml(classification)} · ${escapeHtml(animal.owner)}<br/><em>${escapeHtml(category)}</em>` +
        (approximate ? "<br/><small>Approximate position (purok center)</small>" : "");

      const marker = L.marker([lat, lng], {
        title: `${animal.name} — ${category}. Click to show details.`,
        icon: L.divIcon({
          className: "animal-marker",
          html: markerHtml(color, animal.species, approximate),
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      }).bindTooltip(tooltip, { direction: "top" });

      marker.on("click", () => {
        setSelectedId(animal.id);
        onAnimalSelectRef.current?.(animal.id);
      });
      markers.push(marker);

      if (showHeat) {
        L.circle([lat, lng], {
          radius: 90,
          color: "transparent",
          weight: 0,
          fillColor: color,
          fillOpacity: 0.12,
        }).addTo(heat);
      }
    }
    if (showClusters) {
      cluster.addLayers(markers);
    } else {
      markers.forEach((marker) => individualMarkers.addLayer(marker));
    }
  }, [placed, showHeat, showClusters, mapSearch, speciesFilter, classificationFilter, statusFilter, purokFilter]);

  const selectedPlaced = selectedId === null ? null : (placed.find((p) => p.animal.id === selectedId) ?? null);
  const selectedAnimal = selectedPlaced?.animal ?? null;

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
        {!pickMode && <select aria-label="Filter by pet or stray classification" value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value)}>
          <option value="All">Pets and strays</option>
          <option value="Pet">Pets</option>
          <option value="Stray">Strays</option>
        </select>}
        {!pickMode && <select aria-label="Filter by vaccination status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="All">All statuses</option>
          <option value="Vaccinated">Vaccinated</option>
          <option value="Expiring soon">Expiring soon</option>
          <option value="Expired">Expired</option>
          <option value="Unvaccinated">Unvaccinated</option>
        </select>}
        {!pickMode && <select aria-label="Filter by purok or service area" value={purokFilter} onChange={(event) => setPurokFilter(event.target.value)}>
          <option value="All">All puroks</option>
          {puroks.map((purok) => <option key={purok.id} value={purok.name}>{purok.name}</option>)}
        </select>}
        <div className="leaflet-map-toggles">
          {!pickMode && <button type="button" aria-pressed={showHeat} className={`leaflet-toggle${showHeat ? " active" : ""}`} onClick={() => setShowHeat(!showHeat)}>Heatmap</button>}
          {!pickMode && <button type="button" aria-pressed={showClusters} className={`leaflet-toggle${showClusters ? " active" : ""}`} onClick={() => setShowClusters(!showClusters)}>Clusters</button>}
          {!pickMode && <button type="button" aria-pressed={showPuroks} className={`leaflet-toggle${showPuroks ? " active" : ""}`} onClick={() => setShowPuroks(!showPuroks)}>Purok zones</button>}
        </div>
      </div>
      {(unplacedCount > 0 || approximateCount > 0) && (
        <div className="leaflet-map-note" role="status" style={{ padding: "6px 10px", fontSize: "0.85rem" }}>
          {approximateCount > 0 &&
            `${approximateCount} ${approximateCount === 1 ? "animal is" : "animals are"} shown at the purok center (dashed pin). `}
          {unplacedCount > 0 &&
            `${unplacedCount} ${unplacedCount === 1 ? "animal is" : "animals are"} not on the map because no valid location or purok was found.`}
        </div>
      )}
      <div ref={mapRef} className="leaflet-map-canvas" />
      {selectedAnimal && (
        <div className="leaflet-popup" role="region" aria-label={`${selectedAnimal.name} animal details`} aria-live="polite">
          <button type="button" aria-label="Close animal details" className="leaflet-popup-close" onClick={() => setSelectedId(null)}>×</button>
          <strong>{selectedAnimal.name}</strong>
          <span>{selectedAnimal.species} · {selectedAnimal.purok}</span>
          <span>{selectedAnimal.classification ?? "Pet"}</span>
          <span>{selectedAnimal.owner}</span>
          {selectedPlaced?.approximate && <span>Approximate position (purok center)</span>}
          <em className={`status ${statusClass(vaccinationCategory(selectedAnimal))}`}>
            <i />{vaccinationCategory(selectedAnimal)}
          </em>
          <dl className="leaflet-popup-details">
            <div><dt>Owner</dt><dd>{selectedAnimal.owner || "Not recorded"}</dd></div>
            <div><dt>Contact</dt><dd>{selectedAnimal.contact || "Not recorded"}</dd></div>
            <div><dt>Breed</dt><dd>{selectedAnimal.breed || "Not recorded"}</dd></div>
            <div><dt>Age</dt><dd>{selectedAnimal.age == null ? "Not recorded" : `${selectedAnimal.age} months`}</dd></div>
            <div><dt>Vaccine</dt><dd>{selectedAnimal.vaccineType || "Not recorded"}</dd></div>
            <div><dt>Last vaccinated</dt><dd>{formatMapDate(selectedAnimal.vaccineDate)}</dd></div>
            <div><dt>Next due</dt><dd>{formatMapDate(selectedAnimal.nextDueDate)}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
