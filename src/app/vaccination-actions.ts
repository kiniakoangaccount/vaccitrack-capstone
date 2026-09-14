"use server";

import { createAdminClient } from "@/lib/supabase-admin";

export async function addVaccinationRecord(
  animalId: number,
  payload: {
    vaccineDate: string;
    nextDueDate?: string;
    vaccineType?: string;
    administeredBy?: string;
    notes?: string;
    recordedBy: string;
  }
): Promise<{ error?: string; id?: number }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { data, error } = await db
    .from("vaccination_history")
    .insert({
      animal_id: animalId,
      vaccine_date: payload.vaccineDate,
      next_due_date: payload.nextDueDate || null,
      vaccine_type: payload.vaccineType || null,
      administered_by: payload.administeredBy || null,
      notes: payload.notes || null,
      recorded_by: payload.recordedBy,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: animalError } = await db.from("animals").update({
    vaccinated: true,
    vaccine_date: payload.vaccineDate,
    next_due_date: payload.nextDueDate || null,
    vaccine_type: payload.vaccineType || null,
  }).eq("id", animalId);
  if (animalError) return { error: animalError.message };

  return { id: data.id };
}