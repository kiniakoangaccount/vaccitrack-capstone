"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export type AppointmentStatus = "Scheduled" | "Confirmed" | "Completed" | "Cancelled" | "Rescheduled";

export type VaccinationAppointment = {
  id: number;
  animalId: number;
  animalName: string;
  ownerId: string;
  ownerName: string;
  assignedStaffId: string | null;
  assignedStaffName: string;
  appointmentAt: string;
  vaccineType: string | null;
  location: string | null;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
};

async function requireStaff() {
  const db = createAdminClient();
  if (!db) throw new Error("Service unavailable.");

  const { user, error } = await getAuthenticatedUser();
  if (!user) throw new Error(error ?? "You must be signed in.");

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "bhw"].includes(profile.role)) {
    throw new Error("Only staff accounts can manage appointments.");
  }

  return { db, user };
}

export async function listAppointments(): Promise<{ appointments?: VaccinationAppointment[]; error?: string }> {
  try {
    const { db, user } = await requireStaff();
    const { data: rows, error } = await db
      .from("vaccination_appointments")
      .select("id, animal_id, owner_id, assigned_staff_id, appointment_at, vaccine_type, location, status, notes, created_at")
      .order("appointment_at", { ascending: true });
    if (error) return { error: error.message };

    const animalIds = [...new Set((rows ?? []).map((row) => row.animal_id))];
    const ownerIds = [...new Set((rows ?? []).map((row) => row.owner_id))];
    const staffIds = [...new Set((rows ?? []).map((row) => row.assigned_staff_id).filter((id): id is string => Boolean(id)))];

    const [{ data: animals }, { data: owners }, { data: staff }] = await Promise.all([
      animalIds.length ? db.from("animals").select("id, name").in("id", animalIds) : Promise.resolve({ data: [] }),
      ownerIds.length ? db.from("profiles").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
      staffIds.length ? db.from("profiles").select("id, full_name").in("id", staffIds) : Promise.resolve({ data: [] }),
    ]);

    const animalNames = new Map((animals ?? []).map((row) => [row.id, row.name]));
    const ownerNames = new Map((owners ?? []).map((row) => [row.id, row.full_name]));
    const staffNames = new Map((staff ?? []).map((row) => [row.id, row.full_name]));

    return {
      appointments: (rows ?? []).map((row) => ({
        id: row.id,
        animalId: row.animal_id,
        animalName: animalNames.get(row.animal_id) ?? "Unknown animal",
        ownerId: row.owner_id,
        ownerName: ownerNames.get(row.owner_id) ?? "Unknown owner",
        assignedStaffId: row.assigned_staff_id,
        assignedStaffName: row.assigned_staff_id ? staffNames.get(row.assigned_staff_id) ?? "Unassigned" : "Unassigned",
        appointmentAt: row.appointment_at,
        vaccineType: row.vaccine_type,
        location: row.location,
        status: row.status as AppointmentStatus,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function scheduleVaccinationAppointment(payload: {
  animalId: number;
  assignedStaffId?: string;
  appointmentAt: string;
  vaccineType?: string;
  location?: string;
  notes?: string;
}): Promise<{ error?: string; appointmentId?: number }> {
  try {
    const { db, user } = await requireStaff();
    if (!Number.isInteger(payload.animalId) || !payload.appointmentAt) {
      return { error: "Select an animal and appointment date/time." };
    }

    const appointmentDate = new Date(payload.appointmentAt);
    if (Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now()) {
      return { error: "Appointment date/time must be in the future." };
    }

    const { data: animal, error: animalError } = await db
      .from("animals")
      .select("id, name, user_id, vaccine_type")
      .eq("id", payload.animalId)
      .maybeSingle();
    if (animalError) return { error: animalError.message };
    if (!animal) return { error: "Animal was not found." };
    if (!animal.user_id) return { error: "This animal has no registered owner to notify." };

    if (payload.assignedStaffId) {
      const { data: staff } = await db
        .from("profiles")
        .select("id")
        .eq("id", payload.assignedStaffId)
        .in("role", ["admin", "bhw"])
        .maybeSingle();
      if (!staff) return { error: "The selected assignee is not a valid staff account." };
    }

    const { data: appointment, error } = await db
      .from("vaccination_appointments")
      .insert({
        animal_id: animal.id,
        owner_id: animal.user_id,
        assigned_staff_id: payload.assignedStaffId || null,
        appointment_at: appointmentDate.toISOString(),
        vaccine_type: payload.vaccineType?.trim() || animal.vaccine_type || null,
        location: payload.location?.trim() || "Barangay health station",
        status: "Scheduled",
        notes: payload.notes?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };

    await db.from("notifications").insert({
      user_id: animal.user_id,
      title: "Vaccination appointment scheduled",
      message: `${animal.name}'s vaccination appointment is scheduled for ${appointmentDate.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}.`,
      type: "success",
      dedupe_key: `appointment:${appointment.id}:scheduled`,
    });

    await db.from("audit_log").insert({
      user_id: user.id,
      action: "INSERT",
      table_name: "vaccination_appointments",
      record_id: appointment.id,
      notes: `Scheduled a vaccination appointment for ${animal.name}.`,
    });

    return { appointmentId: appointment.id };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function updateVaccinationAppointment(payload: {
  appointmentId: number;
  status: AppointmentStatus;
  appointmentAt?: string;
  assignedStaffId?: string | null;
  notes?: string;
}): Promise<{ error?: string }> {
  try {
    const { db, user } = await requireStaff();
    if (!Number.isInteger(payload.appointmentId)) return { error: "Invalid appointment." };
    if (!["Scheduled", "Confirmed", "Completed", "Cancelled", "Rescheduled"].includes(payload.status)) {
      return { error: "Invalid appointment status." };
    }

    const { data: current, error: currentError } = await db
      .from("vaccination_appointments")
      .select("id, animal_id, owner_id, appointment_at, status")
      .eq("id", payload.appointmentId)
      .maybeSingle();
    if (currentError) return { error: currentError.message };
    if (!current) return { error: "Appointment was not found." };

    const updates: Record<string, string | null> = { status: payload.status };
    if (typeof payload.notes === "string") updates.notes = payload.notes.trim() || null;

    if (payload.appointmentAt) {
      const appointmentDate = new Date(payload.appointmentAt);
      if (Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now()) {
        return { error: "Appointment date/time must be in the future." };
      }
      updates.appointment_at = appointmentDate.toISOString();
      updates.status = "Rescheduled";
    }

    if (payload.assignedStaffId !== undefined) updates.assigned_staff_id = payload.assignedStaffId;

    const { error } = await db.from("vaccination_appointments").update(updates).eq("id", payload.appointmentId);
    if (error) return { error: error.message };

    const { data: animal } = await db.from("animals").select("name").eq("id", current.animal_id).maybeSingle();
    const nextStatus = updates.status as AppointmentStatus;
    const nextDate = updates.appointment_at ? new Date(updates.appointment_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : null;

    await db.from("notifications").insert({
      user_id: current.owner_id,
      title: `Vaccination appointment ${nextStatus.toLowerCase()}`,
      message: nextDate
        ? `${animal?.name ?? "Your animal"}'s vaccination appointment was rescheduled to ${nextDate}.`
        : `${animal?.name ?? "Your animal"}'s vaccination appointment status changed to ${nextStatus}.`,
      type: nextStatus === "Cancelled" ? "danger" : nextStatus === "Completed" ? "success" : "warning",
      dedupe_key: `appointment:${payload.appointmentId}:${nextStatus}:${updates.appointment_at ?? current.appointment_at}`,
    });

    await db.from("audit_log").insert({
      user_id: user.id,
      action: "UPDATE",
      table_name: "vaccination_appointments",
      record_id: payload.appointmentId,
      notes: `Changed appointment ${payload.appointmentId} to ${nextStatus}.`,
    });

    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}
