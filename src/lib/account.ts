// Accounts registered without a real email get a synthetic placeholder so
// Supabase Auth (which requires an email or phone) still works. Detecting
// the suffix avoids needing a separate "has_email" column.
export const PLACEHOLDER_EMAIL_DOMAIN = "sms.vaccitrack.local";

export function placeholderEmailFor(username: string): string {
  return `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function hasRealEmail(email: string | null | undefined): boolean {
  return Boolean(email) && !email!.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
