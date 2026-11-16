"use server";

import { createHash } from "node:crypto";
import { hasRealEmail } from "@/lib/account";
import { getManilaDateIso } from "@/lib/dates";
import { sendEmailBatch, type EmailTarget } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { completeMessageHistory, startMessageHistory } from "./message-history";
import { getAdminSession } from "./vaccitrack_super_hidden_admin/actions";

const RECIPIENT_PAGE_SIZE = 500;
const MAX_BATCH_RECIPIENTS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailAudience =
  | { mode: "individual"; recipientId: string }
  | { mode: "due-in-7-days" };

type EmailProfile = {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
};

type EmailAccess = { db: NonNullable<ReturnType<typeof createAdminClient>>; userId: string | null; sender: string };
type EmailAccessResult = EmailAccess | { error: string };
type EmailTargetsResult = { targets: EmailTarget[]; dueDate?: string } | { error: string };
type ProfilesEmailsResult = { emailsById: Map<string, string> } | { error: string };

async function requireEmailAccess(): Promise<EmailAccessResult> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const adminSession = await getAdminSession();
  if (adminSession) return { db, userId: null, sender: adminSession.username };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile, error } = await db
    .from("profiles")
    .select("role, status, full_name, username")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (profile?.status !== "active" || !["admin", "bhw"].includes(profile.role)) {
    return { error: "Only active admin and BHW accounts can send email." };
  }

  return {
    db,
    userId: user.id,
    sender: profile.full_name.trim() || profile.username?.trim() || user.id,
  };
}

function parseAudience(value: unknown): EmailAudience | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const audience = value as Record<string, unknown>;
  if (audience.mode === "due-in-7-days") return { mode: "due-in-7-days" };
  if (audience.mode === "individual" && typeof audience.recipientId === "string" && UUID_RE.test(audience.recipientId)) {
    return { mode: "individual", recipientId: audience.recipientId };
  }
  return null;
}

function profileName(profile: Pick<EmailProfile, "full_name" | "username">): string {
  return profile.full_name.trim() || profile.username?.trim() || "Client";
}

function fingerprintTargets(targets: EmailTarget[], dueDate?: string): string {
  const emails = targets.map((target) => target.email.toLowerCase()).sort();
  return createHash("sha256").update(`${dueDate ?? ""}\n${emails.join("\n")}`).digest("hex");
}

async function getProfilesEmails(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  profiles: EmailProfile[],
): Promise<ProfilesEmailsResult> {
  const emailsById = new Map<string, string>();
  const pendingIds = new Set(profiles.map((profile) => profile.id));
  const pageSize = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) return { error: "Could not load client email addresses." };

    for (const user of data.users) {
      if (!pendingIds.delete(user.id)) continue;
      const email = user.email;
      if (typeof email === "string" && hasRealEmail(email) && EMAIL_RE.test(email)) {
        emailsById.set(user.id, email);
      }
    }
    if (pendingIds.size === 0 || data.users.length < pageSize) break;
  }

  return { emailsById };
}

async function getEmailTargets(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  audience: EmailAudience,
): Promise<EmailTargetsResult> {
  if (audience.mode === "individual") {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id, full_name, username, role, status")
      .eq("id", audience.recipientId)
      .eq("role", "client")
      .eq("status", "active")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!profile) return { error: "That active client could not be found." };

    const result = await getProfilesEmails(db, [profile as EmailProfile]);
    if ("error" in result) return { error: result.error };
    const email = result.emailsById.get(profile.id);
    if (!email) return { error: "That client does not have a valid email address." };
    return { targets: [{ name: profileName(profile as EmailProfile), email }] };
  }

  const dueDate = getManilaDateIso(7);
  const animals: { user_id: string | null }[] = [];
  for (let offset = 0; ; offset += RECIPIENT_PAGE_SIZE) {
    const { data, error } = await db
      .from("animals")
      .select("user_id")
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
  const profiles: EmailProfile[] = [];
  for (let offset = 0; offset < userIds.length; offset += RECIPIENT_PAGE_SIZE) {
    const ids = userIds.slice(offset, offset + RECIPIENT_PAGE_SIZE);
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, username, role, status")
      .in("id", ids);
    if (error) return { error: error.message };
    profiles.push(...(data ?? []) as EmailProfile[]);
  }

  const eligibleProfiles = profiles.filter((profile) => profile.role === "client" && profile.status === "active");
  const result = await getProfilesEmails(db, eligibleProfiles);
  if ("error" in result) return { error: result.error };

  const targetsByEmail = new Map<string, EmailTarget>();
  for (const profile of eligibleProfiles) {
    const email = result.emailsById.get(profile.id);
    if (email && !targetsByEmail.has(email.toLowerCase())) {
      targetsByEmail.set(email.toLowerCase(), { name: profileName(profile), email });
    }
  }

  return { targets: [...targetsByEmail.values()], dueDate };
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  const visibleEnd = name.length > 2 ? name.slice(-1) : "";
  return `${name.slice(0, 1)}***${visibleEnd}@${domain}`;
}

