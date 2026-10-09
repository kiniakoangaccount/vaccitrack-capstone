"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

async function requireStaffDb() {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." } as const;

  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." } as const;

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "bhw"].includes(profile.role)) {
    return { error: "Only staff accounts can manage animal records." } as const;
  }
  return { db, userId: user.id } as const;
}

export async function deleteAnimalRecord(animalId: number): Promise<{ error?: string }> {
  const ctx = await requireStaffDb();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.db.from("animals").delete().eq("id", animalId);
  if (error) return { error: error.message };
  await logAudit(ctx.db, { userId: ctx.userId, action: "DELETE", tableName: "animals", recordId: animalId, notes: "Animal record deleted." });
  return {};
}

export interface AnimalEditFields {
  name: string;
  breed: string;
  age: string;
  sex: string;
  color: string;
  ownerName: string;
  contactNumber: string;
  impoundArea: string;
  notes: string;
}

export async function updateAnimalRecord(
  animalId: number,
  fields: AnimalEditFields
): Promise<{ error?: string }> {
  const ctx = await requireStaffDb();
  if ("error" in ctx) return { error: ctx.error };

  const name = fields.name.trim();
  const ownerName = fields.ownerName.trim();
  if (!name) return { error: "Animal name is required." };
  if (!ownerName) return { error: "Civilian / owner name is required." };

  const { error } = await ctx.db.from("animals").update({
    name,
    breed: fields.breed.trim() || null,
    // The animals.age column is not-null with no default on the deployed
    // database (schema.sql's default is not applied in production), so an
    // empty age silently 500s instead of saving — fall back to 0.
    age: fields.age ? Number(fields.age) : 0,
    sex: fields.sex.trim() || null,
    color: fields.color.trim() || null,
    owner_name: ownerName,
    contact_number: fields.contactNumber.trim() || null,
    impound_area: fields.impoundArea.trim() || null,
    notes: fields.notes.trim() || null,
  }).eq("id", animalId);
  if (error) return { error: error.message };
  await logAudit(ctx.db, { userId: ctx.userId, action: "UPDATE", tableName: "animals", recordId: animalId, notes: `Animal record updated: "${name}".` });
  return {};
}
