"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, WandSparkles } from "lucide-react";
import {
  confirmAutomaticAppointmentSchedule,
  previewAutomaticAppointmentSchedule,
  type AutomaticAppointmentDraft,
  type AutomaticScheduleOptions,
  type AutomaticSchedulePreview,
} from "@/app/_features/appointments/appointment-actions";
import { todayLocalIso } from "@/lib/dates";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const INITIAL_OPTIONS = (): AutomaticScheduleOptions => ({
  startDate: todayLocalIso(),
  daysAhead: 30,
  workingDays: [1, 2, 3, 4, 5],
  visitsPerStaffPerDay: 4,
});

type Props = { onCreated: () => Promise<void> };

export default function AutomaticSchedulePanel({ onCreated }: Props) {
  const [options, setOptions] = useState<AutomaticScheduleOptions>(INITIAL_OPTIONS);
  const [preview, setPreview] = useState<AutomaticSchedulePreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateOptions(next: AutomaticScheduleOptions) {
    setOptions(next);
    setPreview(null);
    setError("");
    setSuccess("");
  }

  async function generateDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("preview");
    setError("");
    setSuccess("");
    try {
      const result = await previewAutomaticAppointmentSchedule(options);
      if (result.error || !result.preview) {
        setError(result.error ?? "Could not generate a schedule draft.");
        setPreview(null);
        return;
      }
      setPreview(result.preview);
    } catch {
      setError("Could not generate a schedule draft. Check your connection and try again.");
      setPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDraft() {
    if (!preview || preview.drafts.length === 0) return;
    setBusy("confirm");
    setError("");
    setSuccess("");
    try {
      const result = await confirmAutomaticAppointmentSchedule(options, preview.drafts, preview.snapshotToken);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(`${result.createdCount ?? 0} appointments created. Assigned staff and animal owners were notified in the app.`);
      setPreview(null);
      await onCreated();
    } catch {
      setError("Could not create the appointments. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function updateDraft(animalId: number, changes: Partial<AutomaticAppointmentDraft>) {
    if (!preview) return;
    setPreview({ ...preview, drafts: preview.drafts.map((draft) => draft.animalId === animalId ? { ...draft, ...changes } : draft) });
  }

  const slotLoads = new Map<string, number>();
  for (const draft of preview?.drafts ?? []) {
    const key = `${draft.scheduledDate}:${draft.assignedTo}`;
    slotLoads.set(key, (slotLoads.get(key) ?? 0) + 1);
  }
  const capacityExceeded = Array.from(slotLoads.values()).some((count) => count > options.visitsPerStaffPerDay);

  return (
    <section className="automatic-schedule-panel" aria-labelledby="automatic-schedule-title">
      <div className="automatic-schedule-heading">
        <div className="automatic-schedule-icon"><WandSparkles size={17} /></div>
        <div><h3 id="automatic-schedule-title">Automatic schedule draft</h3><p>Build and review appointments for animals due within the selected window.</p></div>
      </div>
      <form className="automatic-schedule-form" onSubmit={generateDraft}>
        <label>Start date<input type="date" min={todayLocalIso()} required disabled={busy !== null} value={options.startDate} onChange={(event) => updateOptions({ ...options, startDate: event.target.value })} /></label>
        <label>Scheduling window<select disabled={busy !== null} value={options.daysAhead} onChange={(event) => updateOptions({ ...options, daysAhead: Number(event.target.value) })}><option value={30}>Next 30 days</option><option value={60}>Next 60 days</option><option value={90}>Next 90 days</option></select></label>
        <label>Visits per staff per day<input type="number" min={1} max={12} required disabled={busy !== null} value={options.visitsPerStaffPerDay} onChange={(event) => updateOptions({ ...options, visitsPerStaffPerDay: Number(event.target.value) })} /></label>
        <fieldset className="automatic-schedule-weekdays"><legend>Working days</legend>{DAYS.map((day) => <label key={day.value}><input type="checkbox" disabled={busy !== null} checked={options.workingDays.includes(day.value)} onChange={() => updateOptions({ ...options, workingDays: options.workingDays.includes(day.value) ? options.workingDays.filter((value) => value !== day.value) : [...options.workingDays, day.value] })} /><span>{day.label}</span></label>)}</fieldset>
        <p className="automatic-schedule-note">Appointments are balanced across active admins and BHWs. The daily limit is a scheduling capacity setting; it does not track attendance.</p>
        <button className="primary-button" type="submit" disabled={busy !== null} data-loading={busy === "preview" ? "true" : undefined} aria-busy={busy === "preview"}>
          <CalendarDays size={15} /> {busy === "preview" ? "Building draft..." : "Generate schedule draft"}
        </button>
      </form>

      {error && <p className="automatic-schedule-message error" role="alert">{error}</p>}
      {success && <p className="automatic-schedule-message success" role="status"><CheckCircle2 size={16} /> {success}</p>}

      {preview && <div className="automatic-schedule-preview">
        <div className="automatic-schedule-summary" role="status">
          <span><strong>{preview.eligibleCount}</strong> due in window</span>
          <span><strong>{preview.alreadyScheduledCount}</strong> already scheduled</span>
          <span><strong>{preview.drafts.length}</strong> appointments drafted</span>
          {preview.unscheduledCount > 0 && <span className="automatic-schedule-unscheduled"><strong>{preview.unscheduledCount}</strong> need more capacity</span>}
        </div>
        {capacityExceeded && <p className="automatic-schedule-message error" role="alert">One or more staff assignments exceed the daily visit limit. Change the date or assigned staff before confirming.</p>}
        {preview.drafts.length > 0 ? <>
          <div className="automatic-schedule-table-wrap"><table className="automatic-schedule-table"><thead><tr><th>Animal / purok</th><th>Due date</th><th>Visit date</th><th>Assign to</th></tr></thead><tbody>
            {preview.drafts.map((draft) => <tr key={draft.animalId}>
              <td><strong>{draft.animalName}</strong><small>{draft.ownerName} · {draft.purok}</small></td>
              <td>{new Date(`${draft.dueDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td><select aria-label={`Visit date for ${draft.animalName}`} disabled={busy !== null} value={draft.scheduledDate} onChange={(event) => updateDraft(draft.animalId, { scheduledDate: event.target.value })}>{preview.availableDates.map((date) => <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</option>)}</select></td>
              <td><select aria-label={`Assigned staff for ${draft.animalName}`} disabled={busy !== null} value={draft.assignedTo} onChange={(event) => updateDraft(draft.animalId, { assignedTo: event.target.value })}>{preview.staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>)}</select></td>
            </tr>)}
          </tbody></table></div>
          <div className="automatic-schedule-confirm-row"><p>Older due dates are prioritized, same-purok visits are grouped where possible, and assignments are balanced across active staff. No attendance is tracked.</p><button type="button" className="primary-button" onClick={() => void confirmDraft()} disabled={busy !== null || capacityExceeded} data-loading={busy === "confirm" ? "true" : undefined} aria-busy={busy === "confirm"}>{busy === "confirm" ? "Creating appointments..." : `Confirm ${preview.drafts.length} appointments`}</button></div>
        </> : <p className="automatic-schedule-empty">No unscheduled animals are due within this window.</p>}
      </div>}
    </section>
  );
}
