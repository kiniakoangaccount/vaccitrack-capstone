"use server";

import {
  ESTEFANIA_SEARCH_VIEWBOX,
  isWithinEstefaniaSearchArea,
  purokOptions,
} from "@/lib/map-data";

export interface LocationSuggestion {
  label: string;
  lat: number;
  lon: number;
}

export async function searchLocation(query: string): Promise<{ results?: LocationSuggestion[]; error?: string }> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return { results: [] };

  const purokQuery = trimmed.replace(/^purok\s+/i, "").toLocaleLowerCase();
  const localResults = purokOptions
    .filter((purok) => purok.name.toLocaleLowerCase().includes(purokQuery))
    .slice(0, 5)
    .map((purok) => ({
      label: `${purok.name}, Barangay Estefania (purok)`,
      lat: purok.latitude,
      lon: purok.longitude,
    }));

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", "5");
    url.searchParams.set(
      "viewbox",
      `${ESTEFANIA_SEARCH_VIEWBOX.west},${ESTEFANIA_SEARCH_VIEWBOX.north},${ESTEFANIA_SEARCH_VIEWBOX.east},${ESTEFANIA_SEARCH_VIEWBOX.south}`
    );
    url.searchParams.set("bounded", "1");
    url.searchParams.set("countrycodes", "ph");

    const res = await fetch(url, {
      // Nominatim's usage policy requires a valid identifying User-Agent for
      // server-side requests (https://operations.osmfoundation.org/policies/nominatim/).
      headers: { "User-Agent": "VacciTrack/1.0 (barangay animal vaccination tracker)" },
    });
    if (!res.ok) {
      return localResults.length
        ? { results: localResults }
        : { error: "Location search is unavailable right now." };
    }

    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    const mapResults = data
      .map((item) => ({ label: item.display_name, lat: Number(item.lat), lon: Number(item.lon) }))
      .filter((item) => isWithinEstefaniaSearchArea(item.lat, item.lon));
    const results = [...localResults, ...mapResults].slice(0, 5);
    return { results };
  } catch {
    return localResults.length
      ? { results: localResults }
      : { error: "Location search is unavailable right now." };
  }
}
