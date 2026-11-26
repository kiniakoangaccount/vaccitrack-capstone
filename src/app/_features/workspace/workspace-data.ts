import type { createClient } from "@/lib/supabase";
import { getAnimalStatus, getVaccinationDueDate } from "@/lib/map-data";
import { formatDueDate } from "@/app/_features/animals/animal-analytics";
import type { Animal, SupabaseAnimalRecord } from "@/app/_features/workspace/workspace-types";

// Keep the initial load and realtime refresh on the same query and mapping.
export async function loadAnimalRecords(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  isClientRole: boolean,
  ownerId: string,
): Promise<Animal[] | null> {
  const today = new Date();
  // Registry, Map, and Risk analysis need the complete animal set.
  const query = supabase.from("animals")
    .select("id, name, species, classification, neutered, breed, age, sex, color, owner_name, contact_number, impound_area, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, notes, image_references, pound_status, puroks(name)")
    .order("created_at", { ascending: false });
  const result = await (isClientRole ? query.eq("user_id", ownerId) : query);
  if (result.error) return null;

  return ((result.data ?? []) as SupabaseAnimalRecord[]).map((record) => {
    const vaccineDate = record.vaccine_date ?? null;
    const nextDueDate = getVaccinationDueDate(vaccineDate, record.next_due_date ?? null);
    const vaccinated = Boolean(record.vaccinated);
    return {
      id: record.id,
      name: record.name,
      species: record.species,
      classification: record.classification,
      neutered: record.neutered ?? undefined,
      breed: record.breed ?? undefined,
      age: record.age ?? undefined,
      sex: record.sex ?? undefined,
      color: record.color ?? undefined,
      owner: record.owner_name,
      vaccinated,
      vaccineDate,
      purok: Array.isArray(record.puroks) ? record.puroks[0]?.name ?? "Unassigned" : record.puroks?.name ?? "Unassigned",
      status: getAnimalStatus(vaccinated, nextDueDate, today, vaccineDate),
      nextDueDate,
      nextDue: formatDueDate(nextDueDate),
      contact: record.contact_number ?? "",
      impoundArea: record.impound_area ?? "",
      vaccineType: record.vaccine_type ?? undefined,
      latitude: record.latitude ?? undefined,
      longitude: record.longitude ?? undefined,
      notes: record.notes ?? undefined,
      imageReferences: record.image_references ?? [],
      poundStatus: record.pound_status ?? null,
    } satisfies Animal;
  });
}

export async function loadRiskPurokNames(
  supabase: NonNullable<ReturnType<typeof createClient>>,
): Promise<string[] | null> {
  const { data, error } = await supabase.from("puroks").select("name").order("name");
  if (error) return null;
  const rows = (data ?? []) as { name: string | null }[];
  return rows.map((row) => row.name).filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
}
