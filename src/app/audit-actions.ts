"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { getAdminSession } from "./308873d1049ba0/actions";

const UNAUTHORIZED = { error: "Unauthorized." };
const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE", "SMS_SENT", "SMS_ATTEMPT"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type AuditActor = { kind: "hidden-admin"; username: string } | { kind: "admin"; userId: string };

/** Verified hidden-admin cookie session, or a Supabase-authenticated user whose profile role is admin. Never derived from UI state. */
async function requireAuditAccess(): Promise<{ ok: true; actor: AuditActor } | { ok: false; error: string }> {
  const adminSession = await getAdminSession();
  if (adminSession) return { ok: true, actor: { kind: "hidden-admin", username: adminSession.username } };

  const { user } = await getAuthenticatedUser();
  if (!user) return { ok: false, error: UNAUTHORIZED.error };

  const db = createAdminClient();
  if (!db) return { ok: false, error: UNAUTHORIZED.error };

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: UNAUTHORIZED.error };

  return { ok: true, actor: { kind: "admin", userId: user.id } };
}

function getPurokName(puroks: unknown): string {
  if (!puroks) return "";
  if (Array.isArray(puroks)) return puroks[0]?.name ?? "";
  if (typeof puroks === "object" && "name" in puroks) return String((puroks as { name: unknown }).name ?? "");
  return "";
}

export async function writeAuditLog(
  userId: string,
  action: "INSERT" | "UPDATE" | "DELETE" | "SMS_SENT" | "SMS_ATTEMPT",
  tableName: string,
  recordId?: number,
  notes?: string
): Promise<{ error?: string }> {
  const access = await requireAuditAccess();
  if (!access.ok) return { error: access.error };
  if (!AUDIT_ACTIONS.includes(action)) return UNAUTHORIZED;

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { error } = await db.from("audit_log").insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    notes,
  });
  if (error) {
    console.error("writeAuditLog failed:", error.message);
    return { error: "Could not write the audit entry." };
  }
  return {};
}

export async function simulateSmsAlert(
  recipient: string,
  message: string
): Promise<{ error?: string }> {
  const access = await requireAuditAccess();
  if (!access.ok) return { error: access.error };

  const recipientTrimmed = recipient.trim();
  const messageTrimmed = message.trim();
  if (!recipientTrimmed || recipientTrimmed.length > 32) return { error: "Enter a valid recipient." };
  if (!messageTrimmed || messageTrimmed.length > 320) return { error: "Enter a message up to 320 characters." };

  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { error } = await db.from("audit_log").insert({
    user_id: access.actor.kind === "admin" ? access.actor.userId : null,
    action: "SMS_SENT",
    table_name: "animals",
    notes: access.actor.kind === "hidden-admin"
      ? `Simulated SMS to ${recipientTrimmed} (by admin "${access.actor.username}"): ${messageTrimmed.slice(0, 80)}`
      : `Simulated SMS to ${recipientTrimmed}: ${messageTrimmed.slice(0, 80)}`,
  });
  if (error) {
    console.error("simulateSmsAlert failed:", error.message);
    return { error: "Could not record the simulation." };
  }
  return {};
}

export async function exportAnimalsCsv(
  params: { query?: string; purok?: string } = {}
): Promise<{ csv: string; filename: string } | { error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role;
  if (!role || !["admin", "bhw", "client"].includes(role)) {
    return { error: "You are not authorized to export reports." };
  }
  const isClient = role === "client";

  let query = db.from("animals").select("id, name, species, classification, breed, age, sex, color, owner_name, contact_number, impound_area, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, notes, puroks(name)")
    .order("name");
  if (isClient) query = query.eq("user_id", user.id);

  if (params.query) {
    const term = params.query.toLowerCase();
    query = query.or(`name.ilike.%${term}%,owner_name.ilike.%${term}%,puroks.name.ilike.%${term}%,species.ilike.%${term}%`);
  }
  if (params.purok) {
    const { data: purok } = await db.from("puroks").select("id").eq("name", params.purok).single();
    if (!purok) return { error: "Purok not found." };
    query = query.eq("purok_id", purok.id);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const header = "id,name,species,classification,breed,age,sex,color,owner,contact,impound,purok,vaccinated,vaccine_date,next_due_date,vaccine_type,latitude,longitude,notes";
  const escaped = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = (data ?? []).map((r) => [
    r.id, r.name, r.species, r.classification ?? "", r.breed ?? "", r.age ?? "", r.sex ?? "", r.color ?? "", r.owner_name, r.contact_number ?? "", r.impound_area ?? "", getPurokName((r as { puroks?: unknown }).puroks), r.vaccinated, r.vaccine_date ?? "", r.next_due_date ?? "", r.vaccine_type ?? "", r.latitude ?? "", r.longitude ?? "", r.notes ?? "",
  ].map(escaped).join(","));

  const csv = [header, ...body].join("\n");
  const filename = `vacciTrack-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return { csv, filename };
}

export async function fetchAuditLogPage(params: { page?: number; limit?: number; startDate?: string; endDate?: string; userId?: string; action?: string; tableName?: string }): Promise<{ rows: { id: number; user_id: string | null; action: string | null; table_name: string | null; record_id: number | null; ip_address: string | null; notes: string | null; created_at: string }[]; total: number; page: number; error?: string }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);

  const access = await requireAuditAccess();
  if (!access.ok) return { rows: [], total: 0, page, error: access.error };

  const db = createAdminClient();
  if (!db) return { rows: [], total: 0, page, error: "Service unavailable." };

  const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20) || 20));
  const from = (page - 1) * limit;

  let base = db.from("audit_log").select("*", { count: "exact" });

  // Every audit_log row written by the hidden super-admin dashboard (see
  // crud-actions.ts) uses user_id: null, since that account isn't a Supabase
  // auth user — every other write path always sets a real user_id. A regular
  // "admin" role viewer (the normal in-app Audit tab) should never see the
  // super-admin's actions; only the hidden dashboard's own view can.
  if (access.actor.kind === "admin") {
    base = base.not("user_id", "is", null);
  }

  if (params.action && AUDIT_ACTIONS.includes(params.action as (typeof AUDIT_ACTIONS)[number])) {
    base = base.eq("action", params.action);
  }
  if (params.tableName && /^[a-z_]{1,63}$/.test(params.tableName)) base = base.eq("table_name", params.tableName);
  if (params.userId && UUID_RE.test(params.userId)) base = base.eq("user_id", params.userId);
  if (params.startDate && DATE_RE.test(params.startDate)) base = base.gte("created_at", params.startDate + "T00:00:00Z");
  if (params.endDate && DATE_RE.test(params.endDate)) base = base.lte("created_at", params.endDate + "T23:59:59Z");

  const { count, data } = await base.order("created_at", { ascending: false }).range(from, from + limit - 1);
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      action: r.action,
      table_name: r.table_name,
      record_id: r.record_id,
      ip_address: r.ip_address,
      notes: r.notes,
      created_at: r.created_at,
    })),
    total: count ?? 0,
    page,
  };
}