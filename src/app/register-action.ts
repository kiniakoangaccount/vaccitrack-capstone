"use server";

import { createAdminClient } from "@/lib/supabase-admin";

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  username: string;
  contact: string;
  idDocument: string;
}

export async function registerUser(payload: RegisterPayload): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) {
    // Fallback: Supabase not configured — this will never send email either
    // because there's no client to call. Surface a clear message.
    return { error: "Registration is not available yet — the system is not connected to Supabase." };
  }

  // auth.admin.createUser skips email confirmation entirely.
  // email_confirm: true marks the auth record as confirmed so the user
  // can sign in once the admin approves their profile status.
  const { data, error } = await db.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.fullName,
      username: payload.username,
      contact_number: payload.contact,
      id_document_reference: payload.idDocument.trim(),
      requested_role: "client",
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("already been registered") ||
        error.message.toLowerCase().includes("unique")) {
      return { error: "An account with that email already exists." };
    }
    return { error: error.message };
  }

  if (!data.user) return { error: "Registration failed. Please try again." };
  return {};
}
