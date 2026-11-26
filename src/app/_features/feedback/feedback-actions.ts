"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

export type FeedbackItem = {
  id: number;
  senderName: string;
  category: string;
  message: string;
  status: string;
  createdAt: string;
};

async function requireStaff() {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." } as const;

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." } as const;

  const { data: caller } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!caller || !["admin", "bhw"].includes(caller.role)) {
    return { error: "Only staff accounts (admin, bhw) can manage feedback." } as const;
  }

  return { db, userId: user.id } as const;
}

// Staff (admin, bhw) can view feedback submitted by clients. Clients can only send feedback.
export async function getFeedbackList(): Promise<{ items?: FeedbackItem[]; error?: string }> {
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db } = result;

  const { data, error } = await db
    .from("feedback")
    .select("id, user_id, name, category, message, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))));
  let namesById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", userIds);
    namesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      senderName: row.name || (row.user_id ? namesById.get(row.user_id) ?? "Unknown user" : "Anonymous"),
      category: row.category,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

export async function updateFeedbackStatus(feedbackId: number, status: "New" | "Reviewed" | "Resolved"): Promise<{ error?: string }> {
  const result = await requireStaff();
  if ("error" in result) return { error: result.error };
  const { db, userId } = result;

  const { error } = await db.from("feedback").update({ status }).eq("id", feedbackId);
  if (error) return { error: error.message };
  await logAudit(db, { userId, action: "UPDATE", tableName: "feedback", recordId: feedbackId, notes: `Feedback status changed to "${status}".` });
  return {};
}
