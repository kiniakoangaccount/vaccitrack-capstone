"use server";

import { createAdminClient } from "@/lib/supabase-admin";

export async function resolveUsernameAuthIdentifier(username: string): Promise<{ authIdentifier: string | null; error?: string }> {
  const db = createAdminClient();
  if (!db) return { authIdentifier: null, error: "Service unavailable." };

  const { data, error } = await db
    .from("profiles")
    .select("id, username")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) return { authIdentifier: null, error: "Lookup failed. Please try again." };
  if (!data) return { authIdentifier: null, error: "No account found with that username." };

  // Supabase Auth requires this internal identity; users sign in with their username.
  const { data: userData, error: userError } = await db.auth.admin.getUserById(data.id);
  if (userError || !userData.user?.email) return { authIdentifier: null, error: "Could not resolve account identity." };

  return { authIdentifier: userData.user.email };
}
