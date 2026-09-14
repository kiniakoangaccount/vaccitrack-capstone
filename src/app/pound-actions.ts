"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

const POUND_STATUSES = ["Impounded", "Under Observation", "Up for Adoption", "Reclaimed"] as const;
export type PoundStatus = (typeof POUND_STATUSES)[number];

export async function updatePoundStatus(
  animalId: number,
  status: PoundStatus
): Promise<{ error?: string }> {
  if (!POUND_STATUSES.includes(status)) return { error: "Invalid status." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "veterinarian", "bhw"].includes(profile.role)) {
    return { error: "Only staff accounts can update pound status." };
  }

  const { error } = await db.from("animals").update({ pound_status: status }).eq("id", animalId);
  if (error) return { error: error.message };
  return {};
}
