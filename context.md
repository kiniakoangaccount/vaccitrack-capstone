# VacciTrack Migration Context — `robotograhv2` (PHP) → `robotograhv2-vercel` (Next.js)

_Last updated: 2026-09-13. See "Session update — 2026-09-15" below for what changed since, including corrections to a couple of items in this original tracker that turned out to be stale._

This document tracks parity between the original PHP/MySQL system (`robotograhv2`) and the Next.js + Supabase rewrite (`robotograhv2-vercel`). It records what is **done**, what **gaps remain**, and what **needs to be done next**.

---

## ✅ Done — Parity Achieved

| Feature | Original (PHP) | Vercel (Next.js) |
|---|---|---|
| Animal registry CRUD | `animals.php` | `page.tsx` — Registry tab |
| Animal detail / profile view | `animals.php?action=view` | `AnimalDetailPanel.tsx` |
| Vaccination history timeline | `vaccination_history` table | `AnimalDetailPanel.tsx` timeline |
| Booster logging | `save_booster` handler | `addVaccinationRecord` |
| Leaflet map + heatmap | `map.php` | `LeafletMap.tsx` |
| Risk analysis by purok | `risk.php` | Risk tab |
| Planning (overdue / upcoming) | `planning.php` | Planning tab |
| Feedback submission | `feedback.php` | Feedback tab |
| Audit log | `audit.php` | `AuditPanel.tsx` |
| Settings CRUD (purok / breed / vaccine) | `settings.php` | `settings-page.tsx` |
| User profile / password | `profile.php` | `profile-page.tsx` |
| User management | `users.php` | `UsersPanel.tsx` |
| Registration approval workflow | `register.php` + pending | `PendingPanel.tsx` |
| RBAC (5 roles) | ✅ | ⚠️ now 4 roles — see session update (veterinarian role retired) |
| SMS simulation (admin) | `dashboard.php` `simulate_sms` | `SmsSimForm.tsx` — was actually broken (POSTed to a page route with no handler); fixed this session, see below |
| **CSV export button** | `animals.php?action=export_csv` | **`handleExportCsv()` + Export CSV button in Registry tab** ✅ (Task 7) |
| Program checklist dead code | `planning.php` `$checks` | Removed |
| **Real notifications from DB** | `dashboard.php` `getUnreadNotifications()` | ✅ Actually already wired (topbar bell dropdown fetches real unread `notifications`, has mark-one/mark-all-read) — contrary to the Gaps row below, which is stale. Confirmed by reading `page.tsx` directly on 2026-09-15; not this session's work, done by someone/something between 2026-09-13 and now. |

---

## 🔴 Gaps — Still Missing / Incomplete

| # | Feature | Original location | Status in Vercel | Priority |
|---|---|---|---|---|
| ~~1~~ | ~~Real notifications from DB~~ | ~~`dashboard.php`~~ | **STALE — this is done.** See "Done" table above. Moved out of gaps 2026-09-15. | — |
| 2 | **Pending ID verification widget on dashboard** | `dashboard.php` admin widget | Only in `PendingPanel.tsx` (admin dashboard), not on Overview. Not touched this session. | Medium |
| 3 | **Dashboard charts (pie + monthly trend)** | Chart.js in `dashboard.php` | The vaccination-coverage bar chart is real (computed from live data via a `useEffect`/DOM-write, not React state — a bit hacky but not fake). No species pie, no monthly trend chart. Not touched this session. | Medium |
| 4 | **Vaccination breakdown (Pet/Stray, Dog/Cat counts)** | `dashboard.php` query | Not shown. Not touched this session. | Low |
| 5 | **Auto-calculate next due** | +1 year on add, +6 months on booster | ⚠️ **Partially done this session** — the registration form's "Next vaccination" field now auto-fills to (last vaccination date + 6 months) when a vaccination date is entered. This covers the "booster" half of the original spec; the "+1 year on initial add" distinction was not implemented (there's currently no separate "first-time registration" vs "booster" branch — every vaccine-date entry gets the same +6 month rule). Worth revisiting if the 1-year-on-first-dose behavior matters. | Medium → Low |
| 6 | **Animal edit (registry)** | `animals.php?action=edit` | Detail panel exists but **no edit form** for existing records. Not touched this session. | Medium |
| 7 | **Delete animal** | `animals.php?action=delete` | Not present. Not touched this session. | Medium |
| 8 | **OSM reverse-geocode purok lookup** | `settings.php` `osm_lookup` | Not present. Not touched this session. | Low |
| 9 | **Pagination on registry** | 15/page in `animals.php` | None — renders all rows. Not touched this session. | Low |
| 10 | **"Assigned personnel" per purok** | `planning.php` (stub "Pending Assignment") | Not present (was a stub in the original too). Not touched this session. | Low |
| 11 | **One-time password display on user create/reset** | `users.php` `$_SESSION['one_time_password']` | `UsersPanel.tsx` does this — "Reset password" generates a random password and displays it once in a modal (`resetUserPassword` action). Looks implemented; not deeply verified this session. | Low |
| 12 | **Security lockout manager** | `lockout_manager.php` | Not present. A `login_attempts` table exists in `schema.sql` (tracking) but nothing acts on it (no lockout enforcement). Not touched this session. | Low |
| 13 | **Legend / tooltip density heat layer** | `map.php` custom hover tooltip + legend | `LeafletMap.tsx` has heat + legend — tooltip richness not verified. Not touched this session. | Low |

