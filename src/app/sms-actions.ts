"use server";

import { createHash } from "node:crypto";
import { getManilaDateIso } from "@/lib/dates";
import { normalizePhilippineNumber, sendSms, sendSmsBatch } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { getAdminSession } from "./308873d1049ba0/actions";

const RECIPIENT_PAGE_SIZE = 500;
const MAX_BATCH_RECIPIENTS = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;
type SmsAudience =
  | { mode: "individual"; recipientId: string }
  | { mode: "due-in-7-days" };

type SmsProfile = {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
};

type SmsTarget = { name: string; phone: string };
type SmsAccess = { db: AdminDb; userId: string | null };
type SmsAccessResult = SmsAccess | { error: string };
type SmsTargetsResult =
  | { targets: SmsTarget[]; dueDate?: string }
  | { error: string };
type SuperAdminSmsAccess = { db: AdminDb; username: string };
type SuperAdminSmsAccessResult = SuperAdminSmsAccess | { error: string };

async function requireSmsAccess(): Promise<SmsAccessResult> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  if (await getAdminSession()) return { db, userId: null };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile, error } = await db
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (profile?.status !== "active" || !["admin", "bhw"].includes(profile.role)) {
    return { error: "Only active admin and BHW accounts can send SMS." };
  }

  return { db, userId: user.id };
}

async function requireSuperAdminSmsAccess(): Promise<SuperAdminSmsAccessResult> {
  const session = await getAdminSession();
  if (!session) return { error: "Only the super-admin can send test SMS messages." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  return { db, username: session.username };
}

function parseAudience(value: unknown): SmsAudience | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const audience = value as Record<string, unknown>;
  if (audience.mode === "due-in-7-days") return { mode: "due-in-7-days" };
  if (audience.mode === "individual" && typeof audience.recipientId === "string" && UUID_RE.test(audience.recipientId)) {
    return { mode: "individual", recipientId: audience.recipientId };
  }
  return null;
}

function profileName(profile: Pick<SmsProfile, "full_name" | "username">): string {
  return profile.full_name.trim() || profile.username?.trim() || "Client";
}

function fingerprintTargets(targets: SmsTarget[], dueDate?: string): string {
  const phones = targets.map((target) => target.phone).sort();
  return createHash("sha256").update(`${dueDate ?? ""}\n${phones.join("\n")}`).digest("hex");
}

async function getSmsTargets(db: AdminDb, audience: SmsAudience): Promise<SmsTargetsResult> {
  if (audience.mode === "individual") {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id, full_name, username, role, status, contact_number")
      .eq("id", audience.recipientId)
      .eq("role", "client")
      .eq("status", "active")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!profile) return { error: "That active client could not be found." };

    const phone = normalizePhilippineNumber(profile.contact_number ?? "");
    if (!phone) return { error: "That client does not have a valid mobile number." };
    return { targets: [{ name: profileName(profile), phone }] };
  }

  const dueDate = getManilaDateIso(7);
  const animals: { user_id: string | null; contact_number: string | null }[] = [];
  for (let offset = 0; ; offset += RECIPIENT_PAGE_SIZE) {
    const { data, error } = await db
      .from("animals")
      .select("user_id, contact_number")
      .eq("vaccinated", true)
      .eq("next_due_date", dueDate)
      .not("user_id", "is", null)
      .range(offset, offset + RECIPIENT_PAGE_SIZE - 1);
    if (error) return { error: error.message };
    const rows = (data ?? []) as typeof animals;
    animals.push(...rows);
    if (rows.length < RECIPIENT_PAGE_SIZE) break;
  }

  const userIds = [...new Set(animals.flatMap((animal) => animal.user_id ? [animal.user_id] : []))];
  const profilesById = new Map<string, SmsProfile>();
  for (let offset = 0; offset < userIds.length; offset += RECIPIENT_PAGE_SIZE) {
    const ids = userIds.slice(offset, offset + RECIPIENT_PAGE_SIZE);
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, username, role, status, contact_number")
      .in("id", ids);
    if (error) return { error: error.message };
    for (const profile of (data ?? []) as SmsProfile[]) profilesById.set(profile.id, profile);
  }

  const targetsByPhone = new Map<string, SmsTarget>();
  for (const animal of animals) {
    if (!animal.user_id) continue;
    const profile = profilesById.get(animal.user_id);
    if (!profile || profile.role !== "client" || profile.status !== "active") continue;
    const phone = normalizePhilippineNumber(profile.contact_number ?? "")
      ?? normalizePhilippineNumber(animal.contact_number ?? "");
    if (!phone || targetsByPhone.has(phone)) continue;
    targetsByPhone.set(phone, { name: profileName(profile), phone });
  }

  return { targets: [...targetsByPhone.values()], dueDate };
}

