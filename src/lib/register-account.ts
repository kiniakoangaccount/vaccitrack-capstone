import { createAdminClient } from "@/lib/supabase-admin";
import { placeholderEmailFor } from "@/lib/account";

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

export async function createAccountFromForm(
  formData: FormData,
  role: "client" | "bhw" | "admin",
  status: "pending" | "active"
): Promise<{ error?: string; userId?: string }> {
  const db = createAdminClient();
  if (!db) return { error: "Registration is not available yet — the system is not connected to Supabase." };

  const password = (formData.get("password") as string | null) ?? "";
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const contact = (formData.get("contact") as string | null)?.trim() ?? "";
  const profilePhoto = formData.get("profilePhoto");

  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)) {
    return { error: "Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens." };
  }
  if (!/^09\d{9}$/.test(contact)) {
    return { error: "Enter a valid 11-digit Philippine mobile number starting with 09." };
  }
  if (!fullName) return { error: "Full name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters long." };
  if (!(profilePhoto instanceof File) || profilePhoto.size === 0) return { error: "Choose a photo of yourself or use your camera." };
  if (!profilePhoto.type.startsWith("image/")) return { error: "The uploaded photo must be an image file." };
  if (profilePhoto.size > MAX_PROFILE_PHOTO_BYTES) return { error: "The photo must be smaller than 5MB. Choose a smaller image and try again." };

  // Usernames are also used to sign in, so check the profiles unique index
  // before Auth reports a duplicate synthetic identity.
  const { data: existingUsername } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existingUsername) return { error: "That username is already taken. Please choose another." };

  const { data, error } = await db.auth.admin.createUser({
    email: placeholderEmailFor(username),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, contact_number: contact },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("already been registered") ||
        error.message.toLowerCase().includes("unique")) {
      return { error: "That username is already taken. Please choose another." };
    }
    return { error: error.message };
  }
  if (!data.user) return { error: "Registration failed. Please try again." };
  const userId = data.user.id;

  const path = `${userId}/profile-photo.jpg`;
  const { error: uploadError } = await db.storage.from("id-documents").upload(path, profilePhoto, {
    contentType: profilePhoto.type,
    upsert: true,
  });
  if (uploadError) {
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return { error: "Could not upload your photo. Please try again." };
  }

  // Keep the deployed approval-photo column and bucket contract for compatibility.
  const { error: profileError } = await db.from("profiles").update({ role, status, id_document_reference: path }).eq("id", userId);
  if (profileError) {
    await db.storage.from("id-documents").remove([path]).catch(() => {});
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return { error: "Could not finish creating the account. Please try again." };
  }

  return { userId };
}
