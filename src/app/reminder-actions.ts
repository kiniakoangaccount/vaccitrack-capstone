"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";

export async function queueVaccinationReminders(
  animalIds: number[],
  message: string,
): Promise<{ error?: string; queued?: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const db = createAdminClient();
  if (!url || !anonKey || !db) return { error: "Service unavailable." };

  const cookieStore = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "You must be signed in." };

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