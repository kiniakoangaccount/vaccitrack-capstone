"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { insertInAppNotifications, type InAppNotification } from "@/lib/in-app-notifications";
import { getManilaDateIso, todayLocalIso } from "@/lib/dates";
import { getVaccinationDueDate } from "@/lib/map-data";
import { createHash } from "node:crypto";

export type AppointmentStatus = "Scheduled" | "Completed" | "Cancelled" | "Missed";

export type AppointmentItem = {
  id: number;
  animalId: number;
  animalName: string;
  ownerName: string;
  assignedTo: string;
  assignedName: string;
  scheduledDate: string;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
};

export type AutomaticScheduleOptions = {
  startDate: string;
  daysAhead: number;
  workingDays: number[];
  visitsPerStaffPerDay: number;
};

export type AutomaticScheduleStaff = { id: string; fullName: string; role: "admin" | "bhw" };

export type AutomaticAppointmentDraft = {
  animalId: number;
  animalName: string;
  ownerName: string;
  purok: string;
  dueDate: string;
  assignedTo: string;
  scheduledDate: string;
};

export type AutomaticSchedulePreview = {
  drafts: AutomaticAppointmentDraft[];
  staff: AutomaticScheduleStaff[];
  availableDates: string[];
  eligibleCount: number;
  alreadyScheduledCount: number;
  unscheduledCount: number;
  endDate: string;
  snapshotToken: string;
};

async function requireStaff() {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." } as const;

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." } as const;

  const { data: caller } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!caller || !["admin", "bhw"].includes(caller.role)) {
    return { error: "Only staff accounts (admin, bhw) can manage appointments." } as const;
  }

  return { db, userId: user.id, role: caller.role as "admin" | "bhw" } as const;
}

async function requireAdmin() {
  const result = await requireStaff();
  if ("error" in result) return result;
  if (result.role !== "admin") return { error: "Only admin accounts can schedule or update appointments." } as const;
  return result;
}

function formatAppointmentDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function addDaysToIso(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dateDayOfWeek(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

async function buildAutomaticSchedule(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  options: AutomaticScheduleOptions,
): Promise<{ preview: AutomaticSchedulePreview } | { error: string }> {
  const today = getManilaDateIso();
  const workingDays = Array.from(new Set(options.workingDays)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (!isIsoDate(options.startDate) || options.startDate < today) return { error: "Choose a schedule start date of today or later." };
  if (!Number.isInteger(options.daysAhead) || options.daysAhead < 1 || options.daysAhead > 90) return { error: "The scheduling window must be between 1 and 90 days." };
  if (!workingDays.length) return { error: "Choose at least one working day." };
  if (!Number.isInteger(options.visitsPerStaffPerDay) || options.visitsPerStaffPerDay < 1 || options.visitsPerStaffPerDay > 12) return { error: "Daily visits per staff must be between 1 and 12." };

  const endDate = addDaysToIso(options.startDate, options.daysAhead - 1);
  const [{ data: animalRows, error: animalError }, { data: appointmentRows, error: appointmentError }, { data: staffRows, error: staffError }] = await Promise.all([
    db.from("animals").select("id, name, owner_name, user_id, vaccinated, vaccine_date, next_due_date, puroks(name)"),
    db.from("appointments").select("animal_id").eq("status", "Scheduled"),
    db.from("profiles").select("id, full_name, role").in("role", ["admin", "bhw"]).eq("status", "active").order("full_name"),
  ]);
  if (animalError) return { error: animalError.message };
  if (appointmentError) return { error: appointmentError.message };
  if (staffError) return { error: staffError.message };

  const staff: AutomaticScheduleStaff[] = (staffRows ?? []).map((row) => ({ id: row.id, fullName: row.full_name, role: row.role as "admin" | "bhw" }));
  if (!staff.length) return { error: "No active admin or BHW accounts are available for appointment assignment." };

  const alreadyScheduledIds = new Set((appointmentRows ?? []).map((row) => row.animal_id));
  const candidates = (animalRows ?? []).flatMap((animal) => {
    if (!animal.vaccine_date && !animal.vaccinated) return [];
    const dueDate = getVaccinationDueDate(animal.vaccine_date, animal.next_due_date);
    if (!dueDate || !isIsoDate(dueDate) || dueDate > endDate) return [];
    const purokRelation = animal.puroks as unknown as { name: string | null } | { name: string | null }[] | null;
    const purokName = Array.isArray(purokRelation) ? purokRelation[0]?.name : purokRelation?.name;
    return [{ animalId: animal.id, animalName: animal.name, ownerName: animal.owner_name, purok: purokName ?? "Unassigned", dueDate }];
  });

  const purokGroups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const group = purokGroups.get(candidate.purok) ?? [];
    group.push(candidate);
    purokGroups.set(candidate.purok, group);
  }
  const orderedGroups = Array.from(purokGroups.entries()).sort(([leftPurok, leftAnimals], [rightPurok, rightAnimals]) => {
    const leftDue = leftAnimals.reduce((earliest, animal) => animal.dueDate < earliest ? animal.dueDate : earliest, leftAnimals[0].dueDate);
    const rightDue = rightAnimals.reduce((earliest, animal) => animal.dueDate < earliest ? animal.dueDate : earliest, rightAnimals[0].dueDate);
    return leftDue.localeCompare(rightDue) || leftPurok.localeCompare(rightPurok);
  });
  const orderedCandidates = orderedGroups.flatMap(([, group]) => group.sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.animalName.localeCompare(right.animalName)));

  const candidatesToSchedule = candidates.filter((animal) => !alreadyScheduledIds.has(animal.animalId));
  const availableDates: string[] = [];
  for (let offset = 0; offset < options.daysAhead; offset += 1) {
    const date = addDaysToIso(options.startDate, offset);
    if (workingDays.includes(dateDayOfWeek(date))) availableDates.push(date);
  }
  if (!availableDates.length) return { error: "There are no working days in the selected date range." };

  const staffPerDate = new Map<string, Map<string, number>>();
  const staffTotal = new Map(staff.map((member) => [member.id, 0]));
  const drafts: AutomaticAppointmentDraft[] = [];
  for (const animal of orderedCandidates.filter((candidate) => !alreadyScheduledIds.has(candidate.animalId))) {
    let assigned: { date: string; staffId: string } | null = null;
    for (const date of availableDates) {
      const counts = staffPerDate.get(date) ?? new Map(staff.map((member) => [member.id, 0]));
      staffPerDate.set(date, counts);
      const availableStaff = staff.filter((member) => (counts.get(member.id) ?? 0) < options.visitsPerStaffPerDay)
        .sort((left, right) => (counts.get(left.id) ?? 0) - (counts.get(right.id) ?? 0) || (staffTotal.get(left.id) ?? 0) - (staffTotal.get(right.id) ?? 0) || left.fullName.localeCompare(right.fullName));
      if (!availableStaff.length) continue;
      const chosen = availableStaff[0];
      counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
      staffTotal.set(chosen.id, (staffTotal.get(chosen.id) ?? 0) + 1);
      assigned = { date, staffId: chosen.id };
      break;
    }
    if (!assigned) continue;
    drafts.push({ animalId: animal.animalId, animalName: animal.animalName, ownerName: animal.ownerName, purok: animal.purok, dueDate: animal.dueDate, assignedTo: assigned.staffId, scheduledDate: assigned.date });
  }

  const snapshotToken = createHash("sha256").update(JSON.stringify({
    candidates: candidates.map((animal) => [animal.animalId, animal.dueDate, animal.purok]),
    scheduled: Array.from(alreadyScheduledIds).sort((left, right) => left - right),
    staff: staff.map((member) => [member.id, member.role]),
  })).digest("hex");

  return { preview: { drafts, staff, availableDates, eligibleCount: candidates.length, alreadyScheduledCount: candidates.length - candidatesToSchedule.length, unscheduledCount: candidatesToSchedule.length - drafts.length, endDate, snapshotToken } };
}

export async function previewAutomaticAppointmentSchedule(options: AutomaticScheduleOptions): Promise<{ preview?: AutomaticSchedulePreview; error?: string }> {
  const result = await requireAdmin();
  if ("error" in result) return { error: result.error };
  const built = await buildAutomaticSchedule(result.db, options);
  if ("error" in built) return { error: built.error };
  return { preview: built.preview };
}

export async function confirmAutomaticAppointmentSchedule(
  options: AutomaticScheduleOptions,
  submittedDrafts: AutomaticAppointmentDraft[],
  snapshotToken: string,
): Promise<{ createdCount?: number; error?: string }> {
  const result = await requireAdmin();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;
  const built = await buildAutomaticSchedule(db, options);
  if ("error" in built) return { error: built.error };
  const current = built.preview;
  if (current.snapshotToken !== snapshotToken) return { error: "Animal eligibility or staff availability changed. Generate a fresh draft before confirming." };

  const expectedIds = current.drafts.map((draft) => draft.animalId).sort((left, right) => left - right);
  const submittedIds = submittedDrafts.map((draft) => draft.animalId).sort((left, right) => left - right);
  if (new Set(submittedIds).size !== submittedIds.length || expectedIds.length !== submittedIds.length || expectedIds.some((id, index) => id !== submittedIds[index])) {
    return { error: "The draft no longer matches the eligible animals. Generate a fresh draft before confirming." };
  }

  const staffIds = new Set(current.staff.map((member) => member.id));
  const dateSet = new Set(current.availableDates);
  const loadBySlot = new Map<string, number>();
  for (const draft of submittedDrafts) {
    if (!staffIds.has(draft.assignedTo) || !dateSet.has(draft.scheduledDate)) return { error: "Every assignment must use an active staff member and an available work date." };
    const slot = `${draft.scheduledDate}:${draft.assignedTo}`;
    const load = (loadBySlot.get(slot) ?? 0) + 1;
    if (load > options.visitsPerStaffPerDay) return { error: "The edited draft exceeds the daily visit limit for a staff member." };
    loadBySlot.set(slot, load);
  }
  if (!submittedDrafts.length) return { createdCount: 0 };

  const animalIds = submittedDrafts.map((draft) => draft.animalId);
  const { data: stillScheduled, error: scheduleCheckError } = await db.from("appointments").select("animal_id").in("animal_id", animalIds).eq("status", "Scheduled");
  if (scheduleCheckError) return { error: scheduleCheckError.message };
  if ((stillScheduled ?? []).length) return { error: "One or more animals now have an active appointment. Generate a fresh draft." };

  const appointmentRows = submittedDrafts.map((draft) => ({
    animal_id: draft.animalId,
    assigned_to: draft.assignedTo,
    scheduled_date: draft.scheduledDate,
    notes: `Automatically scheduled for vaccination; due date ${draft.dueDate}.`,
    created_by: userId,
  }));
  const { data: created, error: insertError } = await db.from("appointments").insert(appointmentRows)
    .select("id, animal_id, assigned_to, scheduled_date, created_at");
  if (insertError) return { error: insertError.message };

  const [{ data: animals }, { data: admins }] = await Promise.all([
    db.from("animals").select("id, name, user_id").in("id", animalIds),
    db.from("profiles").select("id").eq("role", "admin").eq("status", "active"),
  ]);
  const animalById = new Map((animals ?? []).map((animal) => [animal.id, animal]));
  const notificationRows: InAppNotification[] = [];
  for (const appointment of created ?? []) {
    const animal = animalById.get(appointment.animal_id);
    const date = formatAppointmentDate(appointment.scheduled_date);
    const eventKey = `${appointment.id}:${appointment.created_at}`;
    if (animal?.user_id) notificationRows.push({
      user_id: animal.user_id,
      title: "Vaccination appointment scheduled",
      message: `${animal.name}'s vaccination appointment is scheduled for ${date}.`,
      type: "info",
      dedupe_key: `appointment:${eventKey}:owner`,
    });
    notificationRows.push({
      user_id: appointment.assigned_to,
      title: "New vaccination appointment assigned",
      message: `${animal?.name ?? "An animal"}'s vaccination appointment is scheduled for ${date}.`,
      type: "info",
      dedupe_key: `appointment:${eventKey}:assignee`,
    });
    for (const admin of admins ?? []) {
      if (admin.id === userId || admin.id === animal?.user_id || admin.id === appointment.assigned_to) continue;
      notificationRows.push({
        user_id: admin.id,
        title: "New vaccination appointment",
        message: `${animal?.name ?? "An animal"}'s vaccination appointment is scheduled for ${date}.`,
        type: "info",
        dedupe_key: `appointment:${eventKey}:admin:${admin.id}`,
      });
    }
  }
  if (notificationRows.length) {
    const { error: notificationError } = await db.from("notifications").insert(notificationRows);
    if (notificationError) console.error("Could not save automatic appointment notifications:", notificationError.message);
  }
  await logAudit(db, { userId, action: "INSERT", tableName: "appointments", notes: `Automatically scheduled ${created?.length ?? 0} vaccination appointments from ${options.startDate} to ${current.endDate}.` });
  return { createdCount: created?.length ?? 0 };
}

async function notifyAppointmentParticipants(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    appointmentId: number;
    animalName: string;
    ownerId: string | null;
    assignedTo: string;
    actorId: string;
    scheduledDate: string;
    status: AppointmentStatus;
    updatedAt: string;
    rescheduled: boolean;
    created: boolean;
  },
) {
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("status", "active");
  const date = formatAppointmentDate(input.scheduledDate);
  const eventKey = `${input.appointmentId}:${input.updatedAt}`;
  const notifications: InAppNotification[] = [];

  if (input.ownerId) {
    const title = input.created
      ? "Vaccination appointment scheduled"
      : input.rescheduled ? "Vaccination appointment rescheduled" : "Vaccination appointment updated";
    const message = input.created
      ? `${input.animalName}'s vaccination appointment is scheduled for ${date}.`
      : input.rescheduled
      ? `${input.animalName}'s vaccination appointment has been rescheduled to ${date}.`
      : `${input.animalName}'s vaccination appointment is ${input.status.toLowerCase()} for ${date}.`;
    notifications.push({
      user_id: input.ownerId,
      title,
      message,
      type: input.status === "Cancelled" || input.status === "Missed" ? "warning" : "info",
      dedupe_key: `appointment:${eventKey}:owner`,
    });
  }

  {
    notifications.push({
      user_id: input.assignedTo,
      title: input.created ? "New vaccination appointment assigned" : input.rescheduled ? "Assigned appointment rescheduled" : "Assigned appointment updated",
      message: input.created
        ? `${input.animalName}'s vaccination appointment is scheduled for ${date}.`
        : `${input.animalName}'s vaccination appointment is ${input.status.toLowerCase()} for ${date}.`,
      type: input.status === "Cancelled" || input.status === "Missed" ? "warning" : "info",
      dedupe_key: `appointment:${eventKey}:assignee`,
    });
  }

  for (const admin of admins ?? []) {
    if (admin.id === input.actorId || admin.id === input.ownerId || admin.id === input.assignedTo) continue;
    notifications.push({
      user_id: admin.id,
      title: input.created ? "New vaccination appointment" : input.rescheduled ? "Vaccination appointment rescheduled" : "Vaccination appointment updated",
      message: input.created
        ? `${input.animalName}'s vaccination appointment is scheduled for ${date}.`
        : `${input.animalName}'s appointment is ${input.status.toLowerCase()} for ${date}.`,
      type: input.status === "Cancelled" || input.status === "Missed" ? "warning" : "info",
      dedupe_key: `appointment:${eventKey}:admin:${admin.id}`,
    });
  }

  const errors = await insertInAppNotifications(db, notifications);
  if (errors.length) console.error("Could not save appointment notifications:", errors.join("; "));
}

