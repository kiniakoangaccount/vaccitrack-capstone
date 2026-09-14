"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createAccountFromForm } from "@/lib/register-account";

export async function registerViaInvite(formData: FormData): Promise<{ error?: string }> {
  const token = (formData.get("token") as string | null) ?? "";
  const db = createAdminClient();
  if (!db) return { error: "Registration is not available yet — the system is not connected to Supabase." };

  const { data: invite } = await db
    .from("staff_invites")
    .select("id, role, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { error: "This invite link is invalid." };
  if (invite.used_at) return { error: "This invite link has already been used." };
  if (new Date(invite.expires_at) < new Date()) return { error: "This invite link has expired." };

  const role = invite.role as "bhw" | "veterinarian" | "admin";
  const status = role === "admin" ? "pending" : "active";

  const result = await createAccountFromForm(formData, role, status);
  if (result.error) return { error: result.error };

  await db.from("staff_invites").update({ used_at: new Date().toISOString(), used_by: result.userId }).eq("id", invite.id);
  await db.from("audit_log").insert({
    user_id: result.userId ?? null,
    action: "INSERT",
    table_name: "profiles",
    notes: `Account registered via staff invite (role: ${role}).`,
  });

  return {};
}
