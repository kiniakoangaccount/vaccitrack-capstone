"use server";

import { createAccountFromForm } from "@/lib/register-account";

export async function registerUser(formData: FormData): Promise<{ error?: string }> {
  const result = await createAccountFromForm(formData, "client", "pending");
  return { error: result.error };
}
