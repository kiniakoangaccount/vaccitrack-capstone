import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";
import { getManilaDateIso } from "@/lib/dates";

export const maxDuration = 60;

type ReminderType = "D7" | "D1" | "OVERDUE";
type Language = "en" | "tl" | "hil";
type ChannelName = "sms";

type AnimalAlert = {
  id: number;
  name: string;
  next_due_date: string;
  user_id: string;
  contact_number: string | null;
  vaccine_type: string | null;
};

type AlertProfile = {
  id: string;
  contact_number: string | null;
  full_name: string;
  username: string | null;
  preferred_language: string | null;
  notify_sms: boolean | null;
};

type AlertTarget = {
  animal: AnimalAlert;
  dueDate: string;
  reminderType: ReminderType;
  scheduled: boolean;
  retryChannels: Set<ChannelName>;
};

type FailedAlert = {
  id: number;
  animal_id: number;
  user_id: string;
  due_date: string;
  channel: ChannelName;
  reminder_type: ReminderType;
  status: "failed" | "pending";
};

type ReminderJob = {
  target: AlertTarget;
  channel: ChannelName;
  recipient: string;
  message: string;
};

type ChannelSummary = {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  smsSegments: number;
  unicodeMessages: number;
};

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

const PAGE_SIZE = 500;
const CONCURRENCY = 5;
const GSM_BASIC = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const GSM_EXTENSION = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

const REMINDER_TEXT: Record<Language, Record<ReminderType, string>> = {
  en: {
    D7: "Hello {owner}. {animal}'s {vaccine} vaccination is due on {date}. Please visit {clinic} to schedule a vaccination.",
    D1: "Hello {owner}. Reminder: {animal}'s {vaccine} vaccination is due tomorrow, {date}. Please visit {clinic}.",
    OVERDUE: "Hello {owner}. {animal}'s {vaccine} vaccination was due on {date} and is now overdue. Please visit {clinic}.",
  },
  tl: {
    D7: "Kumusta, {owner}. Takda sa {date} ang bakunang {vaccine} ni {animal}. Mangyaring bumisita sa {clinic} para magpa-iskedyul ng bakuna.",
    D1: "Kumusta, {owner}. Bukas, {date}, ang takdang bakunang {vaccine} ni {animal}. Mangyaring bumisita sa {clinic}.",
    OVERDUE: "Kumusta, {owner}. Lumampas na sa takdang petsa na {date} ang bakunang {vaccine} ni {animal}. Mangyaring bumisita sa {clinic}.",
  },
  hil: {
    D7: "Kumusta, {owner}. Takna na sang bakuna nga {vaccine} ni {animal} sa {date}. Palihog magkadto sa {clinic} agud magpa-iskedyul sang bakuna.",
    D1: "Kumusta, {owner}. Buwas, {date}, ang iskedyul sang bakuna nga {vaccine} ni {animal}. Palihog magkadto sa {clinic}.",
    OVERDUE: "Kumusta, {owner}. Nalabyan na ang petsa nga {date} para sa bakuna nga {vaccine} ni {animal}. Palihog magkadto sa {clinic}.",
  },
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get("authorization") ?? "";
  const header = request.headers.get("x-cron-secret") ?? "";
  return safeEqual(bearer, `Bearer ${secret}`) || safeEqual(header, secret);
}

function enabledChannels(): { channels?: Set<ChannelName>; error?: string } {
  const configured = process.env.REMINDER_CHANNELS;
  if (configured === undefined) return { channels: new Set(["sms"]) };
  if (configured.trim().toLowerCase() === "none" || !configured.trim()) return { channels: new Set() };

  const names = configured.split(",").map((channel) => channel.trim().toLowerCase()).filter(Boolean);
  if (names.some((channel) => channel !== "sms")) {
    return { error: "REMINDER_CHANNELS must contain only sms." };
  }
  return { channels: new Set(names as ChannelName[]) };
}

