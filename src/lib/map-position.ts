import { isWithinEstefaniaSearchArea } from "@/lib/map-data";

/** Parses a number or numeric string. Returns null for null, undefined, "", NaN and Infinity. */
export function toCoord(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Case, accent and spacing insensitive key, so "Pequiño", " pequino " and "PEQUIÑO" all match. */
export function normalizeName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Leaflet tooltips take HTML strings. Escape anything that comes from the database. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

export interface PurokPoint {
  name: string;
  latitude: number;
  longitude: number;
}

export interface AnimalLike {
  purok: string;
  latitude?: unknown;
  longitude?: unknown;
}

export interface PlacedAnimal<A> {
  animal: A;
  lat: number;
  lng: number;
  approximate: boolean;
}

export function resolvePosition<A extends AnimalLike>(
  animal: A,
  purokByName: ReadonlyMap<string, PurokPoint>,
): PlacedAnimal<A> | null {
  const lat = toCoord(animal.latitude);
  const lng = toCoord(animal.longitude);

  if (lat !== null && lng !== null) {
    if (isWithinEstefaniaSearchArea(lat, lng)) return { animal, lat, lng, approximate: false };
    if (isWithinEstefaniaSearchArea(lng, lat)) return { animal, lat: lng, lng: lat, approximate: false };
  }

  const purok = purokByName.get(normalizeName(animal.purok));
  if (purok && isWithinEstefaniaSearchArea(purok.latitude, purok.longitude)) {
    return { animal, lat: purok.latitude, lng: purok.longitude, approximate: true };
  }
  return null;
}
