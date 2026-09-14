"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export async function queueVaccinationReminders(
  animalIds: number[],
  message: string,
): Promise<{ error?: string; queued?: number }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "veterinarian", "bhw"].includes(profile.role)) return { error: "Only staff accounts can send reminders." };

  const ids = [...new Set(animalIds.filter((id) => Number.isInteger(id)))];
  if (ids.length === 0 || !message.trim()) return { error: "Select at least one animal and enter a message." };

  const { data: animals, error: animalError } = await db.from("animals").select("id, name, user_id, next_due_date").in("id", ids).not("user_id", "is", null);
  if (animalError) return { error: animalError.message };

  let queued = 0;
  const dateKey = new Date().toISOString().slice(0, 10);
  for (const animal of animals ?? []) {
    const { error } = await db.from("notifications").insert({
      user_id: animal.user_id,
      title: "Vaccination reminder",
      message: message.trim(),
      type: "warning",
      dedupe_key: `manual:${animal.id}:${dateKey}`,
    });
    if (!error || error.code === "23505") queued += 1;
  }

  return { queued };
}