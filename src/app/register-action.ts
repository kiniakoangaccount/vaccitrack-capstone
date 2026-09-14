"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { placeholderEmailFor } from "@/lib/account";

const MAX_ID_IMAGE_BYTES = 5 * 1024 * 1024;

export async function registerUser(formData: FormData): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!db) {
    // Fallback: Supabase not configured — this will never send email either
    // because there's no client to call. Surface a clear message.
    return { error: "Registration is not available yet — the system is not connected to Supabase." };
  }

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const contact = (formData.get("contact") as string | null)?.trim() ?? "";
  const idImage = formData.get("idImage");

  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)) {
    return { error: "Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens." };
  }
  if (!/^09\d{9}$/.test(contact)) {
    return { error: "Enter a valid 11-digit Philippine mobile number starting with 09." };
  }
  if (!fullName) return { error: "Full name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters long." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address, or leave it blank." };
  if (!(idImage instanceof File) || idImage.size === 0) return { error: "Upload a photo of a valid ID." };
  if (!idImage.type.startsWith("image/")) return { error: "The ID upload must be an image file." };
  if (idImage.size > MAX_ID_IMAGE_BYTES) return { error: "The ID image must be smaller than 5MB." };

  // auth.admin.createUser skips email confirmation entirely.
  // email_confirm: true marks the auth record as confirmed so the user
  // can sign in once the admin approves their profile status.
  const { data, error } = await db.auth.admin.createUser({
    email: email || placeholderEmailFor(username),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      contact_number: contact,
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

  const ext = (idImage.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${data.user.id}/id-document.${ext}`;
  const { error: uploadError } = await db.storage.from("id-documents").upload(path, idImage, {
    contentType: idImage.type,
    upsert: true,
  });
  if (uploadError) {
    // Account already exists at this point — don't leave it stuck with no ID on file.
    await db.from("profiles").update({ id_document_reference: null }).eq("id", data.user.id);
    return { error: `Account created, but the ID photo failed to upload: ${uploadError.message}. Contact an administrator.` };
  }

  const { error: profileError } = await db.from("profiles").update({ id_document_reference: path }).eq("id", data.user.id);
  if (profileError) return { error: profileError.message };

  return {};
}
