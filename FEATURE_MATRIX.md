# VacciTrack — feature access by role

Reconstructed from `supabase/schema.sql` (RLS policies) and the role checks in `src/app/page.tsx`, `src/app/audit-actions.ts`, and the hidden admin dashboard.

Two separate "admin" concepts exist — worth keeping straight:
- **Admin (in-app role)** — `profiles.role = 'admin'`, a normal staff account that signs in like everyone else.
- **Hidden Super-Admin** — the separate system at `/308873d1049ba0`, env-var login, not a Supabase Auth account and not in `profiles` at all.

| Feature | Client (pet owner) | Viewer | BHW | Veterinarian | Admin (in-app role) | Hidden Super-Admin |
|---|---|---|---|---|---|---|
| Self-register | ✅ (only role that can) | ❌ (staff-provisioned) | ❌ | ❌ | ❌ | n/a |
| Sign in (username or email) | ✅ | ✅ | ✅ | ✅ | ✅ | separate login at `/308873d1049ba0` |
| Overview tab | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own dashboard) |
| Registry (animal list) | ✅ own animals only | ❌ | ✅ all | ✅ all | ✅ all | — (uses own Users/Pending tables) |
| Add/edit animals | ✅ own only | ❌ | ✅ all | ✅ all | ✅ all | — |
| Planning tab | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| Reports / CSV export | ✅ own animals | ❌ | ✅ all | ✅ all | ✅ all | — |
| Risk tab | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| Coverage map | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| Pound / stray directory | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| Team roster | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| Feedback (submit) | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own | — |
| Feedback inbox (manage all) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ❌ | ✅ (in-app tab) | ✅ (own tab) |
| Puroks/breeds/vaccines lookup tables | 👁️ read-only | 👁️ read-only | ✅ manage | ✅ manage | ✅ manage | — |
| Vaccination history | 👁️ own animals | ❌ | ✅ manage all | ✅ manage all | ✅ manage all | — |
| Notifications | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own | — |
| Change own username/password (OTP) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (rotated via Vercel env vars instead) |
| Pending-verification approve/reject | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit any account's role/status | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reset any account's password | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete any account | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View submitted ID photos | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Open questions worth revisiting
- **Viewer is the most locked-down role** — it can't see the animal registry at all (`!isViewer` gate on Registry), only Overview + its own feedback/notifications. Confirm that matches the intended meaning of "viewer."
- **There's no "invite new staff" flow** — a BHW/veterinarian/admin account starts life as a normal client self-registration, and a hidden-dashboard super-admin promotes it via the role dropdown in `UsersPanel`. A dedicated staff-invite flow would be a separate feature to scope.