---

## 📋 Task List (from gap analysis)

- [x] **Task 7** — CSV export button on Registry tab (wires `exportAnimalsCsv` to UI). **DONE**
- [x] **Task 8** — Real notifications from DB. **Confirmed done 2026-09-15** (see note above — was already wired, this tracker was just stale on that point).
- [ ] Task 9 — Animal edit form for existing records.
- [ ] Task 10 — Delete animal (with audit log entry).
- [ ] Task 11 — Dashboard charts: species pie + monthly vaccination trend.
- [~] Task 12 — Auto-calculate next due (+1y add, +6mo booster). **Partially done 2026-09-15** — booster (+6mo) auto-fill implemented; +1y-on-initial-add distinction not implemented.
- [ ] Task 13 — Pagination on registry (15/page).
- [ ] Task 14 — Pending ID verification widget on Overview (admin).
- [ ] Task 15 — Vaccination breakdown stats (Pet/Stray, Dog/Cat).

---

## 🗂 Key Files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Main workspace: auth, tabs (Overview, Registry, Planning, Reports, Risk, Map, Feedback, Team, Audit), CSV export |
| `src/app/AnimalDetailPanel.tsx` | Animal profile + vaccination history timeline |
| `src/app/LeafletMap.tsx` | Coverage map + heat layer |
| `src/app/audit-actions.ts` | Audit log writes, SMS simulation, `exportAnimalsCsv`, `fetchAuditLogPage` |
| `src/app/notification-actions.ts` | Notification read/create actions — wired to the UI (confirmed 2026-09-15) |
| `src/app/vaccination-actions.ts` | Vaccination records |
| `src/app/settings-actions.ts` | Purok/breed/vaccine CRUD |
| `src/app/<hidden-admin-path>/dashboard/*` | Admin panels (Users, Pending, Invites, Feedback, Audit, SMS). Path intentionally not written here — see `src/middleware.ts`, ask an existing admin. |
| `src/lib/sms.ts` | SMS sending — switched from Twilio to Semaphore this session, see below |
| `supabase/schema.sql` | DB schema (animals, puroks, vaccination_history, notifications, audit_log, feedback, users) |

---

## 🔧 Conventions / Notes

- **CSV export**: `exportAnimalsCsv({ query?, purok? })` returns `{ buffer: Buffer, filename }` or `{ error }`. Client converts `Buffer` → `Uint8Array` → `Blob` → download link.
- **Notification panel**: fetches real unread `notifications` for the signed-in user, wired to `markNotificationRead` / `markAllNotificationsRead`. (This entry corrects the previous "currently hardcoded" note, which was stale.)
- **Status calc**: `getAnimalStatus(vaccinated, nextDueDate)` in `page.tsx` drives Vaccinated / Due soon / Overdue badges.
- This "No errors as of last check" line from the previous version of this doc has been removed — no build/lint was run this session either (see below), so that claim can't be re-verified right now.

---

## ▶️ Recommended next step (as of 2026-09-15)

Given Task 8 turned out to already be done, the next highest-value original-tracker items are **Task 9 (animal edit) and Task 10 (delete animal)** — the registry currently has no way to correct a mis-entered record or remove one, which is a real gap for a system meant to replace the PHP original's full CRUD. Otherwise, see "To do for a full production build" below for what's blocking a production deploy specifically (distinct from feature parity).

