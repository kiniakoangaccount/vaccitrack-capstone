import { createAdminClient } from "@/lib/supabase-admin";
import { placeholderEmailFor } from "@/lib/account";
import { logAudit } from "@/lib/audit";

export type ManagedAccountInput = {
  username: string;
  fullName: string;
  contact: string;
  password: string;
  role: "admin" | "bhw" | "client" | "viewer";
  status: "active" | "pending" | "disabled";
};

export async function createManagedAccount(
  input: ManagedAccountInput,
  actor: { userId: string | null; label: string },
): Promise<{ userId?: string; username?: string; error?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Account creation is unavailable because the database service is not configured." };

  const username = input.username.trim();
  const fullName = input.fullName.trim();
  const contact = input.contact.trim();
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)) return { error: "Username must be 3–80 characters and use letters, numbers, dots, underscores, or hyphens." };
  if (!fullName || fullName.length > 120) return { error: "Enter a full name up to 120 characters." };
  if (!/^09\d{9}$/.test(contact)) return { error: "Enter an 11-digit Philippine mobile number starting with 09." };
  if (input.password.length < 8 || input.password.length > 128) return { error: "Password must be 8–128 characters long." };
  if (!["admin", "bhw", "client", "viewer"].includes(input.role)) return { error: "Choose a valid account role." };
  if (!["active", "pending", "disabled"].includes(input.status)) return { error: "Choose a valid account status." };

  const { data: existing } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) return { error: "That username is already taken." };

  const { data, error } = await db.auth.admin.createUser({
    email: placeholderEmailFor(username),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, contact_number: contact },
  });
  if (error || !data.user) {
    const message = error?.message.toLowerCase() ?? "";
    return { error: message.includes("already") || message.includes("unique") ? "That username is already taken." : error?.message ?? "Could not create the account." };
  }

  const userId = data.user.id;
  const { error: profileError } = await db.from("profiles").update({
    full_name: fullName,
    username,
    contact_number: contact,
    role: input.role,
    status: input.status,
  }).eq("id", userId);
  if (profileError) {
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return { error: "The account was created but its profile could not be saved. Please try again." };
  }

  await logAudit(db, {
    userId: actor.userId,
    action: "INSERT",
    tableName: "profiles",
    notes: `${actor.label} created a ${input.role} account (${input.status}) for ${username}; account id ${userId}.`,
  });
  return { userId, username };
}
