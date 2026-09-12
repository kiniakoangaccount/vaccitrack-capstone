"use server";

import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Looks up the email address for a given username.
 * Uses the service-role client to bypass RLS on profiles.
 * Returns null if the username doesn't exist or Supabase isn't configured.
 */
export async function resolveUsernameToEmail(username: string): Promise<{ email: string | null; error?: string }> {
  const db = createAdminClient();
  if (!db) return { email: null, error: "Service unavailable." };

  const { data, error } = await db
    .from("profiles")
    .select("id, username")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) return { email: null, error: "Lookup failed. Please try again." };
  if (!data) return { email: null, error: "No account found with that username." };

  // Fetch the email from auth.users via the admin API
  const { data: userData, error: userError } = await db.auth.admin.getUserById(data.id);
  if (userError || !userData.user?.email) return { email: null, error: "Could not resolve account email." };

  return { email: userData.user.email };
}
