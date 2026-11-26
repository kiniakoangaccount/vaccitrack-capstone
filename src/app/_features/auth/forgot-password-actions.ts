"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";

async function findAccount(username: string): Promise<{ userId: string; contact: string | null } | null> {
  const db = createAdminClient();
  if (!db) return null;
  const trimmed = username.trim();
  if (!trimmed) return null;

  const { data } = await db.from("profiles").select("id, contact_number").eq("username", trimmed).maybeSingle();
  if (!data) return null;
  return {
    userId: data.id,
    contact: normalizePhilippineNumber(data.contact_number ?? ""),
  };
}

export async function getResetChannels(username: string): Promise<{ hasSms: boolean; found: boolean }> {
  const account = await findAccount(username);
  if (!account) return { hasSms: false, found: false };
  return { hasSms: Boolean(account.contact), found: true };
}

export async function requestPasswordReset(username: string): Promise<{ error?: string }> {
  const account = await findAccount(username);
  if (!account) return { error: "No account found with that username." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  if (!account.contact) return { error: "No valid mobile number on file for this account." };

  // Throttle repeated requests while the most recent code is still fresh.
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
  username: string,
  code: string,
  newPassword: string
): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters long." };

  const account = await findAccount(username);
  if (!account) return { error: "No account found with that username." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

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

  const { error } = await db.auth.admin.updateUserById(account.userId, { password: newPassword });
  if (error) return { error: error.message };
  return {};
}
