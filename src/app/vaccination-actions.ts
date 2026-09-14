"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export async function addVaccinationRecord(
  animalId: number,
  payload: {
    vaccineDate: string;
    nextDueDate?: string;
    vaccineType?: string;
    administeredBy?: string;
    notes?: string;
  }
): Promise<{ error?: string; id?: number }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "veterinarian", "bhw"].includes(profile.role)) {
    return { error: "Only staff accounts can record vaccinations." };
  }

  const { data, error } = await db
    .from("vaccination_history")
    .insert({
      animal_id: animalId,
      vaccine_date: payload.vaccineDate,
      next_due_date: payload.nextDueDate || null,
      vaccine_type: payload.vaccineType || null,
      administered_by: payload.administeredBy || null,
      notes: payload.notes || null,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Only advance the animal's headline vaccination fields if this record is
  // not older than what's already on file, so back-filling an earlier dose
  // doesn't stomp a more recent one.
  const { data: animal } = await db.from("animals").select("vaccine_date").eq("id", animalId).maybeSingle();
  if (!animal?.vaccine_date || payload.vaccineDate >= animal.vaccine_date) {
    const { error: animalError } = await db.from("animals").update({
      vaccinated: true,
      vaccine_date: payload.vaccineDate,
      next_due_date: payload.nextDueDate || null,
      vaccine_type: payload.vaccineType || null,
    }).eq("id", animalId);
    if (animalError) return { error: animalError.message };
  }

  return { id: data.id };
}