export async function getSmsRecipientOptions(): Promise<{
  recipients: { id: string; label: string }[];
  error?: string;
}> {
  const access = await requireSmsAccess();
  if ("error" in access) return { recipients: [], error: access.error };

  const recipients: { id: string; label: string }[] = [];
  for (let offset = 0; ; offset += RECIPIENT_PAGE_SIZE) {
    const { data, error } = await access.db
      .from("profiles")
      .select("id, full_name, username, role, status, contact_number")
      .eq("role", "client")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .range(offset, offset + RECIPIENT_PAGE_SIZE - 1);
    if (error) return { recipients: [], error: error.message };

    const rows = (data ?? []) as SmsProfile[];
    for (const profile of rows) {
      const phone = normalizePhilippineNumber(profile.contact_number ?? "");
      if (phone) recipients.push({ id: profile.id, label: `${profileName(profile)} · •••• ${phone.slice(-4)}` });
    }
    if (rows.length < RECIPIENT_PAGE_SIZE) break;
  }

  return { recipients };
}

export async function previewSmsRecipients(audienceInput: unknown): Promise<{
  count?: number;
  dueDate?: string;
  fingerprint?: string;
  names?: string[];
  error?: string;
}> {
  const access = await requireSmsAccess();
  if ("error" in access) return { error: access.error };
  const audience = parseAudience(audienceInput);
  if (!audience) return { error: "Choose a valid SMS audience." };

  const result = await getSmsTargets(access.db, audience);
  if ("error" in result) return { error: result.error };
  if (result.targets.length > MAX_BATCH_RECIPIENTS) {
    return { error: `This batch has ${result.targets.length} recipients. Semaphore allows up to ${MAX_BATCH_RECIPIENTS} per message.` };
  }
  return {
    count: result.targets.length,
    dueDate: result.dueDate,
    fingerprint: fingerprintTargets(result.targets, result.dueDate),
    names: result.targets.slice(0, 5).map((target) => target.name),
  };
}

