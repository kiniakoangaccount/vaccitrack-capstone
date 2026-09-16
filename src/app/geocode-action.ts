"use server";

export interface LocationSuggestion {
  label: string;
  lat: number;
  lon: number;
}

export async function searchLocation(query: string): Promise<{ results?: LocationSuggestion[]; error?: string }> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return { results: [] };

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", "5");

    const res = await fetch(url, {
      // Nominatim's usage policy requires a valid identifying User-Agent for
      // server-side requests (https://operations.osmfoundation.org/policies/nominatim/).
      headers: { "User-Agent": "VacciTrack/1.0 (barangay animal vaccination tracker)" },
    });
    if (!res.ok) return { error: "Location search is unavailable right now." };

    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return { results: data.map((item) => ({ label: item.display_name, lat: Number(item.lat), lon: Number(item.lon) })) };
  } catch {
    return { error: "Location search is unavailable right now." };
  }
}
