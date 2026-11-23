"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";
import { hasRealEmail } from "@/lib/account";

type OtpPurpose = "username_change" | "password_change";
type OtpChannel = "email" | "sms";

export async function updateProfile(
  payload: { fullName?: string; email?: string; contact?: string }
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const updates: Record<string, string> = {};
  if (payload.fullName !== undefined) updates.full_name = payload.fullName;
  if (payload.contact !== undefined) updates.contact_number = payload.contact;

  // An empty email means "leave it as-is" — this lets placeholder-email
  // accounts (registered with SMS only) skip the field without Supabase
  // rejecting a blank email.
  if (payload.email) {
    const { error } = await db.auth.admin.updateUserById(user.id, { email: payload.email });
    if (error) return { error: error.message };
  }
  if (Object.keys(updates).length === 0) return {};

  const { error } = await db.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function getAccountChannels(): Promise<{ hasEmail: boolean; hasSms: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { hasEmail: false, hasSms: false, error: "Service unavailable." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { hasEmail: false, hasSms: false, error: authError ?? "You must be signed in." };

  const { data: profile } = await db.from("profiles").select("contact_number").eq("id", user.id).maybeSingle();
  return {
    hasEmail: hasRealEmail(user.email),
    hasSms: Boolean(normalizePhilippineNumber(profile?.contact_number ?? "")),
  };
}

export async function requestAccountOtp(purpose: OtpPurpose, channel: OtpChannel): Promise<{ error?: string }> {
  if (purpose === "password_change" && channel !== "sms") {
    return { error: "Password changes require SMS verification." };
  }

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, client, error: authError } = await getAuthenticatedUser();
  if (!user || !client) return { error: authError ?? "You must be signed in." };

  if (channel === "email") {
    if (!hasRealEmail(user.email)) return { error: "This account has no email on file — use SMS instead." };
    const { error } = await client.auth.signInWithOtp({ email: user.email!, options: { shouldCreateUser: false } });
    if (error) return { error: error.message };
    return {};
  }

  const { data: profile } = await db.from("profiles").select("contact_number").eq("id", user.id).maybeSingle();
  const target = normalizePhilippineNumber(profile?.contact_number ?? "");
  if (!target) return { error: "No valid mobile number on file for this account." };

  const code = generateOtpCode();
  const { error: insertError } = await db.from("account_otps").insert({
    user_id: user.id,
    purpose,
    channel: "sms",
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (insertError) return { error: insertError.message };

  const result = await sendSms(target, `Your VacciTrack verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
  if (result.error) return { error: `Could not send the SMS code: ${result.error}` };
  return {};
}

async function consumeOtp(purpose: OtpPurpose, channel: OtpChannel, code: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, client, error: authError } = await getAuthenticatedUser();
  if (!user || !client) return { error: authError ?? "You must be signed in." };

  if (channel === "email") {
    if (!hasRealEmail(user.email)) return { error: "This account has no email on file — use SMS instead." };
    const { error } = await client.auth.verifyOtp({ email: user.email!, token: code, type: "email" });
    if (error) return { error: "That code is invalid or expired." };
    return {};
  }

  const { data: otp } = await db
    .from("account_otps")
    .select("id, code_hash, expires_at")
    .eq("user_id", user.id)
    .eq("purpose", purpose)
    .eq("channel", "sms")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp || new Date(otp.expires_at) < new Date() || otp.code_hash !== hashOtpCode(code)) {
    return { error: "That code is invalid or expired." };
  }
  await db.from("account_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  return {};
}

export async function changeUsernameWithOtp(
  newUsername: string,
  channel: OtpChannel,
  code: string
): Promise<{ error?: string }> {
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(newUsername)) {
    return { error: "Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens." };
  }
  const verify = await consumeOtp("username_change", channel, code);
  if (verify.error) return verify;

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { error } = await db.from("profiles").update({ username: newUsername }).eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "That username is already taken." : error.message };
  return {};
}

export async function changePasswordWithOtp(
  newPassword: string,
  code: string
): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters long." };
  const verify = await consumeOtp("password_change", "sms", code);
  if (verify.error) return verify;

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { error } = await db.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) return { error: error.message };
  return {};
}
