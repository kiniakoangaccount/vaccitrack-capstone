"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";

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
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { error } = await db.from("audit_log").insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    notes,
  });
  if (error) return { error: error.message };
  return {};
}

export async function simulateSmsAlert(
  userId: string,
  recipient: string,
  message: string
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { error } = await db.from("audit_log").insert({
    user_id: userId,
    action: "SMS_SENT",
    table_name: "animals",
    notes: `Simulated SMS to ${recipient}: ${message.slice(0, 80)}`,
  });
  if (error) return { error: error.message };
  return {};
}

export async function exportAnimalsCsv(
  params: { query?: string; purok?: string } = {}
): Promise<{ buffer: Buffer; filename: string } | { error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role;
  if (!role || !["admin", "veterinarian", "bhw", "client"].includes(role)) {
    return { error: "You are not authorized to export reports." };
  }
  const isClient = role === "client";

  let query = db.from("animals").select("id, name, species, classification, breed, age, sex, color, owner_name, contact_number, impound_area, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, notes")
    .order("name");
  if (isClient) query = query.eq("user_id", user.id);

  if (params.query) {
    const term = params.query.toLowerCase();
    query = query.or(`name.ilike.%${term},owner_name.ilike.%${term},puroks.name.ilike.%${term},species.ilike.%${term}`);
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

  const buffer = Buffer.from([header, ...body].join("\n"), "utf-8");
  const filename = `vacciTrack-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return { buffer, filename };
}

export async function fetchAuditLogPage(params: { page?: number; limit?: number; startDate?: string; endDate?: string; userId?: string; action?: string; tableName?: string }): Promise<{ rows: { id: number; user_id: string | null; action: string | null; table_name: string | null; record_id: number | null; ip_address: string | null; notes: string | null; created_at: string }[]; total: number; page: number }> {
  const db = createAdminClient();
  if (!db) return { rows: [], total: 0, page: params.page ?? 1 };

  const limit = params.limit ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * limit;

  let base = db.from("audit_log").select("*", { count: "exact" });

  if (params.action) base = base.eq("action", params.action);
  if (params.tableName) base = base.eq("table_name", params.tableName);
  if (params.userId) base = base.eq("user_id", params.userId);
  if (params.startDate) base = base.gte("created_at", params.startDate + "T00:00:00Z");
  if (params.endDate) base = base.lte("created_at", params.endDate + "T23:59:59Z");

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