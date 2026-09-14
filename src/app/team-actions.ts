"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export type TeamMember = { id: string; fullName: string; role: string; username: string | null; status: string };

export async function getTeamMembers(): Promise<{ members?: TeamMember[]; error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: caller } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!caller || !["admin", "veterinarian", "bhw"].includes(caller.role)) {
    return { error: "Only staff accounts can view the team list." };
  }

  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, role, username, status")
    .in("role", ["admin", "veterinarian", "bhw"])
    .order("role")
    .order("full_name");
  if (error) return { error: error.message };

  return { members: (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name, role: row.role, username: row.username, status: row.status })) };
}
