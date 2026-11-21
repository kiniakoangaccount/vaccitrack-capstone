// Supabase Auth requires an email or phone identity; accounts in this app use
// username and SMS only, so this synthetic address stays internal to Auth.
export const PLACEHOLDER_EMAIL_DOMAIN = "sms.vaccitrack.local";

export function placeholderEmailFor(username: string): string {
  return `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}
