"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { insertInAppNotifications, type InAppNotification } from "@/lib/in-app-notifications";
import { todayLocalIso } from "@/lib/dates";

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
  if (result.role !== "admin") return { error: "Only admin accounts can schedule appointments." } as const;
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
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

  if (scheduledDate && scheduledDate < todayLocalIso()) return { error: "Appointment date cannot be in the past." };

  const { data: appointment, error: appointmentError } = await db.from("appointments")
    .select("id, animal_id, assigned_to, scheduled_date, status")
    .eq("id", id)
    .maybeSingle();
  if (appointmentError) return { error: appointmentError.message };
  if (!appointment) return { error: "Appointment not found." };
  if (result.role === "bhw" && appointment.assigned_to !== userId) {
    return { error: "BHW accounts can update only appointments assigned to them." };
  }

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
