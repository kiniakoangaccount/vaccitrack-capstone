"use server";

import { createAdminClient } from "@/lib/supabase-admin";

export async function addPurok(name: string, latitude: number, longitude: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("puroks").insert({ name, latitude, longitude });
  if (error) return { error: error.message };
  return {};
}

export async function updatePurok(id: number, name: string, latitude: number, longitude: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("puroks").update({ name, latitude, longitude }).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deletePurok(id: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("puroks").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function addBreed(name: string, species: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("breeds").insert({ name, species });
  if (error) return { error: error.message };
  return {};
}

export async function deleteBreed(id: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("breeds").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function addVaccine(name: string, species: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("vaccines").insert({ name, species });
  if (error) return { error: error.message };
  return {};
}

export async function deleteVaccine(id: number): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { error } = await db.from("vaccines").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}