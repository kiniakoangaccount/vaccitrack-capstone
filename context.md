# VacciTrack Migration Context — `robotograhv2` (PHP) → `robotograhv2-vercel` (Next.js)

_Last updated: 2026-09-13_

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
| RBAC (5 roles) | ✅ | ✅ |
| SMS messaging (staff and super-admin) | — | `SmsComposer.tsx` + `sms-actions.ts` (Semaphore; individual or 7-day vaccination batch); `SmsTestForm.tsx` for super-admin test sends |
| **CSV export button** | `animals.php?action=export_csv` | **`handleExportCsv()` + Export CSV button in Registry tab** ✅ (Task 7) |
| Program checklist dead code | `planning.php` `$checks` | Removed |

---

## 🔴 Gaps — Still Missing / Incomplete

| # | Feature | Original location | Status in Vercel | Priority |
|---|---|---|---|---|
| 1 | **Real notifications from DB** | `dashboard.php` `getUnreadNotifications()` | `notification-actions.ts` exists (`markNotificationRead`, `markAllNotificationsRead`, `createNotification`) but the notification panel in `page.tsx` is **hardcoded**. No fetch of unread notifications, no mark-as-read wiring. | **Task #8** |
| 2 | **Pending ID verification widget on dashboard** | `dashboard.php` admin widget | Only in `PendingPanel.tsx` (admin dashboard), not on Overview. | Medium |
| 3 | **Dashboard charts (pie + monthly trend)** | Chart.js in `dashboard.php` | Static fake bar chart (hardcoded heights). No species pie, no monthly trend. | Medium |
| 4 | **Vaccination breakdown (Pet/Stray, Dog/Cat counts)** | `dashboard.php` query | Not shown. | Low |
| 5 | **Auto-calculate next due** | +1 year on add, +6 months on booster | Not implemented — user enters next due manually. | Medium |
| 6 | **Animal edit (registry)** | `animals.php?action=edit` | Detail panel exists but **no edit form** for existing records. | Medium |
| 7 | **Delete animal** | `animals.php?action=delete` | Not present. | Medium |
| 8 | **OSM reverse-geocode purok lookup** | `settings.php` `osm_lookup` | Not present. | Low |
| 9 | **Pagination on registry** | 15/page in `animals.php` | None — renders all rows. | Low |
| 10 | **"Assigned personnel" per purok** | `planning.php` (stub "Pending Assignment") | Not present (was a stub in the original too). | Low |
| 11 | **One-time password display on user create/reset** | `users.php` `$_SESSION['one_time_password']` | Check `UsersPanel.tsx` — not verified. | Low |
| 12 | **Security lockout manager** | `lockout_manager.php` | Not present. | Low |
| 13 | **Legend / tooltip density heat layer** | `map.php` custom hover tooltip + legend | `LeafletMap.tsx` has heat + legend — verify tooltip richness. | Low |

---

## 📋 Task List (from gap analysis)

- [x] **Task 7** — CSV export button on Registry tab (wires `exportAnimalsCsv` to UI). **DONE**
- [ ] **Task 8** — Real notifications from DB (replace hardcoded panel; use `notification-actions.ts`). **NEXT**
- [ ] Task 9 — Animal edit form for existing records.
- [ ] Task 10 — Delete animal (with audit log entry).
- [ ] Task 11 — Dashboard charts: species pie + monthly vaccination trend.
- [ ] Task 12 — Auto-calculate next due (+1y add, +6mo booster).
- [ ] Task 13 — Pagination on registry (15/page).
- [ ] Task 14 — Pending ID verification widget on Overview (admin).
- [ ] Task 15 — Vaccination breakdown stats (Pet/Stray, Dog/Cat).

---

## 🗂 Key Files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Main workspace: auth, tabs (Overview, Registry, Planning, Reports, Risk, Map, Feedback, Team, SMS, Audit), CSV export |
| `src/app/AnimalDetailPanel.tsx` | Animal profile + vaccination history timeline |
| `src/app/LeafletMap.tsx` | Coverage map + heat layer |
| `src/app/audit-actions.ts` | Audit log access, `exportAnimalsCsv`, `fetchAuditLogPage` |
| `src/app/sms-actions.ts` | SMS authorization, target preview, Semaphore send, and audit updates |
| `src/app/notification-actions.ts` | Notification read/create actions (⚠️ not yet wired to UI) |
| `src/app/vaccination-actions.ts` | Vaccination records |
| `src/app/settings-actions.ts` | Purok/breed/vaccine CRUD |
| `src/app/<hidden-admin-path>/dashboard/*` | Admin panels (Users, Pending, Invites, Feedback, Audit, SMS). Path intentionally not written here — see `src/proxy.ts`, ask an existing admin. |
| `supabase/schema.sql` | DB schema (animals, puroks, vaccination_history, notifications, audit_log, feedback, users) |

---

## 🔧 Conventions / Notes

- **CSV export**: `exportAnimalsCsv({ query?, purok? })` returns `{ buffer: Buffer, filename }` or `{ error }`. Client converts `Buffer` → `Uint8Array` → `Blob` → download link.
- **Notification panel**: Currently hardcoded. To fix, fetch `notifications` where `user_id = authUser.id` and `is_read = false`, then use `markNotificationRead` / `markAllNotificationsRead`.
- **Status calc**: `getAnimalStatus(vaccinated, nextDueDate)` in `page.tsx` drives Vaccinated / Due soon / Overdue badges.
- **No errors** in `page.tsx` or `globals.css` as of last check.

---

## ▶️ Recommended Next Step

**Task 8 — Real notifications from DB.**

1. Add state: `notifications`, `unreadCount`.
2. On mount (after auth), fetch unread notifications for `authUser.id`.
3. Replace hardcoded notification list in the topbar dropdown with fetched data.
4. Wire "mark as read" / "mark all read" to `notification-actions.ts`.
5. Show unread badge count on the bell icon.
