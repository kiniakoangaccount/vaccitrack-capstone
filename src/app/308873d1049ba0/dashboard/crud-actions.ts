"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { getAdminSession } from "../actions";

const DASH = "/308873d1049ba0/dashboard";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  const db = createAdminClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

// ── USERS ─────────────────────────────────────────────────────────────────

export async function updateUserRole(userId: string, role: string): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const validRoles = ["admin", "veterinarian", "bhw", "client", "viewer"];
    if (!validRoles.includes(role)) return { error: "Invalid role." };
    const { error } = await db.from("profiles").update({ role }).eq("id", userId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateUserStatus(userId: string, status: string): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const validStatuses = ["active", "disabled", "pending"];
    if (!validStatuses.includes(status)) return { error: "Invalid status." };
    const { error } = await db.from("profiles").update({ status }).eq("id", userId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function resetUserPassword(userId: string): Promise<{ password?: string; error?: string }> {
  try {
    const db = await requireAdmin();
    const session = await getAdminSession();
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%*-_";
    const bytes = randomBytes(16);
    const password = Array.from(bytes, (b) => chars[b % chars.length]).join("");

    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) return { error: error.message };

    await db.from("audit_log").insert({
      user_id: null,
      action: "UPDATE",
      table_name: "auth.users",
      notes: `Administrator "${session?.username}" reset the password for account ${userId}.`,
    });

    revalidatePath(DASH);
    return { password };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    // Delete from auth.users — cascades to profiles via FK
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── PENDING VERIFICATION ──────────────────────────────────────────────────

export async function approveUser(userId: string): Promise<{ error?: string }> {
  return updateUserStatus(userId, "active");
}

export async function rejectUser(userId: string): Promise<{ error?: string }> {
  return updateUserStatus(userId, "disabled");
}

// ── FEEDBACK ──────────────────────────────────────────────────────────────

export async function updateFeedbackStatus(
  feedbackId: number,
  status: "New" | "Reviewed" | "Resolved"
): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("feedback").update({ status }).eq("id", feedbackId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteFeedback(feedbackId: number): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("feedback").delete().eq("id", feedbackId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── ANIMALS ───────────────────────────────────────────────────────────────

export async function deleteAnimal(animalId: number): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("animals").delete().eq("id", animalId);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
