# TODO — account management, registration, and access-control fixes

Audited the existing code first. Two of the six items were already done; the rest are real gaps.

## Already done (no change)
- [x] **Maps restricted to staff** — `page.tsx` already gates the "Map" nav item and its content behind `isStaff` (`["admin","veterinarian","bhw"]`). Clients/pet owners never see it. No change needed.
- [x] **Username-or-email login** — `signin-action.ts` (`resolveUsernameToEmail`) + the login-mode toggle in `page.tsx` already let any account sign in with username or email. Reused as-is for the email-optional work below.

## 1. Remove the dead "Requested role" control
- [x] Delete the disabled `<select>` from the registration form (`page.tsx`) — it only ever offered one locked option ("Civilian / pet owner"), nothing was being read from it.

## 2. Make email optional, keep SMS required
- [x] Registration form: drop `required` from the email field; contact number stays required (unchanged).
- [x] `register-action.ts`: when email is blank, create the auth user with a synthetic placeholder email (`username@sms.vaccitrack.local`) instead of a real one, and re-validate username/contact format server-side (was previously trusting client-only validation).
- [x] Profile page: email field no longer required; leaving it blank on save no longer touches the stored email (so a placeholder-email account isn't forced to invent a fake address, but can add a real one later).
- [x] Login already works for these accounts via username mode (no change needed — see above).

## 3. ID document: image upload instead of a text reference
- [x] Add a private Supabase Storage bucket (`id-documents`) + RLS policies in `schema.sql` (owner can upload/read their own file, admins can read all) — **requires the user to run the updated `schema.sql` in the Supabase SQL editor.**
- [x] Registration form: replace the text input with a file picker (image only, 5MB cap).
- [x] `register-action.ts`: accept `FormData`, upload the image server-side (service role) right after the auth user is created, store the **storage path** in `profiles.id_document_reference` (repurposed, not renamed — smaller diff).
- [x] Admin "Pending verification" panel: render the ID photo (short-lived signed URL, generated server-side per page load) instead of a text string.

## 4. Account self-management: change password / change username via OTP
- [x] New `account_otps` table (`schema.sql`) — hashed 6-digit code, purpose, channel, expiry, single-use. **Also part of the schema.sql the user needs to run.**
- [x] SMS channel: reuses the existing real Twilio integration (extracted into `src/lib/sms.ts` from the cron route, no behavior change there).
- [x] Email channel: uses Supabase Auth's own built-in email OTP (`signInWithOtp` / `verifyOtp`) — no third-party email provider needed, since none exists in this project. **Caveat left for the user:** this only shows a 6-digit code to the user if the Supabase project's "Magic Link" email template renders `{{ .Token }}`; Supabase's default template does. Worth a quick check in the Supabase dashboard after deploying.
- [x] Accounts with a placeholder (no real) email only get the SMS option — email OTP is hidden for them.
- [x] Profile page: added a "Change username" section, and reworked "Change password" to request an OTP (pick email or SMS) instead of re-entering the current password — this also incidentally gives locked-out-but-signed-in users a saner recovery path than "type the password you're trying to replace."

## 5. Admin: reset any account's password (staff/vet lockout recovery)
- [x] New `resetUserPassword(userId)` action in the hidden-admin dashboard (`crud-actions.ts`) — generates a strong random password server-side, sets it via the admin API, writes an audit-log entry, and returns the password **once** for the admin to relay out-of-band.
- [x] "Reset password" button added to `UsersPanel` next to edit/delete, with a one-time reveal modal.

## Manual step required
Run the updated `supabase/schema.sql` in the Supabase SQL editor before deploying — it adds the `id-documents` storage bucket + policies and the `account_otps` table. Everything else is additive/idempotent like the existing file.
