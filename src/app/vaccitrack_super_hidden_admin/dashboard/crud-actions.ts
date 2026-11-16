"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { getAdminSession } from "../actions";

const DASH = "/vaccitrack_super_hidden_admin/dashboard";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  const db = createAdminClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

// ── STAFF INVITES ────────────────────────────────────────────────────────

export interface StaffInvite {
  id: number;
  token: string;
  role: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

const INVITABLE_ROLES = ["bhw", "admin"];

export async function createStaffInvite(role: string): Promise<{ token?: string; error?: string }> {
  try {
    const db = await requireAdmin();
    const session = await getAdminSession();
    if (!INVITABLE_ROLES.includes(role)) return { error: "Invalid role." };

    const token = randomBytes(18).toString("base64url");
    const { error } = await db.from("staff_invites").insert({
      token,
      role,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) return { error: error.message };

    await db.from("audit_log").insert({
      user_id: null,
      action: "INSERT",
      table_name: "staff_invites",
      notes: `Administrator "${session?.username}" generated a ${role} invite link.`,
    });

    revalidatePath(DASH);
    return { token };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function listStaffInvites(): Promise<{ invites?: StaffInvite[]; error?: string }> {
  try {
    const db = await requireAdmin();
    const { data, error } = await db
      .from("staff_invites")
      .select("id, token, role, expires_at, used_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { error: error.message };
    return { invites: (data as StaffInvite[]) ?? [] };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function revokeStaffInvite(id: number): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("staff_invites").delete().eq("id", id).is("used_at", null);
    if (error) return { error: error.message };
    revalidatePath(DASH);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── USERS ─────────────────────────────────────────────────────────────────

export async function updateUserRole(userId: string, role: string): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    const validRoles = ["admin", "bhw", "client", "viewer"];
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

export async function updateUserReminderPreferences(
  userId: string,
  preferences: { preferredLanguage: "en" | "tl" | "hil"; notifySms: boolean; notifyEmail: boolean }
): Promise<{ error?: string }> {
  try {
    const db = await requireAdmin();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return { error: "Invalid user account." };
    }
    if (!["en", "tl", "hil"].includes(preferences.preferredLanguage)
      || typeof preferences.notifySms !== "boolean"
      || typeof preferences.notifyEmail !== "boolean") {
      return { error: "Invalid reminder preferences." };
    }

    const { error } = await db.from("profiles").update({
      preferred_language: preferences.preferredLanguage,
      notify_sms: preferences.notifySms,
      notify_email: preferences.notifyEmail,
    }).eq("id", userId);
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

export async function setUserPassword(userId: string, password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: "Password must be at least 8 characters long." };

  try {
    const db = await requireAdmin();
    const session = await getAdminSession();

    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) return { error: error.message };

    await db.from("audit_log").insert({
      user_id: null,
      action: "UPDATE",
      table_name: "auth.users",
      notes: `Administrator "${session?.username}" set a new password for account ${userId}.`,
    });

    revalidatePath(DASH);
    return {};
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
