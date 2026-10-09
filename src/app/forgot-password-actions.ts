"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createAuthenticatedClient } from "@/lib/supabase-server";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";
import { hasRealEmail } from "@/lib/account";

type ResetChannel = "email" | "sms";

// Signed-out equivalent of profile-actions.ts's session-based account lookup:
// resolves an email-or-username identifier to a user, without requiring the
// caller to already be authenticated.
async function findAccount(identifier: string): Promise<{ userId: string; email: string | null; contact: string | null } | null> {
  const db = createAdminClient();
  if (!db) return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  let userId: string;
  if (trimmed.includes("@")) {
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    const match = data?.users.find((candidate) => candidate.email?.toLowerCase() === trimmed.toLowerCase());
    if (!match) return null;
    userId = match.id;
  } else {
    const { data } = await db.from("profiles").select("id").eq("username", trimmed).maybeSingle();
    if (!data) return null;
    userId = data.id;
  }

  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const { data: profile } = await db.from("profiles").select("contact_number").eq("id", userId).maybeSingle();
  return {
    userId,
    email: hasRealEmail(authUser.user?.email) ? (authUser.user!.email as string) : null,
    contact: normalizePhilippineNumber(profile?.contact_number ?? ""),
  };
}

export async function getResetChannels(identifier: string): Promise<{ hasEmail: boolean; hasSms: boolean; found: boolean }> {
  const account = await findAccount(identifier);
  if (!account) return { hasEmail: false, hasSms: false, found: false };
  return { hasEmail: Boolean(account.email), hasSms: Boolean(account.contact), found: true };
}

export async function requestPasswordReset(identifier: string, channel: ResetChannel): Promise<{ error?: string }> {
  const account = await findAccount(identifier);
  if (!account) return { error: "No account found with that email or username." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  if (channel === "email") {
    if (!account.email) return { error: "This account has no email on file — use SMS instead." };
    const client = await createAuthenticatedClient();
    if (!client) return { error: "Service unavailable." };
    const { error } = await client.auth.signInWithOtp({ email: account.email, options: { shouldCreateUser: false } });
    if (error) return { error: error.message };
    return {};
  }

  if (!account.contact) return { error: "No valid mobile number on file for this account." };

  // Throttle: skip issuing a fresh code if an unexpired one was just sent, so
  // a repeated submit can't be used to spam SMS/email sends.
  const { data: recent } = await db
    .from("account_otps")
    .select("created_at")
    .eq("user_id", account.userId)
    .eq("purpose", "password_change")
    .eq("channel", "sms")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
    return { error: "A code was already sent. Please wait a minute before requesting another." };
  }

  const code = generateOtpCode();
  const { error: insertError } = await db.from("account_otps").insert({
    user_id: account.userId,
    purpose: "password_change",
    channel: "sms",
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (insertError) return { error: insertError.message };

  const result = await sendSms(account.contact, `Your VacciTrack password reset code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
  if (result.error) return { error: `Could not send the SMS code: ${result.error}` };
  return {};
}

export async function resetPasswordWithOtp(
  identifier: string,
  channel: ResetChannel,
  code: string,
  newPassword: string
): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters long." };

  const account = await findAccount(identifier);
  if (!account) return { error: "No account found with that email or username." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  if (channel === "email") {
    if (!account.email) return { error: "This account has no email on file — use SMS instead." };
    const client = await createAuthenticatedClient();
    if (!client) return { error: "Service unavailable." };
    const { error } = await client.auth.verifyOtp({ email: account.email, token: code, type: "email" });
    if (error) return { error: "That code is invalid or expired." };
  } else {
    const { data: otp } = await db
      .from("account_otps")
      .select("id, code_hash, expires_at")
      .eq("user_id", account.userId)
      .eq("purpose", "password_change")
      .eq("channel", "sms")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp || new Date(otp.expires_at) < new Date() || otp.code_hash !== hashOtpCode(code)) {
      return { error: "That code is invalid or expired." };
    }
    await db.from("account_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  }

  const { error } = await db.auth.admin.updateUserById(account.userId, { password: newPassword });
  if (error) return { error: error.message };
  return {};
}
