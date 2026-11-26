"use server";

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
