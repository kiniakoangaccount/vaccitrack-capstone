"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";
import { getAdminSession } from "../actions";

export type ManagedPurok = { id: number; name: string; latitude: number; longitude: number };

async function getSuperAdminDatabase() {
  const session = await getAdminSession();
  if (!session) return { db: null, error: "Your administrator session has expired. Sign in again." };
  const db = createAdminClient();
  if (!db) return { db: null, error: "Database service is unavailable." };
  return { db, error: null };
}

function validPurok(input: { name: string; latitude: number; longitude: number }) {
  return input.name.trim().length > 0 && input.name.trim().length <= 100 &&
    Number.isFinite(input.latitude) && input.latitude >= -90 && input.latitude <= 90 &&
    Number.isFinite(input.longitude) && input.longitude >= -180 && input.longitude <= 180;
}

export async function saveSuperAdminPurok(input: {
  id: number | null;
  name: string;
  latitude: number;
  longitude: number;
}): Promise<{ row?: ManagedPurok; error?: string }> {
  const { db, error } = await getSuperAdminDatabase();
  if (!db) return { error: error ?? "Unauthorized." };
  if (!validPurok(input)) return { error: "Enter a purok name and valid latitude and longitude." };

  const payload = { name: input.name.trim(), latitude: input.latitude, longitude: input.longitude };
  const result = input.id
    ? await db.from("puroks").update(payload).eq("id", input.id).select("id, name, latitude, longitude").single()
    : await db.from("puroks").insert(payload).select("id, name, latitude, longitude").single();
  if (result.error || !result.data) return { error: result.error?.message ?? "Could not save this purok." };

  const row = result.data as ManagedPurok;
  await logAudit(db, {
    userId: null,
    action: input.id ? "UPDATE" : "INSERT",
    tableName: "puroks",
    recordId: row.id,
    notes: `${input.id ? "Updated" : "Added"} purok “${row.name}” from the super-admin dashboard.`,
  });
  revalidatePath("/");
  revalidatePath("/vaccitrack_super_hidden_admin/dashboard");
  return { row };
}

export async function deleteSuperAdminPurok(id: number): Promise<{ error?: string }> {
  const { db, error } = await getSuperAdminDatabase();
  if (!db) return { error: error ?? "Unauthorized." };
  const { data, error: deleteError } = await db.from("puroks").delete().eq("id", id).select("id, name").single();
  if (deleteError || !data) return { error: deleteError?.message ?? "Could not remove this purok." };

  await logAudit(db, {
    userId: null,
    action: "DELETE",
    tableName: "puroks",
    recordId: data.id,
    notes: `Removed purok “${data.name}” from the super-admin dashboard.`,
  });
  revalidatePath("/");
  revalidatePath("/vaccitrack_super_hidden_admin/dashboard");
  return {};
}
