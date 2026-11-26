"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

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

  return { db, userId: user.id } as const;
}

// Staff (admin, bhw) schedule a vaccination visit for an animal and assign it
// to a specific staff member, so follow-up work is tracked instead of only
// living in the derived Expired/Due-soon lists on the Planning tab.
export async function getAppointments(): Promise<{ items?: AppointmentItem[]; error?: string }> {
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db } = result;

  const { data, error } = await db
    .from("appointments")
    .select("id, animal_id, assigned_to, scheduled_date, status, notes, created_at")
    .order("scheduled_date", { ascending: true });
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
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

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

  await logAudit(db, { userId, action: "INSERT", tableName: "appointments", recordId: data.id, notes: `Appointment scheduled for ${payload.scheduledDate}.` });

  return { id: data.id };
}

export async function updateAppointmentStatus(id: number, status: AppointmentStatus): Promise<{ error?: string }> {
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

  const { error } = await db.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  await logAudit(db, { userId, action: "UPDATE", tableName: "appointments", recordId: id, notes: `Appointment status changed to "${status}".` });
  return {};
}
