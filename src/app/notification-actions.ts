"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";

async function getAuthenticatedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes are not available in every server action context.
        }
      },
    },
  });
}

export async function markNotificationRead(notificationId: number): Promise<{ error?: string }> {
  const client = await getAuthenticatedClient();
  if (!client) return { error: "Service unavailable." };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await client.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function markAllNotificationsRead(userId: string): Promise<{ error?: string }> {
  const client = await getAuthenticatedClient();
  if (!client) return { error: "Service unavailable." };
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.id !== userId) return { error: "You must be signed in." };
  const { error } = await client.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (error) return { error: error.message };
  return {};
}

export async function createNotification(payload: { userId: string; title: string; message: string; type?: string }): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("notifications").insert({ user_id: payload.userId, title: payload.title, message: payload.message, type: payload.type ?? "info" });
  if (error) return { error: error.message };
  return {};
}