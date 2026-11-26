"use server";

import { createAuthenticatedClient } from "@/lib/supabase-server";
import { createManagedAccount, type ManagedAccountInput } from "@/lib/managed-account";

export async function createAdminManagedAccount(input: ManagedAccountInput) {
  const client = await createAuthenticatedClient();
  if (!client) return { error: "Account creation is unavailable." };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Sign in with an administrator account to continue." };

  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: "Only administrators can create user accounts." };
  return createManagedAccount(input, { userId: user.id, label: `Administrator ${user.id}` });
}
