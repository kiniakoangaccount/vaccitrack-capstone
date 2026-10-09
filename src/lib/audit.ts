import type { createAdminClient } from "@/lib/supabase-admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

// Best-effort: callers await this (so the insert actually fires before a
// server action returns) but never check its result — an audit-log failure
// should never block or fail the real operation it's logging.
export async function logAudit(
  db: AdminClient,
  params: {
    userId: string | null;
    action: "INSERT" | "UPDATE" | "DELETE";
    tableName: string;
    recordId?: number;
    notes: string;
  }
): Promise<void> {
  try {
    await db.from("audit_log").insert({
      user_id: params.userId,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      notes: params.notes,
    });
  } catch {
    // Best-effort only — see function comment.
  }
}
