"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export async function markNotificationRead(notificationId: number): Promise<{ error?: string }> {
  const { user, client, error: authError } = await getAuthenticatedUser();
  if (!user || !client) return { error: authError ?? "You must be signed in." };
  const { error } = await client.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function markAllNotificationsRead(userId: string): Promise<{ error?: string }> {
  const { user, client, error: authError } = await getAuthenticatedUser();
  if (!user || !client || user.id !== userId) return { error: authError ?? "You must be signed in." };
  const { error } = await client.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (error) return { error: error.message };
  return {};
}

async function isStaffUser(userId: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !!data && ["admin", "veterinarian", "bhw"].includes(data.role);
}

export async function createNotification(payload: { userId: string; title: string; message: string; type?: string }): Promise<{ error?: string }> {
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };
  if (!(await isStaffUser(user.id))) return { error: "Only staff accounts can send notifications." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("notifications").insert({ user_id: payload.userId, title: payload.title, message: payload.message, type: payload.type ?? "info" });
  if (error) return { error: error.message };
  return {};
}