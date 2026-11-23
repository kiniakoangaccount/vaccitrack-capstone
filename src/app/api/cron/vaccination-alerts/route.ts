import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";

type AnimalAlert = {
  id: number;
  name: string;
  next_due_date: string;
  user_id: string;
  contact_number: string | null;
};

type AlertType = "7_day" | "1_day" | "overdue";

type AlertTarget = AnimalAlert & { alertType: AlertType };

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

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service configuration is incomplete." }, { status: 503 });

  const today = getManilaDate();
  const dueDates = { "7_day": getManilaDate(7), "1_day": getManilaDate(1) };
  const [sevenDayResult, oneDayResult, overdueResult] = await Promise.all([
    db.from("animals").select("id, name, next_due_date, user_id, contact_number").eq("vaccinated", true).eq("next_due_date", dueDates["7_day"]).not("user_id", "is", null),
    db.from("animals").select("id, name, next_due_date, user_id, contact_number").eq("vaccinated", true).eq("next_due_date", dueDates["1_day"]).not("user_id", "is", null),
    db.from("animals").select("id, name, next_due_date, user_id, contact_number").eq("vaccinated", true).lt("next_due_date", today).not("user_id", "is", null),
  ]);
  const queryError = sevenDayResult.error ?? oneDayResult.error ?? overdueResult.error;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  const alerts: AlertTarget[] = [
    ...((sevenDayResult.data ?? []) as AnimalAlert[]).map((animal) => ({ ...animal, alertType: "7_day" as const })),
    ...((oneDayResult.data ?? []) as AnimalAlert[]).map((animal) => ({ ...animal, alertType: "1_day" as const })),
    ...((overdueResult.data ?? []) as AnimalAlert[]).map((animal) => ({ ...animal, alertType: "overdue" as const })),
  ];
  const userIds = [...new Set(alerts.map((animal) => animal.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from("profiles").select("id, contact_number").in("id", userIds)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const profileContacts = new Map((profiles ?? []).map((profile) => [profile.id, profile.contact_number]));

  const animalIds = [...new Set(alerts.map((animal) => animal.id))];
  const alertDueDates = [...new Set(alerts.map((animal) => animal.next_due_date))];
  const { data: existingAlerts, error: existingAlertsError } = animalIds.length
    ? await db.from("vaccination_alerts").select("id, animal_id, due_date, alert_type, status").in("animal_id", animalIds).in("due_date", alertDueDates).eq("channel", "sms")
    : { data: [], error: null };
  if (existingAlertsError) return NextResponse.json({ error: existingAlertsError.message }, { status: 500 });
  const existingByAlert = new Map((existingAlerts ?? []).map((row) => [`${row.animal_id}:${row.due_date}:${row.alert_type}`, row]));

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const animal of alerts) {
    const alertKey = `${animal.id}:${animal.next_due_date}:${animal.alertType}`;
    const contact = normalizePhilippineNumber(profileContacts.get(animal.user_id) ?? animal.contact_number ?? "");
    if (!contact) {
      skipped += 1;
      failures.push(`${animal.name}: no valid mobile number`);
      continue;
    }

    const existing = existingByAlert.get(alertKey);
    if (existing?.status === "sent") {
      skipped += 1;
      continue;
    }

    let alertId: number;
    if (!existing) {
      const { data: inserted, error: claimError } = await db.from("vaccination_alerts").insert({
        animal_id: animal.id,
        user_id: animal.user_id,
        due_date: animal.next_due_date,
        alert_type: animal.alertType,
        channel: "sms",
        status: "pending",
      }).select("id").single();
      if (claimError) {
        if (claimError.code === "23505") {
          skipped += 1;
          continue;
        }
        failures.push(`${animal.name}: ${claimError.message}`);
        continue;
      }
      alertId = inserted.id;
    } else {
      // Atomic claim: only succeeds if the row's status still matches what we just read,
      // so a concurrent/retried invocation racing this one can't both send.
      const { data: claimed, error: claimError } = await db
        .from("vaccination_alerts")
        .update({ status: "pending", error_message: null })
        .eq("id", existing.id)
        .eq("status", existing.status)
        .select("id");
      if (claimError) {
        failures.push(`${animal.name}: ${claimError.message}`);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        skipped += 1;
        continue;
      }
      alertId = existing.id;
    }

    const dueDate = formatDate(animal.next_due_date);
    const message = animal.alertType === "overdue"
      ? `VacciTrack overdue notice: ${animal.name}'s vaccination was due on ${dueDate}. Please arrange a booster with the barangay health station as soon as possible.`
      : animal.alertType === "1_day"
        ? `VacciTrack reminder: ${animal.name}'s vaccination expires tomorrow, ${dueDate}. Please arrange a booster with the barangay health station.`
        : `VacciTrack reminder: ${animal.name}'s vaccination expires in 7 days, on ${dueDate}. Please arrange a booster with the barangay health station.`;
    const result = await sendSms(contact, message);
    if (result.error) {
      await db.from("vaccination_alerts").update({ status: "failed", error_message: result.error }).eq("id", alertId);
      failures.push(`${animal.name}: ${result.error}`);
      continue;
    }

    await db.from("vaccination_alerts").update({ status: "sent", provider_message_id: result.messageId ?? null, error_message: null, sent_at: new Date().toISOString() }).eq("id", alertId);
    await db.from("notifications").insert({
      user_id: animal.user_id,
      title: animal.alertType === "overdue" ? "Vaccination overdue" : "Vaccination reminder sent",
      message: `${message} An SMS reminder was sent to the registered mobile number.`,
      type: animal.alertType === "overdue" ? "danger" : "warning",
      dedupe_key: `sms:${animal.alertType}:${animal.id}:${animal.next_due_date}`,
    });
    sent += 1;
  }

  return NextResponse.json({ dueDates, matched: alerts.length, sent, skipped, failures });
}