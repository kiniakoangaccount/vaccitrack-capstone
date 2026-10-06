"use client";

import { useState } from "react";
import { Cat, CheckCircle2, Dog, MapPin, Plus, Syringe, X } from "lucide-react";
import { addVaccinationRecord } from "./vaccination-actions";
import { todayLocalIso } from "@/lib/dates";

export interface AnimalDetail {
  id: number | string;
  name: string;
  species: string;
  classification?: string;
  breed?: string;
  age?: number;
  sex?: string;
  color?: string;
  owner: string;
  contact: string;
  purok: string;
  impoundArea: string;
  vaccinated: boolean;
  status: string;
  nextDueDate: string | null;
  nextDue: string;
  vaccineType?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}

export interface VaccinationHistoryRow {
  id: number;
  vaccine_date: string;
  next_due_date: string | null;
  vaccine_type: string | null;
  administered_by: string | null;
  notes: string | null;
  created_at: string;
}

interface AnimalDetailPanelProps {
  animal: AnimalDetail;
  history: VaccinationHistoryRow[];
  vaccines: string[];
  canManage: boolean;
  onClose: () => void;
  onRecordAdded: () => void;
}

export default function AnimalDetailPanel({
  animal,
  history,
  vaccines,
  canManage,
  onClose,
  onRecordAdded,
}: AnimalDetailPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [vaccineDate, setVaccineDate] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [vaccineType, setVaccineType] = useState(vaccines[0] ?? "");
  const [administeredBy, setAdministeredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submitRecord() {
    setError("");
    if (!vaccineDate) {
      setError("Vaccination date is required.");
      return;
    }
    const todayIso = todayLocalIso();
    if (vaccineDate > todayIso) {
      setError("Vaccination date cannot be in the future.");
      return;
    }
    if (nextDueDate && vaccineDate && nextDueDate < vaccineDate) {
      setError("Next due date must be on or after the vaccination date.");
      return;
    }
    setIsSaving(true);
    const { error: err } = await addVaccinationRecord(Number(animal.id), {
      vaccineDate,
      nextDueDate: nextDueDate || undefined,
      vaccineType: vaccineType || undefined,
      administeredBy: administeredBy || undefined,
      notes: notes || undefined,
    });
    if (err) {
      setError(err);
      setIsSaving(false);
      return;
    }
    setSaved(true);
    setVaccineDate("");
    setNextDueDate("");
    setNotes("");
    setShowAddForm(false);
    setIsSaving(false);
    onRecordAdded();
    window.setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal animal-detail-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ANIMAL PROFILE</p>
            <h2>{animal.name}</h2>
          </div>
          <button className="icon-button" aria-label="Close animal profile" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="animal-detail-grid">
          <div className="animal-detail-info">
            <div className="animal-detail-avatar">
              <span>{animal.species === "Cat" ? <Cat size={20} /> : <Dog size={20} />}</span>
            </div>
            <div className="animal-detail-fields">
              <div><dt>Species</dt><dd>{animal.species}</dd></div>
              <div><dt>Classification</dt><dd>{animal.classification ?? "Pet"}</dd></div>
              <div><dt>Breed</dt><dd>{animal.breed ?? "—"}</dd></div>
              <div><dt>Sex</dt><dd>{animal.sex ?? "—"}</dd></div>
              <div><dt>Age</dt><dd>{animal.age !== undefined ? `${animal.age} yr${animal.age === 1 ? "" : "s"}` : "—"}</dd></div>
              <div><dt>Color / markings</dt><dd>{animal.color ?? "—"}</dd></div>
              <div><dt>Owner</dt><dd>{animal.owner}</dd></div>
              <div><dt>Contact</dt><dd>{animal.contact || "—"}</dd></div>
              <div><dt>Purok</dt><dd><MapPin size={12} /> {animal.purok}</dd></div>
              <div><dt>Impound area</dt><dd>{animal.impoundArea || "—"}</dd></div>
              <div><dt>GPS</dt><dd>{animal.latitude && animal.longitude ? `${Number(animal.latitude).toFixed(5)}, ${Number(animal.longitude).toFixed(5)}` : "—"}</dd></div>
              <div><dt>Vaccine type</dt><dd>{animal.vaccineType ?? "—"}</dd></div>
              <div><dt>Status</dt><dd><span className={`status ${animal.vaccinated ? "status-good" : animal.status === "Overdue" ? "status-danger" : "status-warn"}`}><i />{animal.status}</span></dd></div>
              <div><dt>Next due</dt><dd>{animal.nextDue}</dd></div>
            </div>
            {animal.notes && <p className="animal-detail-notes"><strong>Notes:</strong> {animal.notes}</p>}
          </div>

          <div className="animal-detail-history">
            <div className="animal-detail-history-head">
              <h3>Vaccination history</h3>
              {canManage && !showAddForm && (
                <button className="secondary-button" onClick={() => setShowAddForm(true)}>
                  <Plus size={14} /> Add booster
                </button>
              )}
            </div>

            {showAddForm && (
              <div className="booster-form">
                <label>Vaccination date
                  <input type="date" max={todayLocalIso()} value={vaccineDate} onChange={(e) => setVaccineDate(e.target.value)} />
                </label>
                <label>Next due date
                  <input type="date" min={vaccineDate || undefined} value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
                </label>
                <label>Vaccine type
                  <select value={vaccineType} onChange={(e) => setVaccineType(e.target.value)}>
                    {vaccines.map((v) => <option key={v} value={v}>{v}</option>)}
                    {!vaccines.includes(vaccineType) && vaccineType && <option value={vaccineType}>{vaccineType}</option>}
                  </select>
                </label>
                <label>Administered by
                  <input value={administeredBy} onChange={(e) => setAdministeredBy(e.target.value)} placeholder="e.g. Dr. Santos" />
                </label>
                <label className="booster-notes">Notes
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                </label>
                {error && <p className="form-error">{error}</p>}
                <div className="booster-actions">
                  <button className="secondary-button" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button className="primary-button" onClick={submitRecord} disabled={isSaving}>
                    <Syringe size={14} /> {isSaving ? "Saving..." : "Record vaccination"}
                  </button>
                </div>
              </div>
            )}

            {saved && <p className="module-muted"><CheckCircle2 size={15} /> Vaccination recorded successfully.</p>}

            {history.length === 0 ? (
              <p className="animal-detail-empty">No vaccination records yet.</p>
            ) : (
              <div className="vaccination-timeline">
                {history.map((h) => (
                  <div className="vaccination-entry" key={h.id}>
                    <span className="vaccination-dot" />
                    <div>
                      <strong>{h.vaccine_type ?? "Vaccination"}</strong>
                      <small>{new Date(`${h.vaccine_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</small>
                      {h.next_due_date && <small>Next due: {new Date(`${h.next_due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</small>}
                      {h.administered_by && <small>By: {h.administered_by}</small>}
                      {h.notes && <small className="vaccination-notes">{h.notes}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}