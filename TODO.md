# TODO — 4 Core Features: Complete, Fix, Implement

Stack: Next.js 16 App Router + React 19, Supabase (Postgres/Auth/RLS), server actions for mutations, Next.js route handlers for HTTP endpoints, Tailwind 4, Leaflet for maps, Vercel Cron for scheduled jobs (`vercel.json`). Roles live in `profiles.role`: `admin | veterinarian | bhw | client | viewer`.

Status: **all items below implemented and verified** (`npm run build` passes cleanly, `tsc --noEmit` clean, `eslint` clean on every touched file). ⚠️ One manual step remains — see "Deployment step required" at the bottom.

---

## 5. Mobile responsiveness + account menu fix — ✅ done

**The bug:** the entire sidebar (`<aside className="sidebar">`) — nav tabs *and* the account dropdown that lived inside it — was `display: none` below 680px with no replacement. On mobile there was no way to switch tabs, and no way to reach the account menu at all.

**Fix:**
- [x] Sidebar is now a slide-in drawer on mobile (`position: fixed`, `transform: translateX(-100%)` by default, `.sidebar-open` slides it in), opened via a new hamburger button in the top bar, closed via a backdrop tap, an explicit close (×) button, or automatically when a nav item is selected (`selectTab` helper).
- [x] The account-menu dropdown (Manage my account / Settings / Sign out) — previously rendered only inside the now-hidden sidebar — moved to anchor on the top bar's profile button instead, so it's reachable on any screen size, not just desktop. Clicking "Manage my account" still just navigates to `/profile`; it was already a separate menu item from "Sign out" in the underlying code, not an accidental direct-logout — the real bug was that the menu was unreachable on mobile, not that it signed people out.
- [x] Verified in an actual headless browser (Playwright, since `chromium-cli` wasn't available in this environment) at both a 1280px desktop viewport and a 390px mobile viewport: hamburger opens/closes the drawer correctly, backdrop-tap closes it, and the profile dropdown renders with the right three options and no console errors. Screenshots taken before/after each interaction.

**Note on how the account-menu was tested:** the dev server needs a real signed-in Supabase session to reach the authenticated dashboard, which I don't have credentials for. I ran a second dev server instance with the Supabase env vars blanked out (not touching your real `.env.local`) to reach the app's existing "no Supabase configured → demo mode" fallback, which still renders the full authenticated-shape dashboard but with `authUser` null — then temporarily bypassed the one `if (authUser)` guard on the profile button *in that running process only* to confirm the dropdown itself renders/behaves correctly, and reverted that one-line change immediately after. No committed code reflects that bypass; `git diff` after the test session showed only the intended changes.

---

## 1. Automatic SMS Alerts (7 days before expiry) — ✅ fixed

**Backend / API & Database**
- [x] **Race condition → duplicate SMS** fixed (`route.ts`): the retry path now does an atomic claim (`UPDATE ... WHERE id=? AND status=<previously-read-status>`, proceeds only if a row came back), closing the window where two overlapping invocations could both send.
- [x] Non-constant-time secret check fixed — `isAuthorized` now uses `timingSafeEqual` via a `safeEqual` helper.
- [x] N+1 query fixed — existing `vaccination_alerts` rows are now batch-fetched once with `.in("animal_id", ids)` before the loop, and the later status updates use the row's `id` instead of a repeated 3-column filter.

**Frontend / Web UI**
- [x] N/A — background job, no UI surface.

**Security / RBAC Permissions**
- [x] `CRON_SECRET` check hardened (see above).

---

## 2. Role-Based CSV Reports — ✅ fixed

**Backend / API & Database**
- [x] `exportAnimalsCsv` (`audit-actions.ts`) now requires an authenticated session (`getAuthenticatedUser`) and looks up the caller's `profiles.role`.
- [x] Query is scoped: `client` role forces `.eq("user_id", user.id)`; `admin | veterinarian | bhw` get the full unrestricted query; any other role (or unauthenticated) is rejected.
- [x] Extracted the duplicated cookie-authenticated Supabase client into one shared helper: `src/lib/supabase-server.ts` (`createAuthenticatedClient` / `getAuthenticatedUser`), now used by `notification-actions.ts`, `profile-actions.ts`, `reminder-actions.ts`, and `audit-actions.ts` — removed 4 near-duplicate copies, including one that had silently diverged (no-op cookie writes).

**Frontend / Web UI**
- [x] No UI changes needed — export button/download flow unchanged; clients still don't see the "Export CSV" button (kept as-is, since the spec only calls for staff-facing bulk export).

**Security / RBAC Permissions**
- [x] Enforced server-side in the action itself, not just via UI hiding.

---

## 3. Automatic Map Pinning — ✅ implemented

**Backend / API & Database**
- [x] No schema changes needed — reused existing `animals.latitude`/`longitude`.
- Address-typed geocoding was **not** implemented (see decision below) — click-on-map + "use my location" only.

**Frontend / Web UI**
- [x] Wired `<LeafletMap pickMode onPickCoordinates={...}>` into the Register Animal form, with the picked point rendered live as a marker on the same map.
- [x] Added a "Use my location" button (`navigator.geolocation.getCurrentPosition`) next to the picker.
- [x] Manual lat/lng inputs kept as a fallback — the picker just fills the same fields.
- [x] Fixed an unrelated but blocking bug found along the way: `LeafletMap` was statically imported into `page.tsx`, and `leaflet`'s module-level code touches `window`, which crashed Next's server-side prerender of `/`. Converted to `next/dynamic(..., { ssr: false })`.

**Security / RBAC Permissions**
- [x] No change — inherits the existing register-form permission gate.

**Decision made (was an open question):** address-typed geocoding was left out of this pass to avoid picking a third-party geocoding provider without sign-off. Click + GPS covers the spec's "picks a location" and "provides GPS coordinates" cases; "enters an address" is not yet implemented — flag if you want it added.

---

## 4. Stray Dog Directory & Pound Status Section — ✅ implemented

**Backend / API & Database**
- [x] Added `animals.pound_status` column + check constraint in `supabase/schema.sql` (nullable, values: `Impounded | Under Observation | Up for Adoption | Reclaimed`).
- [x] New server action `updatePoundStatus(animalId, status)` in `src/app/pound-actions.ts` — requires an authenticated session and a staff role (`admin | veterinarian | bhw`) before writing, following the corrected pattern (not the old `addVaccinationRecord`/`createNotification` pattern).
- No separate audit-trail table was added — see decision below.

**Frontend / Web UI**
- [x] New "Stray & pound" tab in the sidebar (staff-only), added to `WorkspaceTab`.
- [x] Directory grid of stray animals (`classification === "Stray"`) with a status badge per card (new `.status-info` tone added alongside the existing good/warn/danger badges).
- [x] Filters: free-text search (name/purok/impound area) + status dropdown.
- [x] Per-card status-change `<select>` calling `updatePoundStatus`, with an optimistic local update on success and an inline error on failure.
- [x] Registering an animal as "Stray" now defaults its `pound_status` to `"Impounded"`.

**Security / RBAC Permissions**
- [x] Directory view: staff-only (`isStaff` gate + `RoleBlocked` fallback, same pattern as Planning/Reports/Risk/Map).
- [x] Status updates: enforced **inside** `updatePoundStatus`, not just hidden in the UI.

**Decisions made (were open questions):**
- No public "adoptable strays" list for civilians was built — the directory is staff-internal only, matching the other operational tabs (Planning/Reports/Risk/Map). Flag if a public-facing view is wanted later.
- No `pound_status_history` audit table — status is overwritten in place, consistent with how `animals.vaccinated`/`vaccine_date` already work elsewhere in this codebase. Easy to add later if an audit trail becomes a requirement.

---

## Cross-cutting security fixes (done alongside the features above)

- [x] `addVaccinationRecord` (`vaccination-actions.ts`) now requires an authenticated staff session (previously: service-role admin client, zero auth check, callable by anyone). Also no longer trusts a client-supplied `recordedBy` — uses the authenticated user's id. Also no longer unconditionally overwrites `animals.vaccine_date`/`next_due_date` — only advances them if the new record isn't older than what's on file, so back-filling an earlier dose can't stomp a more recent one.
- [x] `createNotification` (`notification-actions.ts`) now requires an authenticated staff session (previously: admin client, no auth check, arbitrary `userId`).
- [x] Shared `src/lib/supabase-server.ts` helper now used everywhere a server action needs the caller's session, instead of 4+ hand-rolled copies.
- [x] `AnimalDetailPanel.tsx` updated to match the new `addVaccinationRecord` signature (dropped the now-unnecessary `userId` prop). Note: this component is not currently rendered anywhere in the app (dead code, pre-existing) — left as-is since wiring it up wasn't requested.

---

## Deployment step required (cannot be done from here)

The `pound_status` column (and its check constraint) were added to `supabase/schema.sql`, but **this repo has no automated migration runner** — `schema.sql` is applied manually/by CI elsewhere. You'll need to run the updated `supabase/schema.sql` against your actual Supabase project (e.g. via the Supabase SQL editor or `supabase db push`) before the "Stray & pound" tab will work against live data — it's additive and safe to rerun (`add column if not exists`, guarded constraint).

## Incidental fixes (pre-existing, unrelated to the 4 features, but were blocking `npm run build`)

- `src/app/profile-page.tsx` had a pre-existing TypeScript error (implicit `any` on a destructured `.then()` callback param) that failed the production type-check. Fixed with an explicit type annotation.
- Confirmed `@supabase/ssr@0.12.7` vs `@supabase/supabase-js@2.116.0` is a significant version gap and is likely *why* that inference failed in the first place (Supabase client types were resolving to `any` in places). Not touched — a dependency bump is a separate, riskier change than what was asked here; flagging for awareness.