function cleanText(value: string | null | undefined, fallback: string, maxLength = 100): string {
  const cleaned = (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, maxLength);
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function profileLanguage(value: string | null | undefined): Language {
  return value === "tl" || value === "hil" ? value : "en";
}

function buildMessage(
  target: AlertTarget,
  profile: AlertProfile | undefined,
  language: Language,
): string {
  const animal = cleanText(target.animal.name, "your animal");
  const owner = cleanText(profile?.full_name || profile?.username, "Client");
  const vaccine = cleanText(target.animal.vaccine_type, "rabies");
  const clinic = cleanText(process.env.CLINIC_INFO, "the barangay health station");
  const barangay = cleanText(process.env.BARANGAY_NAME, "Barangay Estefania");
  const template = REMINDER_TEXT[language][target.reminderType]
    .replace("{owner}", owner)
    .replace("{animal}", animal)
    .replace("{vaccine}", vaccine)
    .replace("{date}", formatDate(target.dueDate))
    .replace("{clinic}", clinic);

  return `${barangay}: ${template}`;
}

function estimateSms(message: string): { encoding: "GSM-7" | "UCS-2"; characters: number; segments: number } {
  let gsmCharacters = 0;
  let gsm = true;
  for (const character of message) {
    if (GSM_BASIC.has(character)) gsmCharacters += 1;
    else if (GSM_EXTENSION.has(character)) gsmCharacters += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) {
    const characters = message.length;
    return { encoding: "UCS-2", characters, segments: characters === 0 ? 0 : characters <= 70 ? 1 : Math.ceil(characters / 67) };
  }
  return { encoding: "GSM-7", characters: gsmCharacters, segments: gsmCharacters === 0 ? 0 : gsmCharacters <= 160 ? 1 : Math.ceil(gsmCharacters / 153) };
}

function addTarget(
  targets: Map<string, AlertTarget>,
  animal: AnimalAlert,
  dueDate: string,
  reminderType: ReminderType,
  scheduled: boolean,
  retryChannel?: ChannelName,
): void {
  const key = `${animal.id}:${dueDate}:${reminderType}`;
  const existing = targets.get(key);
  if (existing) {
    existing.scheduled ||= scheduled;
    if (retryChannel) existing.retryChannels.add(retryChannel);
    return;
  }
  targets.set(key, {
    animal,
    dueDate,
    reminderType,
    scheduled,
    retryChannels: retryChannel ? new Set([retryChannel]) : new Set(),
  });
}

async function loadAnimalsForDueDate(db: AdminDb, dueDate: string): Promise<{ animals?: AnimalAlert[]; error?: string }> {
  const animals: AnimalAlert[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db.from("animals")
      .select("id, name, next_due_date, user_id, contact_number, vaccine_type")
      .eq("vaccinated", true)
      .eq("next_due_date", dueDate)
      .not("user_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error: error.message };
    const rows = (data ?? []) as AnimalAlert[];
    animals.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { animals };
}

async function loadOverdueAnimals(db: AdminDb, todayDate: string): Promise<{ animals?: AnimalAlert[]; error?: string }> {
  const animals: AnimalAlert[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db.from("animals")
      .select("id, name, next_due_date, user_id, contact_number, vaccine_type")
      .eq("vaccinated", true)
      .lt("next_due_date", todayDate)
      .not("user_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error: error.message };
    const rows = (data ?? []) as AnimalAlert[];
    animals.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { animals };
}

async function loadFailedAlerts(db: AdminDb): Promise<{ alerts?: FailedAlert[]; error?: string }> {
  const alerts: FailedAlert[] = [];
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db.from("vaccination_alerts")
      .select("id, animal_id, user_id, due_date, channel, reminder_type, status")
      .eq("channel", "sms")
      .in("status", ["failed", "pending"])
      .lt("last_attempt_at", staleBefore)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error: error.message };
    const rows = (data ?? []) as FailedAlert[];
    alerts.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { alerts };
}

async function loadAnimalsById(db: AdminDb, ids: number[]): Promise<{ animals?: AnimalAlert[]; error?: string }> {
  const animals: AnimalAlert[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from("animals")
      .select("id, name, next_due_date, user_id, contact_number, vaccine_type")
      .eq("vaccinated", true)
      .in("id", ids.slice(offset, offset + 200))
      .not("user_id", "is", null);
    if (error) return { error: error.message };
    animals.push(...((data ?? []) as AnimalAlert[]));
  }
  return { animals };
}

async function loadProfiles(db: AdminDb, userIds: string[]): Promise<{ profiles?: AlertProfile[]; error?: string }> {
  const profiles: AlertProfile[] = [];
  for (let offset = 0; offset < userIds.length; offset += 200) {
    const { data, error } = await db.from("profiles")
      .select("id, contact_number, full_name, username, preferred_language, notify_sms")
      .in("id", userIds.slice(offset, offset + 200));
    if (error) return { error: error.message };
    profiles.push(...((data ?? []) as AlertProfile[]));
  }
  return { profiles };
}

function createSummary(): ChannelSummary {
  return { eligible: 0, sent: 0, failed: 0, skipped: 0, smsSegments: 0, unicodeMessages: 0 };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelConfig = enabledChannels();
  if (channelConfig.error || !channelConfig.channels) {
    return NextResponse.json({ error: channelConfig.error ?? "Reminder channel configuration is invalid." }, { status: 500 });
  }
  const enabled = channelConfig.channels;
  const dryRunValue = new URL(request.url).searchParams.get("dryRun")?.toLowerCase();
  const dryRun = dryRunValue === "1" || dryRunValue === "true";
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service configuration is incomplete." }, { status: 503 });

  const todayDate = getManilaDateIso(0);
  const [{ animals: d7Animals, error: d7Error }, { animals: d1Animals, error: d1Error }, { animals: overdueAnimals, error: overdueError }, { alerts: failedAlerts, error: failedError }] = await Promise.all([
    loadAnimalsForDueDate(db, getManilaDateIso(7)),
    loadAnimalsForDueDate(db, getManilaDateIso(1)),
    loadOverdueAnimals(db, todayDate),
    loadFailedAlerts(db),
  ]);
  if (d7Error || d1Error || overdueError || failedError) {
    return NextResponse.json({ error: d7Error ?? d1Error ?? overdueError ?? failedError }, { status: 500 });
  }

  const targetsByKey = new Map<string, AlertTarget>();
  for (const animal of d7Animals ?? []) addTarget(targetsByKey, animal, animal.next_due_date, "D7", true);
  for (const animal of d1Animals ?? []) addTarget(targetsByKey, animal, animal.next_due_date, "D1", true);
  for (const animal of overdueAnimals ?? []) addTarget(targetsByKey, animal, animal.next_due_date, "OVERDUE", true);

  const retryableAlerts = (failedAlerts ?? []).filter((alert) => enabled.has(alert.channel));
  const retryAnimalIds = [...new Set(retryableAlerts.map((alert) => alert.animal_id))];
  const { animals: retryAnimals, error: retryAnimalError } = await loadAnimalsById(db, retryAnimalIds);
  if (retryAnimalError) return NextResponse.json({ error: retryAnimalError }, { status: 500 });
  const retryAnimalsById = new Map((retryAnimals ?? []).map((animal) => [animal.id, animal]));
  for (const alert of retryableAlerts) {
    const animal = retryAnimalsById.get(alert.animal_id);
    if (animal && animal.user_id === alert.user_id && animal.next_due_date === alert.due_date) {
      addTarget(targetsByKey, animal, alert.due_date, alert.reminder_type, false, alert.channel);
    }
  }

  const targets = [...targetsByKey.values()];
  const userIds = [...new Set(targets.map((target) => target.animal.user_id))];
  const { profiles, error: profileError } = await loadProfiles(db, userIds);
  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const summaries: Record<ChannelName, ChannelSummary> = { sms: createSummary() };
  const warnings: string[] = [];
  const failures: string[] = [];
  const jobs: ReminderJob[] = [];
  const previews: Array<{
    animalId: number;
    reminderType: ReminderType;
    channel: ChannelName;
    recipient: string;
    language: Language;
    message: string;
    sms?: ReturnType<typeof estimateSms>;
  }> = [];

  for (const target of targets) {
    const profile = profileById.get(target.animal.user_id);
    const language = profileLanguage(profile?.preferred_language);
    const message = buildMessage(target, profile, language);
    const channelsForTarget: ChannelName[] = target.scheduled
      ? ["sms"]
      : [...target.retryChannels];

    for (const channel of channelsForTarget) {
      const summary = summaries[channel];
      if (!enabled.has(channel)) {
        summary.skipped += 1;
        continue;
      }
      if (channel === "sms" && profile?.notify_sms === false) {
        summary.skipped += 1;
        continue;
      }
      const recipient = normalizePhilippineNumber(profile?.contact_number ?? target.animal.contact_number ?? "") ?? undefined;
      if (!recipient) {
        summary.skipped += 1;
        warnings.push(`${target.animal.name} (${channel}): no valid mobile number`);
        continue;
      }

      summary.eligible += 1;
      const job = { target, channel, recipient, message };
      jobs.push(job);
      const estimate = estimateSms(message);
      summary.smsSegments += estimate.segments;
      if (estimate.encoding === "UCS-2") summary.unicodeMessages += 1;
      if (dryRun) {
        previews.push({ animalId: target.animal.id, reminderType: target.reminderType, channel, recipient, language, message, sms: estimate });
      }
    }
  }

  let jobsToProcess = jobs;
  if (!dryRun) {
    jobsToProcess = [];
    for (let offset = 0; offset < jobs.length; offset += 200) {
      const batch = jobs.slice(offset, offset + 200);
      const { error } = await db.rpc("enqueue_vaccination_alerts", {
        p_alerts: batch.map((job) => ({
          animal_id: job.target.animal.id,
          user_id: job.target.animal.user_id,
          due_date: job.target.dueDate,
          channel: job.channel,
          reminder_type: job.target.reminderType,
          recipient: job.recipient,
          message: job.message,
        })),
      });
      if (error) {
        for (const job of batch) {
          summaries[job.channel].failed += 1;
          failures.push(`${job.target.animal.name} (${job.channel}): could not queue delivery: ${error.message}`);
        }
      } else {
        jobsToProcess.push(...batch);
      }
    }
  }

  let sent = 0;
  if (!dryRun) {
    for (let offset = 0; offset < jobsToProcess.length; offset += CONCURRENCY) {
      const batch = jobsToProcess.slice(offset, offset + CONCURRENCY);
      await Promise.all(batch.map(async (job) => {
        const summary = summaries[job.channel];
        const { target, channel, recipient, message } = job;
        const { data: alertId, error: claimError } = await db.rpc("claim_vaccination_alert", {
          p_animal_id: target.animal.id,
          p_user_id: target.animal.user_id,
          p_due_date: target.dueDate,
          p_channel: channel,
          p_reminder_type: target.reminderType,
          p_recipient: recipient,
          p_message: message,
        });
        if (claimError) {
          summary.failed += 1;
          failures.push(`${target.animal.name} (${channel}): could not claim delivery: ${claimError.message}`);
          return;
        }
        if (typeof alertId !== "number") {
          summary.skipped += 1;
          return;
        }

        const result = await sendSms(recipient, message);
        const sendError = result.error;
        const providerMessageId = result.messageId ?? null;

        const { error: updateError } = await db.from("vaccination_alerts")
          .update(sendError
            ? { status: "failed", error_message: sendError }
            : { status: "sent", provider_message_id: providerMessageId, error_message: null, sent_at: new Date().toISOString() })
          .eq("id", alertId)
          .eq("status", "pending");
        if (updateError) {
          summary.failed += 1;
          failures.push(`${target.animal.name} (${channel}): could not save delivery status: ${updateError.message}`);
        }
        if (sendError) {
          summary.failed += updateError ? 0 : 1;
          failures.push(`${target.animal.name} (${channel}): ${sendError}`);
          return;
        }
        if (!updateError) {
          summary.sent += 1;
          sent += 1;
        }
      }));
    }
  }

  if (!dryRun) {
    for (const target of targets.filter((entry) => entry.scheduled)) {
      const profile = profileById.get(target.animal.user_id);
      const language = profileLanguage(profile?.preferred_language);
      const message = buildMessage(target, profile, language);
      const { error } = await db.from("notifications").insert({
        user_id: target.animal.user_id,
        title: target.reminderType === "OVERDUE" ? "Overdue vaccination" : "Vaccination due soon",
        message,
        type: target.reminderType === "OVERDUE" ? "danger" : "warning",
        dedupe_key: `sms:${target.animal.id}:${target.dueDate}`,
      });
      if (error && error.code !== "23505") failures.push(`${target.animal.name}: could not save in-app notification: ${error.message}`);
    }
  }

  const result = {
    todayDate,
    dueDates: { D7: getManilaDateIso(7), D1: getManilaDateIso(1) },
    dryRun,
    matched: targets.filter((target) => target.scheduled).length,
    retries: targets.filter((target) => !target.scheduled).length,
    sent,
    smsSent: summaries.sms.sent,
    skipped: summaries.sms.skipped,
    channels: summaries,
    warnings,
    failures,
    ...(dryRun ? { previews } : {}),
  };

  return NextResponse.json(result, { status: failures.length ? 500 : 200 });
}