export async function getEmailRecipientOptions(): Promise<{
  recipients: { id: string; label: string }[];
  error?: string;
}> {
  const access = await requireEmailAccess();
  if ("error" in access) return { recipients: [], error: access.error };

  const profiles: EmailProfile[] = [];
  for (let offset = 0; ; offset += RECIPIENT_PAGE_SIZE) {
    const { data, error } = await access.db
      .from("profiles")
      .select("id, full_name, username, role, status")
      .eq("role", "client")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .range(offset, offset + RECIPIENT_PAGE_SIZE - 1);
    if (error) return { recipients: [], error: error.message };

    const rows = (data ?? []) as EmailProfile[];
    profiles.push(...rows);
    if (rows.length < RECIPIENT_PAGE_SIZE) break;
  }

  const result = await getProfilesEmails(access.db, profiles);
  if ("error" in result) return { recipients: [], error: result.error };

  return {
    recipients: profiles.flatMap((profile) => {
      const email = result.emailsById.get(profile.id);
      return email ? [{ id: profile.id, label: `${profileName(profile)} · ${maskEmail(email)}` }] : [];
    }),
  };
}

export async function previewEmailRecipients(audienceInput: unknown): Promise<{
  count?: number;
  dueDate?: string;
  fingerprint?: string;
  names?: string[];
  error?: string;
}> {
  const access = await requireEmailAccess();
  if ("error" in access) return { error: access.error };
  const audience = parseAudience(audienceInput);
  if (!audience) return { error: "Choose a valid email audience." };

  const result = await getEmailTargets(access.db, audience);
  if ("error" in result) return { error: result.error };
  if (result.targets.length > MAX_BATCH_RECIPIENTS) {
    return { error: `This batch has ${result.targets.length} recipients. Gmail email batches are limited to ${MAX_BATCH_RECIPIENTS} per send.` };
  }
  return {
    count: result.targets.length,
    dueDate: result.dueDate,
    fingerprint: fingerprintTargets(result.targets, result.dueDate),
    names: result.targets.slice(0, 5).map((target) => target.name),
  };
}

