export type AnimalStatus = "Vaccinated" | "Due soon" | "Overdue" | "Not scheduled";

// Nominatim's bounded search uses a rectangular viewbox. This padded box
// covers the known Estefania purok centers and nearby addresses.
export const ESTEFANIA_SEARCH_VIEWBOX = {
  west: 122.978,
  north: 10.701,
  east: 123.018,
  south: 10.649,
} as const;

export function isWithinEstefaniaSearchArea(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= ESTEFANIA_SEARCH_VIEWBOX.south &&
    latitude <= ESTEFANIA_SEARCH_VIEWBOX.north &&
    longitude >= ESTEFANIA_SEARCH_VIEWBOX.west &&
    longitude <= ESTEFANIA_SEARCH_VIEWBOX.east
  );
}

// The real 55 puroks/subdivisions of Barangay Estefania, Bacolod City, per
// the barangay's own socio-economic profile (bacolodcity.gov.ph). 26 of the
// 55 have a matching place in OpenStreetMap and use its real coordinates;
// the other 29 are informal subdivisions/sitios with no OSM entry, so their
// coordinates are an approximate, evenly-spread placement within the real
// barangay boundary rather than a surveyed position — adjust via Settings →
// Purok areas if you have more accurate coordinates for one of these.
// Approximate entries: Arabay 1, Arabay 2, Buena Royale, Camelot Residences,
// Camingawan Proper, Capitol Hills Subdivision, Celine Homes Subdivision,
// City Ville Subdivision, Escuerdo, Estefania Proper, Flora, Fortune Towne -
// B, Fortune Towne Subdivision, Goldah, Glenwood Residences, Greensville 1
// Subdivision, Greensville 4 Subdivision, Kasoy, Lopues Village, Luisville
// Subdivision, Mayang, Pag-asa, Paraiso, Pedring, Pequiño, Sambag, Sunshine
// Valley Subdivision, Villa Angeles, Villa Soledad.
export const purokOptions = [
  { id: 1, name: "Arao", latitude: 10.6520648, longitude: 123.0094026 },
  { id: 2, name: "Arabay 1", latitude: 10.6806643, longitude: 123.00224 },
  { id: 3, name: "Arabay 2", latitude: 10.6852576, longitude: 122.9932259 },
  { id: 4, name: "Bagong Silang", latitude: 10.6680692, longitude: 122.987193 },
  { id: 5, name: "Bethany Court", latitude: 10.6657653, longitude: 122.9864336 },
  { id: 6, name: "Buena Royale", latitude: 10.672735, longitude: 122.9989359 },
  { id: 7, name: "Camelot Residences", latitude: 10.6876875, longitude: 123.0036245 },
  { id: 8, name: "Camelot Village", latitude: 10.6781684, longitude: 122.9889292 },
  { id: 9, name: "Camingawan Proper", latitude: 10.6789922, longitude: 122.9887868 },
  { id: 10, name: "Capitol Hills Subdivision", latitude: 10.6751569, longitude: 123.0068978 },
  { id: 11, name: "Celine Homes Subdivision", latitude: 10.6911506, longitude: 122.9954211 },
  { id: 12, name: "City Ville Subdivision", latitude: 10.6705402, longitude: 122.9929819 },
  { id: 13, name: "Country Homes Subdivision Phase 1", latitude: 10.6845432, longitude: 122.9921925 },
  { id: 14, name: "Country Homes Subdivision Phase 2", latitude: 10.6845432, longitude: 122.9921925 },
  { id: 15, name: "Country Homes Subdivision Phase 3", latitude: 10.6845432, longitude: 122.9921925 },
  { id: 16, name: "East Homes 1", latitude: 10.6706102, longitude: 122.992289 },
  { id: 17, name: "East Homes 2", latitude: 10.6675672, longitude: 122.9931639 },
  { id: 18, name: "East Homes 3", latitude: 10.6764095, longitude: 122.9882074 },
  { id: 19, name: "Elsa", latitude: 10.6769938, longitude: 123.006454 },
  { id: 20, name: "Escuerdo", latitude: 10.6847532, longitude: 123.0094363 },
  { id: 21, name: "Estefania Proper", latitude: 10.6853956, longitude: 122.9867781 },
  { id: 22, name: "Flora", latitude: 10.6690216, longitude: 123.0036883 },
  { id: 23, name: "Fortune Towne - B", latitude: 10.6933418, longitude: 123.0022165 },
  { id: 24, name: "Fortune Towne Subdivision", latitude: 10.6737953, longitude: 122.986387 },
  { id: 25, name: "Goldah", latitude: 10.6776377, longitude: 123.0120068 },
  { id: 26, name: "Glenwood Residences", latitude: 10.6925071, longitude: 122.9899141 },
  { id: 27, name: "Greensville 1 Subdivision", latitude: 10.665943, longitude: 122.9963323 },
  { id: 28, name: "Greensville 4 Subdivision", latitude: 10.6904599, longitude: 123.0098627 },
  { id: 29, name: "Jesusa Heights Subdivision", latitude: 10.6619853, longitude: 122.9947464 },
  { id: 30, name: "Kaburihan", latitude: 10.6852292, longitude: 123.003889 },
  { id: 31, name: "Kasoy", latitude: 10.6813066, longitude: 122.9827086 },
  { id: 32, name: "Lopues Village", latitude: 10.6694633, longitude: 123.0094958 },
  { id: 33, name: "La Herencia", latitude: 10.6939795, longitude: 122.9935184 },
  { id: 34, name: "Luisville Subdivision", latitude: 10.6968519, longitude: 122.997501 },
  { id: 35, name: "Mayang", latitude: 10.667979, longitude: 122.9879886 },
  { id: 36, name: "Meadows of Camelot", latitude: 10.6789469, longitude: 122.993017 },
  { id: 37, name: "Pag-asa", latitude: 10.6829087, longitude: 123.0140971 },
  { id: 38, name: "Paho 1", latitude: 10.6621345, longitude: 122.9819957 },
  { id: 39, name: "Paho 2", latitude: 10.6616682, longitude: 122.9828708 },
  { id: 40, name: "Paraiso", latitude: 10.6904496, longitude: 122.9851063 },
  { id: 41, name: "Pedring", latitude: 10.6636609, longitude: 123.0017517 },
  { id: 42, name: "Pequiño", latitude: 10.6960365, longitude: 123.0061949 },
  { id: 43, name: "Providence Negros", latitude: 10.6672511, longitude: 123.0067676 },
  { id: 44, name: "Sagrado 2", latitude: 10.6753717, longitude: 122.9867107 },
  { id: 45, name: "Sambag", latitude: 10.6751935, longitude: 122.9829969 },
  { id: 46, name: "Sunshine Valley Subdivision", latitude: 10.6729984, longitude: 123.0127646 },
  { id: 47, name: "The Palisades", latitude: 10.6691421, longitude: 122.9829517 },
  { id: 48, name: "Villa Alexandra 1", latitude: 10.6745713, longitude: 122.9921614 },
  { id: 49, name: "Villa Alexandra 2", latitude: 10.6745713, longitude: 122.9921614 },
  { id: 50, name: "Villa Angeles", latitude: 10.6977755, longitude: 122.9920631 },
  { id: 51, name: "Villa Estefania", latitude: 10.6613296, longitude: 122.985071 },
  { id: 52, name: "Villa Felicidad", latitude: 10.6577841, longitude: 122.9826935 },
  { id: 53, name: "Villa Soledad", latitude: 10.6629586, longitude: 122.9928247 },
  { id: 54, name: "Villa Villeta", latitude: 10.6627992, longitude: 122.9903441 },
  { id: 55, name: "Villamar", latitude: 10.6818868, longitude: 122.9858753 },
];

export function getAnimalStatus(vaccinated: boolean, nextDueDate: string | null, today = new Date()): AnimalStatus {
  if (!nextDueDate) return vaccinated ? "Vaccinated" : "Not scheduled";

  const dueDate = new Date(`${nextDueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return vaccinated ? "Vaccinated" : "Not scheduled";

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000);
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 30) return "Due soon";
  return "Vaccinated";
}
