# TODO — account management, registration, and access-control fixes

Audited the existing code first. Two of the six items were already done; the rest are real gaps.

## Already done (no change)
- [x] **Maps restricted to staff** — `page.tsx` already gates the "Map" nav item and its content behind `isStaff` (`["admin","veterinarian","bhw"]`). Clients/pet owners never see it. No change needed.
- [x] **Username login** — `signin-action.ts` resolves the username to Supabase Auth's internal identifier. Users sign in with usernames only.

## 1. Remove the dead "Requested role" control
- [x] Delete the disabled `<select>` from the registration form (`page.tsx`) — it only ever offered one locked option ("Civilian / pet owner"), nothing was being read from it.

## 2. Use username and SMS for account access
- [x] Registration and profile forms collect no email address; phone contact remains required.
- [x] `register-action.ts` creates a synthetic Supabase Auth identity from the username because Supabase Auth requires one. It is internal and is not used for messaging.
- [x] Sign-in, password recovery, account OTP, reminders, and admin communication use usernames and/or SMS only.

## 3. ID document: image upload instead of a text reference
- [x] Add a private Supabase Storage bucket (`id-documents`) + RLS policies in `schema.sql` (owner can upload/read their own file, admins can read all) — **requires the user to run the updated `schema.sql` in the Supabase SQL editor.**
- [x] Registration form: replace the text input with a file picker (image only, 5MB cap).
- [x] `register-action.ts`: accept `FormData`, upload the image server-side (service role) right after the auth user is created, store the **storage path** in `profiles.id_document_reference` (repurposed, not renamed — smaller diff).
- [x] Admin "Pending verification" panel: render the ID photo (short-lived signed URL, generated server-side per page load) instead of a text string.

## 4. Account self-management: change password / change username via SMS OTP
- [x] New `account_otps` table (`schema.sql`) — hashed 6-digit code, purpose, channel, expiry, single-use. **Also part of the schema.sql the user needs to run.**
- [x] SMS channel: reuses the existing real Semaphore integration (extracted into `src/lib/sms.ts` from the cron route, no behavior change there).
- [x] Account OTPs are SMS-only; the schema removes the obsolete email channel.
- [x] Profile page: "Change username" and "Change password" request an SMS OTP instead of re-entering the current password.

## 5. Admin: reset any account's password (staff/vet lockout recovery)
- [x] New `resetUserPassword(userId)` action in the hidden-admin dashboard (`crud-actions.ts`) — generates a strong random password server-side, sets it via the admin API, writes an audit-log entry, and returns the password **once** for the admin to relay out-of-band.
- [x] "Reset password" button added to `UsersPanel` next to edit/delete, with a one-time reveal modal.

## Manual step required
Run the updated `supabase/schema.sql` in the Supabase SQL editor before deploying — it adds the `id-documents` storage bucket + policies and the `account_otps` table. Everything else is additive/idempotent like the existing file.