export async function sendCustomSms(
  audienceInput: unknown,
  messageInput: unknown,
  expectedCount: unknown,
  expectedFingerprint: unknown,
): Promise<{ sent: number; failed: number; error?: string; detail?: string; warning?: string }> {
  const access = await requireSmsAccess();
  if ("error" in access) return { sent: 0, failed: 0, error: access.error };

  const audience = parseAudience(audienceInput);
  if (!audience) return { sent: 0, failed: 0, error: "Choose a valid SMS audience." };
  if (typeof messageInput !== "string") return { sent: 0, failed: 0, error: "Enter a message." };
  const message = messageInput.trim();
  if (!message || message.length > 320) return { sent: 0, failed: 0, error: "Enter a message up to 320 characters." };
  if (typeof expectedCount !== "number" || !Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_BATCH_RECIPIENTS) {
    return { sent: 0, failed: 0, error: "Preview the recipients before sending." };
  }
  if (typeof expectedFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(expectedFingerprint)) {
    return { sent: 0, failed: 0, error: "Review the recipients before sending." };
  }

  const targetResult = await getSmsTargets(access.db, audience);
  if ("error" in targetResult) return { sent: 0, failed: 0, error: targetResult.error };
  const targets = targetResult.targets;
  if (targets.length === 0) return { sent: 0, failed: 0, error: "There are no eligible recipients." };
  if (targets.length !== expectedCount) {
    return { sent: 0, failed: 0, error: "The recipient list changed. Review the recipients again before sending." };
  }
  if (fingerprintTargets(targets, targetResult.dueDate) !== expectedFingerprint) {
    return { sent: 0, failed: 0, error: "The recipient list changed. Review the recipients again before sending." };
  }

  const audienceLabel = audience.mode === "individual"
    ? `client ${targets[0].name}`
    : `clients with vaccinations due on ${targetResult.dueDate}`;
  const notes = `Custom SMS attempt to ${targets.length} ${audienceLabel}. Message: ${message.slice(0, 80)}`;
  const { data: auditEntry, error: auditInsertError } = await access.db
    .from("audit_log")
    .insert({
      user_id: access.userId,
      action: "SMS_ATTEMPT",
      table_name: "sms",
      notes,
    })
    .select("id")
    .single();
  if (auditInsertError) {
    console.error("Could not record SMS attempt:", auditInsertError.message);
    return { sent: 0, failed: 0, error: "Could not record the SMS attempt; nothing was sent." };
  }

  const delivery = await sendSmsBatch(targets.map((target) => target.phone), message);
  const sent = delivery.results.filter((result) => !result.error).length;
  const failed = targets.length - sent;
  const providerError = delivery.error ?? delivery.results.find((result) => result.error)?.error;
  const outcome = `Custom SMS: ${sent} sent, ${failed} failed out of ${targets.length}. Message: ${message.slice(0, 80)}${providerError ? ` Error: ${providerError.slice(0, 120)}` : ""}`;
  const { error: auditUpdateError } = await access.db
    .from("audit_log")
    .update({
      action: sent > 0 ? "SMS_SENT" : "SMS_ATTEMPT",
      notes: outcome,
    })
    .eq("id", auditEntry.id);
  if (auditUpdateError) {
    console.error("Could not update SMS audit result:", auditUpdateError.message);
    return { sent, failed, warning: "SMS results were returned, but the audit record could not be updated." };
  }

  return {
    sent,
    failed,
    error: sent === 0 ? providerError ?? "Semaphore did not accept the SMS." : undefined,
    detail: sent > 0 && failed > 0 ? providerError : undefined,
  };
}

export async function sendSuperAdminTestSms(
  recipientInput: unknown,
  messageInput: unknown,
): Promise<{ messageId?: string; error?: string; warning?: string }> {
  const access = await requireSuperAdminSmsAccess();
  if ("error" in access) return { error: access.error };
  if (typeof recipientInput !== "string") return { error: "Enter a valid Philippine mobile number." };
  if (typeof messageInput !== "string") return { error: "Enter a message." };

  const recipient = normalizePhilippineNumber(recipientInput);
  if (!recipient) return { error: "Enter a valid Philippine mobile number." };
  const message = messageInput.trim();
  if (!message || message.length > 320) return { error: "Enter a message up to 320 characters." };

  const attemptNotes = `Super-admin test SMS to number ending ${recipient.slice(-4)} by "${access.username}". Message: ${message.slice(0, 80)}`;
  const { data: auditEntry, error: auditInsertError } = await access.db
    .from("audit_log")
    .insert({
      user_id: null,
      action: "SMS_ATTEMPT",
      table_name: "sms",
      notes: attemptNotes,
    })
    .select("id")
    .single();
  if (auditInsertError) {
    console.error("Could not record super-admin test SMS attempt:", auditInsertError.message);
    return { error: "Could not record the SMS attempt; nothing was sent." };
  }

  const delivery = await sendSms(recipient, message);
  const notes = delivery.error
    ? `Super-admin test SMS failed to number ending ${recipient.slice(-4)}. Error: ${delivery.error.slice(0, 120)}`
    : `Super-admin test SMS sent to number ending ${recipient.slice(-4)}. Message: ${message.slice(0, 80)}`;
  const { error: auditUpdateError } = await access.db
    .from("audit_log")
    .update({
      action: delivery.error ? "SMS_ATTEMPT" : "SMS_SENT",
      notes,
    })
    .eq("id", auditEntry.id);
  if (auditUpdateError) {
    console.error("Could not update super-admin test SMS audit result:", auditUpdateError.message);
  }

  return {
    messageId: delivery.messageId,
    error: delivery.error,
    warning: auditUpdateError ? "The SMS result could not be saved to the audit log." : undefined,
  };
}
