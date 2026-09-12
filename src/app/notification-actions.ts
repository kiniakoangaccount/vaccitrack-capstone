"use server";

import { createAdminClient } from "@/lib/supabase-admin";

export async function markNotificationRead(notificationId: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) return { error: error.message };
  return {};
}

export async function markAllNotificationsRead(userId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) return { error: error.message };
  return {};
}

export async function createNotification(payload: { userId: string; title: string; message: string; type?: string }): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("notifications").insert({ user_id: payload.userId, title: payload.title, message: payload.message, type: payload.type ?? "alert" });
  if (error) return { error: error.message };
  return {};
}