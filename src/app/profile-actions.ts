"use server";

import { createAdminClient } from "@/lib/supabase-admin";

export async function updateProfile(
  userId: string,
  payload: { fullName?: string; email?: string; contact?: string }
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const updates: Record<string, string> = {};
  if (payload.fullName !== undefined) updates.full_name = payload.fullName;
  if (payload.contact !== undefined) updates.contact_number = payload.contact;

  if (Object.keys(updates).length === 0) return {};

  const { error } = await db.from("profiles").update(updates).eq("id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function updatePassword(
  payload: { currentPassword?: string; newPassword: string }
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  if (payload.newPassword.length < 8) return { error: "Password must be at least 8 characters long." };

  try {
    await db.auth.admin.updateUserById("current-user-id", { password: payload.newPassword });
  } catch (e) {
    return { error: "Unable to update the password. Sign in again and try once more." };
  }
  return {};
}