export async function sendCustomEmail(
  audienceInput: unknown,
  subjectInput: unknown,
  messageInput: unknown,
  expectedCount: unknown,
  expectedFingerprint: unknown,
): Promise<{ sent: number; failed: number; error?: string; detail?: string; warning?: string }> {
  const access = await requireEmailAccess();
  if ("error" in access) return { sent: 0, failed: 0, error: access.error };

  const audience = parseAudience(audienceInput);
  if (!audience) return { sent: 0, failed: 0, error: "Choose a valid email audience." };
  if (typeof subjectInput !== "string") return { sent: 0, failed: 0, error: "Enter an email subject." };
  const subject = subjectInput.trim();
  if (!subject || subject.length > 160 || /[\r\n]/.test(subject)) {
    return { sent: 0, failed: 0, error: "Enter an email subject up to 160 characters." };
  }
  if (typeof messageInput !== "string") return { sent: 0, failed: 0, error: "Enter an email message." };
  const message = messageInput.trim();
  if (!message || message.length > 10000) return { sent: 0, failed: 0, error: "Enter an email message up to 10,000 characters." };
  if (typeof expectedCount !== "number" || !Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_BATCH_RECIPIENTS) {
    return { sent: 0, failed: 0, error: "Review the recipients before sending." };
  }
  if (typeof expectedFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(expectedFingerprint)) {
    return { sent: 0, failed: 0, error: "Review the recipients before sending." };
  }

  const targetResult = await getEmailTargets(access.db, audience);
  if ("error" in targetResult) return { sent: 0, failed: 0, error: targetResult.error };
  const targets = targetResult.targets;
  if (targets.length === 0) return { sent: 0, failed: 0, error: "There are no eligible recipients." };
  if (targets.length !== expectedCount || fingerprintTargets(targets, targetResult.dueDate) !== expectedFingerprint) {
    return { sent: 0, failed: 0, error: "The recipient list changed. Review the recipients again before sending." };
  }

  const audienceLabel = audience.mode === "individual"
    ? `client ${targets[0].name}`
    : `clients with vaccinations due on ${targetResult.dueDate}`;
  const { data: auditEntry, error: auditInsertError } = await access.db
    .from("audit_log")
    .insert({
      user_id: access.userId,
      action: "EMAIL_ATTEMPT",
      table_name: "email",
      notes: `Custom email attempt to ${targets.length} ${audienceLabel}. Subject: ${subject.slice(0, 80)}`,
    })
    .select("id")
    .single();
  if (auditInsertError) {
    console.error("Could not record email attempt:", auditInsertError.message);
    return { sent: 0, failed: 0, error: "Could not record the email attempt; nothing was sent." };
  }

  const history = await startMessageHistory(access.db, targets.map((target) => ({
    channel: "email",
    message_type: "custom",
    recipient_name: target.name,
    recipient_address: target.email,
    subject,
    sent_by: access.sender,
  })));
  if ("error" in history) return { sent: 0, failed: 0, error: history.error };

  const delivery = await sendEmailBatch(targets, subject, message);
  const delivered = targets.map((_, index) => !delivery.error && !delivery.results[index]?.error);
  const sent = delivered.filter(Boolean).length;
  const failed = targets.length - sent;
  const providerError = delivery.error ?? delivery.results.find((result) => result.error)?.error;
  const historySaved = await completeMessageHistory(access.db, history.ids, delivered);
  const notes = `Custom email: ${sent} sent, ${failed} failed out of ${targets.length}. Subject: ${subject.slice(0, 80)}${providerError ? ` Error: ${providerError.slice(0, 120)}` : ""}`;
  const { error: auditUpdateError } = await access.db
    .from("audit_log")
    .update({ action: sent > 0 ? "EMAIL_SENT" : "EMAIL_ATTEMPT", notes })
    .eq("id", auditEntry.id);
  const warnings = [
    auditUpdateError ? "Email results were returned, but the audit record could not be updated." : undefined,
    !historySaved ? "Email results were returned, but sent-message history could not be updated." : undefined,
  ].filter(Boolean);
  if (auditUpdateError) {
    console.error("Could not update email audit result:", auditUpdateError.message);
  }

  return {
    sent,
    failed,
    error: sent === 0 ? providerError ?? "Google SMTP did not accept the email." : undefined,
    detail: sent > 0 && failed > 0 ? providerError : undefined,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

export async function sendSuperAdminTestEmail(
  recipientInput: unknown,
  messageInput: unknown,
): Promise<{ error?: string; warning?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Only the super-admin can send test emails." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  if (typeof recipientInput !== "string" || !EMAIL_RE.test(recipientInput.trim())) {
    return { error: "Enter a valid email address." };
  }
  if (typeof messageInput !== "string") return { error: "Enter a test message." };
  const recipient = recipientInput.trim();
  const message = messageInput.trim();
  if (!message || message.length > 10000) return { error: "Enter a test message up to 10,000 characters." };

  const subject = "VacciTrack test email";
  const maskedRecipient = maskEmail(recipient);
  const { data: auditEntry, error: auditInsertError } = await db
    .from("audit_log")
    .insert({
      user_id: null,
      action: "EMAIL_ATTEMPT",
      table_name: "email",
      notes: `Super-admin test email attempt to ${maskedRecipient} by "${session.username}".`,
    })
    .select("id")
    .single();
  if (auditInsertError) {
    console.error("Could not record super-admin test email attempt:", auditInsertError.message);
    return { error: "Could not record the email attempt; nothing was sent." };
  }

  const history = await startMessageHistory(db, [{
    channel: "email",
    message_type: "test",
    recipient_name: null,
    recipient_address: recipient,
    subject,
    sent_by: session.username,
  }]);
  if ("error" in history) return { error: history.error };

  const delivery = await sendEmailBatch([{ name: "", email: recipient }], subject, message);
  const providerError = delivery.results[0]?.error ?? delivery.error;
  const historySaved = await completeMessageHistory(db, history.ids, [!providerError]);
  const notes = providerError
    ? `Super-admin test email failed to ${maskedRecipient}. Error: ${providerError.slice(0, 120)}`
    : `Super-admin test email sent to ${maskedRecipient}.`;
  const { error: auditUpdateError } = await db
    .from("audit_log")
    .update({
      action: providerError ? "EMAIL_ATTEMPT" : "EMAIL_SENT",
      notes,
    })
    .eq("id", auditEntry.id);
  if (auditUpdateError) {
    console.error("Could not update super-admin test email audit result:", auditUpdateError.message);
  }

  return {
    error: providerError,
    warning: [
      auditUpdateError ? "The email result could not be saved to the audit log." : undefined,
      !historySaved ? "The email result could not be saved to sent-message history." : undefined,
    ].filter(Boolean).join(" ") || undefined,
  };
}
