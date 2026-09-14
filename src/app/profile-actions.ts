"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";

async function getAuthenticatedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { user: null, error: "Service unavailable." };

  const cookieStore = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes are not available in every server component context.
        }
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  return { user: data.user, error: error?.message };
}

export async function updateProfile(
  payload: { fullName?: string; email?: string; contact?: string }
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) return { error: authError ?? "You must be signed in." };

  const updates: Record<string, string> = {};
  if (payload.fullName !== undefined) updates.full_name = payload.fullName;
  if (payload.contact !== undefined) updates.contact_number = payload.contact;

  if (payload.email !== undefined && payload.email !== user.email) {
    const { error } = await db.auth.admin.updateUserById(user.id, { email: payload.email });
    if (error) return { error: error.message };
  }
  if (Object.keys(updates).length === 0) return {};

  const { error } = await db.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function updatePassword(
  payload: { currentPassword?: string; newPassword: string }
): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Service unavailable." };
  if (payload.newPassword.length < 8) return { error: "Password must be at least 8 characters long." };
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user?.email) return { error: authError ?? "You must be signed in." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: "Service unavailable." };
  const cookieStore = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { error: passwordError } = await client.auth.signInWithPassword({ email: user.email, password: payload.currentPassword ?? "" });
  if (passwordError) return { error: "The current password is incorrect." };

  const { error } = await db.auth.admin.updateUserById(user.id, { password: payload.newPassword });
  if (error) return { error: error.message };
  return {};
}