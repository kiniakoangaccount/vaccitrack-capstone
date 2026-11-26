"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { addMonthsToDateIso, getManilaDateIso } from "@/lib/dates";
import { logAudit } from "@/lib/audit";

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
  if (!profile || !["admin", "bhw"].includes(profile.role)) {
    return { error: "Only staff accounts can record vaccinations." };
  }

  // The date picker already enforces this client-side, but a server action
  // can be called directly, so it must hold here too.
  if (payload.vaccineDate > getManilaDateIso(0)) {
    return { error: "Vaccination date cannot be in the future." };
  }

  const nextDueDate = payload.nextDueDate || addMonthsToDateIso(payload.vaccineDate, 12);

  const { data, error } = await db
    .from("vaccination_history")
    .insert({
      animal_id: animalId,
      vaccine_date: payload.vaccineDate,
      next_due_date: nextDueDate,
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
      next_due_date: nextDueDate,
      vaccine_type: payload.vaccineType || null,
    }).eq("id", animalId);
    if (animalError) return { error: animalError.message };
  }

  await logAudit(db, {
    userId: user.id,
    action: "INSERT",
    tableName: "vaccination_history",
    recordId: data.id,
    notes: `Vaccination recorded for animal #${animalId}${payload.vaccineType ? ` (${payload.vaccineType})` : ""}.`,
  });

  return { id: data.id };
}