---

# Session update — 2026-09-15 (Claude Code)

Everything below is from one Claude Code session on this repo, appended to (not replacing) the migration tracker above. Branch used throughout: `staging` (workflow: push to `staging`, open a PR into `master`, merge on GitHub so the merge push is the repo owner's own — see "Git workflow" below for why).

## What has been done

### Super admin dashboard (`/308873d1049ba0/dashboard`)
- The 4 Overview stat boxes are now clickable: Registered users → Users tab, Pending verifications → Pending tab, New feedback items → Feedback tab, Animal records → `/?tab=Registry` (the main app's registry, which vets/BHWs use).
- Main app (`src/app/page.tsx`) reads a `?tab=` query param on load so links like the one above land directly on the right workspace tab.
- Fixed a broken "SMS simulation" feature in the admin Overview: the form was POSTing to a page route with no handler, so every submission silently failed. It now calls the existing `simulateSmsAlert` server action directly. Also removed a non-functional "Include animal notes" checkbox that was never wired to anything.
- Removed unused imports (`writeAuditLog`, `simulateSmsAlert` import in `dashboard/page.tsx`, `Send`, `AlertTriangle`) left over from the above.

### Animal registry form (`page.tsx`)
- Sex: now a required free-text input (was a dropdown with canned options).
- Added a "Neuter status" field (Neutered / Not neutered), separate from the existing Pet/Stray classification.
- Age: relabeled "Age (months)", range widened to 0–360.
- Next vaccination date auto-fills to (last vaccination date + 6 months) when a vaccination date is picked; still editable. (This is Task 12 from the tracker above, partially — see that entry for what's not covered.)
- Removed the manual Latitude/Longitude number inputs; the map click-to-pin / "Use my location" picker still sets those fields internally.
- Submit button renamed "Save animal" → "Register animal".
- The "Register animal" button was previously showing on every workspace tab (Overview, Planning, Reports, etc.) because it wasn't tab-gated. It's now removed entirely from the Overview header — the Registry tab's own "New record" button is the only entry point.
- `neutered boolean not null default false` column added to `public.animals` (both in the `create table` and as an idempotent `alter table ... add column if not exists` for existing databases).

### Feedback
- Feedback submissions are anonymous to admins: the submitter's name is no longer sent on insert (the admin panel already only renders a "From:" line when `name` is present, so it just stops appearing). `user_id` is still stored so a submitter can read their own feedback via RLS.
- Feedback message hint changed to "Tell us how to improve our service."; removed "Bug report" from the Category dropdown.
- **BHW-specific**: BHW accounts can no longer submit feedback (new RLS check on the insert policy excludes `role = 'bhw'`), but can now **read** all feedback in a new read-only inbox view on their Feedback tab (list of category/status/date/message, no edit controls). Backed by a new `"Staff can read feedback"` select policy (`role in ('admin','bhw')`).

### Civilian ("client") role scoping on Overview
- Confirmed (not a fix — this was already correct) that civilians only ever see their own registered animals, counts, and registry activity: every relevant Supabase query in `page.tsx` is scoped by `user_id = auth.uid()` for the client role, and it's backed by DB RLS (`"Clients can read own animals"`). Updated wording only ("Your recent registry activity" / "Pets you have registered...") so the UI makes that scoping explicit instead of reading like a barangay-wide feed.

### Veterinarian role — fully removed
- Removed from every role check, dropdown, label, and permission list: `page.tsx`, all admin dashboard panels (`UsersPanel`, `InvitesPanel`, `PendingPanel`), all server actions (`reminder-actions`, `team-actions`, `vaccination-actions`, `pound-actions`, `notification-actions`, `audit-actions`, `crud-actions`, `invite-register-action`), `register-account.ts`, the invite token page, README.
- DB: removed from the `user_role` enum definition (only affects *new* databases — Postgres can't drop enum values from an existing type without recreating it, which was judged not worth the risk here).
- Added two migration statements for **existing** databases that still have the old enum value: reassign any `profiles.role = 'veterinarian'` to `'bhw'`, and delete/reject any leftover `staff_invites` rows for that role, then tighten the `staff_invites` check constraint.
- ⚠️ **Not yet applied to any real database** — this is a file edit only. See "To do" below.

### Fonts
- Went 50% bigger, then per a later request: reverted every `font-size` in `globals.css` to its pre-scaling original (recovered from git history, not by reverse-computing the earlier rounding) and rescaled by 1.4× instead. Also fixed the two `clamp()` hero-heading font-sizes by hand (regex only covers plain `Npx` declarations).
- Not visually verified in a browser — this environment has no Node.js, so no dev server could be run. See "To do."

### Demo data removed
- Deleted the 5 hardcoded fallback animals (Bantay, Miming, Brownie, Luna, Toby) — registry now starts empty instead of showing fake pets when Supabase isn't connected.
- Removed the hardcoded dashboard stats fallback (128/92/18/9) — always computed from real data now.
- Removed two fabricated "trend" percentage badges (8.4%, 4.2%) on stat cards that were never tied to any calculation.
- "Coverage by purok" on Overview was 100% hardcoded fake percentages — now pulled from the same real per-purok calculation already used on the Risk tab.
- Removed the landing page's fabricated trust-bar stats ("1,240+ Animals registered", "87% coverage", "4,800+ Alerts supported") — no real data source exists pre-login for these.
- The in-app "Audit" tab showed 3 hardcoded fake entries including the literal string "Demo administrator" — now renders the real `AuditPanel` component (same one the super admin dashboard uses, reading from `audit_log` via `fetchAuditLogPage`).
- Renamed `demoBreeds`/`demoVaccines`/`demoPuroks` → `breedOptions`/`vaccineOptions`/`purokOptions`. These were never fake — they mirror real rows seeded into Supabase (`supabase/schema.sql` inserts) — the "demo" naming was just misleading.
- Renamed the "demo mode" connection-status badge to "Not connected" / offline styling instead of "Demo data", consistently across `page.tsx`, `profile-page.tsx`, `settings-page.tsx`.

### Other visual-bug / dead-code fixes
- `/profile` and `/settings` pages: "Back" buttons used mismatched icons (an eye icon and a chevron icon for a back-navigation action) — now a proper arrow-left icon.
- Both pages hardcoded "VacciTrack user / Demo account" in the sidebar regardless of who was signed in — now shows the real signed-in user's name (fetched from `profiles`).
- Removed a stray decorative chevron in `settings-page.tsx` implying a dropdown that didn't exist.
- Removed a dead "Default landing tab" `<select>` (one option, no-op `onChange`) and a fake read-only "Coverage target" `<input>` from the in-app Settings tab; replaced with a link to the real account page and the one button that actually does something (Reset session).
- Cleaned up an unused `Plus`/`X` import in `settings-page.tsx`, and caught/fixed a duplicate `useState`/`useEffect` React import introduced while editing that file.

### SMS provider — Twilio → Semaphore
- `src/lib/sms.ts` (`sendSms`, `normalizePhilippineNumber`) rewritten to call Semaphore (`https://api.semaphore.co/api/v4/messages`) instead of Twilio. Verified against Semaphore's actual docs before implementing, since getting the request shape wrong would silently break every SMS.
- Note the phone number format changed: Semaphore expects local `09XXXXXXXXX`, not Twilio's E.164 `+639XXXXXXXXX` — `normalizePhilippineNumber` now normalizes to `09XXXXXXXXX` instead. `contact_number` is already stored in that format in the DB (per the `^09[0-9]{9}$` check constraints in `schema.sql`), so this is a closer match than before, not a new conversion burden.
- Callers (`src/app/api/cron/vaccination-alerts/route.ts`, `src/app/profile-actions.ts`) needed no changes — they only depend on the `sendSms`/`normalizePhilippineNumber` function signatures, which are unchanged.
- Env vars: `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_MESSAGING_SERVICE_SID`/`TWILIO_FROM_NUMBER` replaced with `SEMAPHORE_API_KEY` (required) and `SEMAPHORE_SENDER_NAME` (optional — omit to use the account's default sender). Updated in `.env.example` and `README.md`.
- ⚠️ **Untested against a real Semaphore account** — no API key was available in this environment to send an actual test message. Send one real SMS end-to-end before relying on this in production, and confirm the sender name (if used) is actually approved on the Semaphore account, or messages will fail silently at send time.

### Git / deployment workflow
- Repo has a `staging` branch now, tracked with `origin/staging`.
- Workflow going forward: commit to `staging`, push, open a PR into `master` on GitHub, merge from the GitHub UI. Documented in `README.md` under "Contributing".
- **Why**: the repo owner is on Vercel's Hobby plan; a collaborator (repo write access, not a Vercel team member) pushed directly to `master` and Vercel blocked the deploy because the commit author isn't recognized as an authorized team member. Routing changes through a PR that the owner merges themselves means the triggering push to `master` is always the owner's own action.
- This is unresolved as a *root cause* — it's worked around, not fixed. See "To do."

## To do for a full production build

### Must do before deploying
1. **Run a real build.** No Node.js/npm was available in this session's environment, so nothing was compiled, type-checked, or linted — every change was reviewed by hand only. Run `npm install && npm run build` (and `npm run lint`) before merging `staging` → `master`, especially given how many files changed across this and prior sessions. Treat all of it as unverified until that passes.
2. **Apply `supabase/schema.sql` to the actual Supabase project.** All the schema changes referenced above (veterinarian-role migration, `neutered` column, feedback RLS policies) are file edits only — nobody has run this against a live database yet. Run it via the Supabase SQL editor or CLI, then spot-check: existing `veterinarian` profiles reassigned to `bhw`, `staff_invites` constraint updated, feedback policies present (`select * from pg_policies where tablename = 'feedback'`).
3. **Send a real test SMS via Semaphore** before trusting the cron job in production (see "SMS provider" above).
4. **Visual QA in a real browser**, specifically:
   - The 1.4× font rescale — nothing was rendered to confirm small fixed-size elements (avatar circles, `.admin-badge`, `.nav-count`) don't visually overflow now that text is bigger but container sizes weren't touched.
   - The BHW feedback inbox (new UI, never rendered).
   - The fixed SMS simulation form.
   - Mobile/narrow-viewport layout generally — not touched or checked this session.
5. **Resolve the Vercel authorization issue at the root**, not just via the PR workflow: either upgrade to a plan/team setup that lets the collaborator be a proper Vercel team member, or formalize "PRs only, no direct pushes to `master`" as a branch-protection rule on GitHub (currently just a convention in the README, not enforced).

### Known gaps / things not covered this session
- **Zero automated tests exist in the repo** (no `*.test.*` / `*.spec.*` files, no test runner configured). For a production capstone system handling real registrations and vaccination data, at minimum the date/status logic (`getAnimalStatus`, `addMonths`, `formatDueDate`) and the RLS-sensitive queries are worth covering.
- **`fetchAuditLogPage` (in `audit-actions.ts`) has no server-side auth/role check** — it's a `"use server"` action callable directly, gated only by the client UI showing it to admins. This is pre-existing (not introduced this session) but is now called from two places (super admin `AuditPanel`, and the main-app Audit tab's reuse of the same component) — worth fixing before a security review, e.g. checking the caller's role against `profiles` before querying.
- **Duplicate Profile/Settings UI surfaces**: there's an in-app "Profile"/"Settings" tab inside the main SPA *and* separate standalone routes (`/profile`, `/settings`) with their own sidebar shell, reachable via the account-menu. They don't share state and diverge slightly in what they offer. Not fixed — flagged as confusing but out of scope for a bug-fix pass; worth a deliberate decision (merge them, or clearly differentiate their purpose) before launch.
- **Semaphore SMS integration is unverified against a live account** (see "SMS provider" above) — send one real test message before relying on automated overdue-vaccination reminders in production.
- **Environment variables that must be set in Vercel before launch** (from `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` (change from any dev defaults), `CRON_SECRET`, `SEMAPHORE_API_KEY` (and `SEMAPHORE_SENDER_NAME` if using a registered sender name).
- **The hidden super-admin route path** (`/308873d1049ba0/...`) is treated as a secret per the repo's own `.env.example` comment ("intentionally not documented anywhere," "treat it like a secret"). Worth confirming it hasn't leaked anywhere it shouldn't (git history is fine since it's already committed, but avoid pasting it into issues/docs/chat going forward).
- **No CI configured** — build/lint/test (once tests exist) should run automatically on PRs into `master`, not rely on manual `npm run build` before merging.
- **The migration-tracker gaps above (Tasks 9–15) were not re-verified this session** beyond the specific cross-references noted inline (Task 8 corrected, Task 12 partially addressed). Treat the rest of that table as still accurate pending a fresh look.
