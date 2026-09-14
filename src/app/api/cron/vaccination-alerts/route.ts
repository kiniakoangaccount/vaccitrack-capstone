import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

type AnimalAlert = {
  id: number;
  name: string;
  next_due_date: string;
  user_id: string;
  contact_number: string | null;
};

function getManilaDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizePhilippineNumber(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return null;
}

async function sendSms(recipient: string, message: string): Promise<{ messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    return { error: "Twilio SMS configuration is incomplete." };
  }

  const body = new URLSearchParams({ To: recipient, Body: message });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  else body.set("From", fromNumber as string);

  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Twilio request failed." };
  }

  const result = await response.json().catch(() => ({})) as { sid?: string; message?: string; code?: number };
  if (!response.ok) return { error: result.message ?? `Twilio returned HTTP ${response.status}.` };
  return { messageId: result.sid };
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service configuration is incomplete." }, { status: 503 });

  const dueDate = getManilaDate(7);
  const { data: animals, error: animalError } = await db
    .from("animals")
    .select("id, name, next_due_date, user_id, contact_number")
    .eq("vaccinated", true)
    .eq("next_due_date", dueDate)
    .not("user_id", "is", null);
  if (animalError) return NextResponse.json({ error: animalError.message }, { status: 500 });

  const alerts = (animals ?? []) as AnimalAlert[];
  const userIds = [...new Set(alerts.map((animal) => animal.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from("profiles").select("id, contact_number").in("id", userIds)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const profileContacts = new Map((profiles ?? []).map((profile) => [profile.id, profile.contact_number]));
  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const animal of alerts) {
    const contact = normalizePhilippineNumber(profileContacts.get(animal.user_id) ?? animal.contact_number ?? "");
    if (!contact) {
      skipped += 1;
      failures.push(`${animal.name}: no valid mobile number`);
      continue;
    }

    const { data: existing, error: existingError } = await db
      .from("vaccination_alerts")
      .select("id, status")
      .eq("animal_id", animal.id)
      .eq("due_date", dueDate)
      .eq("channel", "sms")
      .maybeSingle();
    if (existingError) {
      failures.push(`${animal.name}: ${existingError.message}`);
      continue;
    }
    if (existing?.status === "sent") {
      skipped += 1;
      continue;
    }

    if (!existing) {
      const { error: claimError } = await db.from("vaccination_alerts").insert({
        animal_id: animal.id,
        user_id: animal.user_id,
        due_date: dueDate,
        channel: "sms",
        status: "pending",
      });
      if (claimError) {
        if (claimError.code === "23505") {
          skipped += 1;
          continue;
        }
        failures.push(`${animal.name}: ${claimError.message}`);
        continue;
      }
    } else {
      await db.from("vaccination_alerts").update({ status: "pending", error_message: null }).eq("id", existing.id);
    }

    const message = `VacciTrack reminder: ${animal.name}'s vaccination expires on ${formatDate(dueDate)}. Please arrange a booster with the barangay health station.`;
    const result = await sendSms(contact, message);
    if (result.error) {
      await db.from("vaccination_alerts").update({ status: "failed", error_message: result.error }).eq("animal_id", animal.id).eq("due_date", dueDate).eq("channel", "sms");
      failures.push(`${animal.name}: ${result.error}`);
      continue;
    }

    await db.from("vaccination_alerts").update({ status: "sent", provider_message_id: result.messageId ?? null, error_message: null, sent_at: new Date().toISOString() }).eq("animal_id", animal.id).eq("due_date", dueDate).eq("channel", "sms");
    await db.from("notifications").insert({
      user_id: animal.user_id,
      title: "Vaccination reminder sent",
      message: `${animal.name}'s vaccination expires on ${formatDate(dueDate)}. An SMS reminder was sent to the registered mobile number.`,
      type: "warning",
      dedupe_key: `sms:${animal.id}:${dueDate}`,
    });
    sent += 1;
  }

  return NextResponse.json({ dueDate, matched: alerts.length, sent, skipped, failures });
}