// Staff (admin, bhw) schedule a vaccination visit for an animal and assign it
// to a specific staff member, so follow-up work is tracked instead of only
// living in the derived Expired/Due-soon lists on the Planning tab.
export async function getAppointments(): Promise<{ items?: AppointmentItem[]; error?: string }> {
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db, userId, role } = result;

  let query = db
    .from("appointments")
    .select("id, animal_id, assigned_to, scheduled_date, status, notes, created_at")
    .order("scheduled_date", { ascending: true });
  if (role === "bhw") query = query.eq("assigned_to", userId);
  const { data, error } = await query;
  if (error) return { error: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { items: [] };

  const animalIds = Array.from(new Set(rows.map((row) => row.animal_id)));
  const assignedIds = Array.from(new Set(rows.map((row) => row.assigned_to)));

  const [{ data: animals }, { data: profiles }] = await Promise.all([
    db.from("animals").select("id, name, owner_name").in("id", animalIds),
    db.from("profiles").select("id, full_name").in("id", assignedIds),
  ]);
  const animalById = new Map((animals ?? []).map((animal) => [animal.id, animal]));
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return {
    items: rows.map((row) => ({
      id: row.id,
      animalId: row.animal_id,
      animalName: animalById.get(row.animal_id)?.name ?? "Unknown animal",
      ownerName: animalById.get(row.animal_id)?.owner_name ?? "—",
      assignedTo: row.assigned_to,
      assignedName: nameById.get(row.assigned_to) ?? "Unknown staff",
      scheduledDate: row.scheduled_date,
      status: row.status as AppointmentStatus,
      notes: row.notes,
      createdAt: row.created_at,
    })),
  };
}

