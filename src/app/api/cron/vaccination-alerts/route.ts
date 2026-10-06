import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendSms, normalizePhilippineNumber } from "@/lib/sms";
import { getManilaDateIso } from "@/lib/dates";

type AnimalAlert = {
  id: number;
  name: string;
  next_due_date: string;
  user_id: string;
  contact_number: string | null;
};

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

type AlertKind = "upcoming" | "overdue";
type AlertTarget = { animal: AnimalAlert; dueDate: string; kind: AlertKind };

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service configuration is incomplete." }, { status: 503 });

  const todayDate = getManilaDateIso(0);
  const upcomingDueDate = getManilaDateIso(7);

  // Two batches: animals due in exactly 7 days (upcoming) and animals whose
  // due date has already passed (overdue). Overdue animals don't share one
  // due date the way the 7-day lookahead batch does, so dedup below keys on
  // (animal_id, due_date) rather than assuming a single shared date.
  const [{ data: upcomingAnimals, error: upcomingError }, { data: overdueAnimals, error: overdueError }] = await Promise.all([
    db.from("animals").select("id, name, next_due_date, user_id, contact_number")
      .eq("vaccinated", true).eq("next_due_date", upcomingDueDate).not("user_id", "is", null),
    db.from("animals").select("id, name, next_due_date, user_id, contact_number")
      .eq("vaccinated", true).lt("next_due_date", todayDate).not("user_id", "is", null),
  ]);
  if (upcomingError) return NextResponse.json({ error: upcomingError.message }, { status: 500 });
  if (overdueError) return NextResponse.json({ error: overdueError.message }, { status: 500 });

  const targets: AlertTarget[] = [
    ...((upcomingAnimals ?? []) as AnimalAlert[]).map((animal) => ({ animal, dueDate: animal.next_due_date, kind: "upcoming" as const })),
    ...((overdueAnimals ?? []) as AnimalAlert[]).map((animal) => ({ animal, dueDate: animal.next_due_date, kind: "overdue" as const })),
  ];

  const userIds = [...new Set(targets.map((target) => target.animal.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from("profiles").select("id, contact_number").in("id", userIds)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const profileContacts = new Map((profiles ?? []).map((profile) => [profile.id, profile.contact_number]));

  const animalIds = [...new Set(targets.map((target) => target.animal.id))];
  const { data: existingAlerts, error: existingAlertsError } = animalIds.length
    ? await db.from("vaccination_alerts").select("id, animal_id, due_date, status").in("animal_id", animalIds).eq("channel", "sms")
    : { data: [], error: null };
  if (existingAlertsError) return NextResponse.json({ error: existingAlertsError.message }, { status: 500 });
  const existingByAnimalAndDate = new Map((existingAlerts ?? []).map((row) => [`${row.animal_id}:${row.due_date}`, row]));

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const { animal, dueDate, kind } of targets) {
    const contact = normalizePhilippineNumber(profileContacts.get(animal.user_id) ?? animal.contact_number ?? "");
    if (!contact) {
      skipped += 1;
      failures.push(`${animal.name}: no valid mobile number`);
      continue;
    }

    const existing = existingByAnimalAndDate.get(`${animal.id}:${dueDate}`);
    if (existing?.status === "sent") {
      skipped += 1;
      continue;
    }

    let alertId: number;
    if (!existing) {
      const { data: inserted, error: claimError } = await db.from("vaccination_alerts").insert({
        animal_id: animal.id,
        user_id: animal.user_id,
        due_date: dueDate,
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

    const message = kind === "overdue"
      ? `VacciTrack reminder: ${animal.name}'s vaccination was due on ${formatDate(dueDate)} and is now overdue. Please visit the barangay health station as soon as possible.`
      : `VacciTrack reminder: ${animal.name}'s vaccination expires on ${formatDate(dueDate)}. Please arrange a booster with the barangay health station.`;
    const result = await sendSms(contact, message);
    if (result.error) {
      await db.from("vaccination_alerts").update({ status: "failed", error_message: result.error }).eq("id", alertId);
      failures.push(`${animal.name}: ${result.error}`);
      continue;
    }

    await db.from("vaccination_alerts").update({ status: "sent", provider_message_id: result.messageId ?? null, error_message: null, sent_at: new Date().toISOString() }).eq("id", alertId);
    await db.from("notifications").insert({
      user_id: animal.user_id,
      title: kind === "overdue" ? "Overdue vaccination reminder sent" : "Vaccination reminder sent",
      message: kind === "overdue"
        ? `${animal.name}'s vaccination was due on ${formatDate(dueDate)}. An SMS reminder was sent to the registered mobile number.`
        : `${animal.name}'s vaccination expires on ${formatDate(dueDate)}. An SMS reminder was sent to the registered mobile number.`,
      type: kind === "overdue" ? "danger" : "warning",
      dedupe_key: `sms:${animal.id}:${dueDate}`,
    });
    sent += 1;
  }

  return NextResponse.json({ todayDate, upcomingDueDate, matched: targets.length, sent, skipped, failures });
}