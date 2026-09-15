"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createAccountFromForm } from "@/lib/register-account";

export async function registerViaInvite(formData: FormData): Promise<{ error?: string }> {
  const token = (formData.get("token") as string | null) ?? "";
  const db = createAdminClient();
  if (!db) return { error: "Registration is not available yet — the system is not connected to Supabase." };

  // Atomic claim: the DB-side UPDATE...WHERE used_at is null is the single
  // point of truth, so two concurrent requests for the same token can never
  // both succeed here — only one gets a claim back.
  const { data: claimRows, error: claimError } = await db.rpc("claim_staff_invite", { p_token: token });
  if (claimError) return { error: "Could not process this invite. Please try again." };

  const claim = claimRows?.[0];
  if (!claim) {
    // Read-only, for messaging only — the claim above already made the real decision.
    const { data: invite } = await db.from("staff_invites").select("used_at, expires_at").eq("token", token).maybeSingle();
    if (!invite) return { error: "This invite link is invalid." };
    if (invite.used_at) return { error: "This invite link has already been used." };
    return { error: "This invite link has expired." };
  }

  const role = claim.invite_role as "bhw" | "admin";
  const status = role === "admin" ? "pending" : "active";

  const result = await createAccountFromForm(formData, role, status);
  if (result.error || !result.userId) {
    // Release using claim ownership, never an unconditional update, so this
    // can't undo a different claim that has since taken over the row.
    await db.rpc("release_staff_invite", { p_invite_id: claim.invite_id, p_claim_id: claim.claim_id });
    return { error: result.error ?? "Registration failed. Please try again." };
  }

  await db.rpc("finalize_staff_invite", { p_invite_id: claim.invite_id, p_claim_id: claim.claim_id, p_user_id: result.userId });
  await db.from("audit_log").insert({
    user_id: result.userId,
    action: "INSERT",
    table_name: "profiles",
    notes: `Account registered via staff invite (role: ${role}).`,
  });

  return {};
}