export async function createAppointment(payload: {
  animalId: number;
  assignedTo: string;
  scheduledDate: string;
  notes?: string;
}): Promise<{ error?: string; id?: number }> {
  const result = await requireAdmin();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

  if (payload.scheduledDate < todayLocalIso()) return { error: "Appointment date cannot be in the past." };

  const { data: animal, error: animalError } = await db.from("animals")
    .select("id, name, user_id")
    .eq("id", payload.animalId)
    .maybeSingle();
  if (animalError) return { error: animalError.message };
  if (!animal) return { error: "Animal record not found." };

  const { data: existingSchedule, error: existingScheduleError } = await db.from("appointments")
    .select("id")
    .eq("animal_id", payload.animalId)
    .eq("status", "Scheduled")
    .limit(1);
  if (existingScheduleError) return { error: existingScheduleError.message };
  if (existingSchedule?.length) return { error: "This animal already has an active scheduled appointment." };

  const { data: assignee } = await db.from("profiles").select("role").eq("id", payload.assignedTo).maybeSingle();
  if (!assignee || !["admin", "bhw"].includes(assignee.role)) {
    return { error: "Appointments can only be assigned to admin or BHW staff accounts." };
  }

  const { data, error } = await db
    .from("appointments")
    .insert({
      animal_id: payload.animalId,
      assigned_to: payload.assignedTo,
      scheduled_date: payload.scheduledDate,
      notes: payload.notes || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await notifyAppointmentParticipants(db, {
    appointmentId: data.id,
    animalName: animal.name,
    ownerId: animal.user_id,
    assignedTo: payload.assignedTo,
    actorId: userId,
    scheduledDate: payload.scheduledDate,
    status: "Scheduled",
    updatedAt: `${payload.scheduledDate}:${data.id}`,
    rescheduled: false,
    created: true,
  });

  await logAudit(db, { userId, action: "INSERT", tableName: "appointments", recordId: data.id, notes: `Appointment scheduled for ${payload.scheduledDate}.` });

  return { id: data.id };
}

export async function updateAppointmentStatus(id: number, status: AppointmentStatus, scheduledDate?: string): Promise<{ error?: string }> {
  const result = await requireAdmin();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

  if (scheduledDate && scheduledDate < todayLocalIso()) return { error: "Appointment date cannot be in the past." };

  const { data: appointment, error: appointmentError } = await db.from("appointments")
    .select("id, animal_id, assigned_to, scheduled_date, status")
    .eq("id", id)
    .maybeSingle();
  if (appointmentError) return { error: appointmentError.message };
  if (!appointment) return { error: "Appointment not found." };
  const nextDate = scheduledDate ?? appointment.scheduled_date;
  const rescheduled = nextDate !== appointment.scheduled_date;
  if (appointment.status === status && !rescheduled) return {};

  const { data: animal, error: animalError } = await db.from("animals")
    .select("id, name, user_id")
    .eq("id", appointment.animal_id)
    .maybeSingle();
  if (animalError) return { error: animalError.message };

  const { data: updated, error } = await db.from("appointments")
    .update({ status, ...(rescheduled ? { scheduled_date: nextDate } : {}) })
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) return { error: error.message };

  const { error: staleReminderError } = await db.from("notifications")
    .update({ is_read: true })
    .eq("is_read", false)
    .like("dedupe_key", `appointment-reminder:${id}:%`);
  if (staleReminderError) console.error("Could not clear stale appointment reminders:", staleReminderError.message);

  if (animal) {
    await notifyAppointmentParticipants(db, {
      appointmentId: id,
      animalName: animal.name,
      ownerId: animal.user_id,
      assignedTo: appointment.assigned_to,
      actorId: userId,
      scheduledDate: nextDate,
      status,
      updatedAt: updated.updated_at,
      rescheduled,
      created: false,
    });
  }
  await logAudit(db, { userId, action: "UPDATE", tableName: "appointments", recordId: id, notes: rescheduled ? `Appointment rescheduled to ${nextDate} and status changed to "${status}".` : `Appointment status changed to "${status}".` });
  return {};
}
