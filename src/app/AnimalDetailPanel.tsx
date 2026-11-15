"use client";

import { useState } from "react";
import { Cat, CheckCircle2, Dog, Edit2, MapPin, Plus, Save, Syringe, Trash2, X } from "lucide-react";
import { addVaccinationRecord } from "./vaccination-actions";
import { deleteAnimalRecord, updateAnimalRecord, type AnimalEditFields } from "./animal-actions";
import { todayLocalIso } from "@/lib/dates";
import ConfirmDialog from "./ConfirmDialog";

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
  vaccineDate?: string | null;
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
  onDeleted: () => void;
  onUpdated: (fields: AnimalEditFields) => void;
}

export default function AnimalDetailPanel({
  animal,
  history,
  vaccines,
  canManage,
  onClose,
  onRecordAdded,
  onDeleted,
  onUpdated,
}: AnimalDetailPanelProps) {
  const lastVaccinated = history[0]?.vaccine_date ?? animal.vaccineDate;
  const formattedLastVaccinated = lastVaccinated
    ? new Date(`${lastVaccinated}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "Not vaccinated";
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFields, setEditFields] = useState<AnimalEditFields>({
    name: animal.name,
    breed: animal.breed ?? "",
    age: animal.age !== undefined ? String(animal.age) : "",
    sex: animal.sex ?? "",
    color: animal.color ?? "",
    ownerName: animal.owner,
    contactNumber: animal.contact,
    impoundArea: animal.impoundArea,
    notes: animal.notes ?? "",
  });
  const [editError, setEditError] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function submitEdit() {
    setEditError("");
    if (!editFields.name.trim()) { setEditError("Animal name is required."); return; }
    if (!editFields.ownerName.trim()) { setEditError("Civilian / owner name is required."); return; }
    setIsEditSaving(true);
    const { error: err } = await updateAnimalRecord(Number(animal.id), editFields);
    setIsEditSaving(false);
    if (err) { setEditError(err); return; }
    onUpdated(editFields);
    setShowEditForm(false);
  }

  async function confirmDelete() {
    setDeleteError("");
    setIsDeleting(true);
    const { error: err } = await deleteAnimalRecord(Number(animal.id));
    setIsDeleting(false);
    if (err) { setDeleteError(err); return; }
    setShowDeleteConfirm(false);
    onDeleted();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal animal-detail-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ANIMAL PROFILE</p>
            <h2>{animal.name}</h2>
          </div>
          <div className="modal-heading-actions">
            {canManage && !showEditForm && !showDeleteConfirm && (
              <button className="icon-button" aria-label="Edit animal record" title="Edit record" onClick={() => setShowEditForm(true)}><Edit2 size={16} /></button>
            )}
            {canManage && !showEditForm && !showDeleteConfirm && (
              <button className="icon-button" aria-label="Delete animal record" title="Delete record" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} /></button>
            )}
            <button className="icon-button" aria-label="Close animal profile" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {!showEditForm && (
          <dl className="animal-vaccination-status">
            <div>
              <dt>Vaccination status</dt>
              <dd><span className={`status ${animal.vaccinated ? "status-good" : animal.status === "Overdue" ? "status-danger" : "status-warn"}`}><i />{animal.status}</span></dd>
            </div>
            <div>
              <dt>Last vaccinated</dt>
              <dd>{formattedLastVaccinated}</dd>
            </div>
            <div>
              <dt>Next vaccination</dt>
              <dd>{animal.nextDue}</dd>
            </div>
          </dl>
        )}

        <div className="animal-detail-grid">
          <div className="animal-detail-info">
            <div className="animal-detail-avatar">
              <span>{animal.species === "Cat" ? <Cat size={20} /> : <Dog size={20} />}</span>
            </div>
            {showEditForm ? (
              <div className="booster-form">
                <label>Animal name
                  <input value={editFields.name} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} />
                </label>
                <label>Breed
                  <input value={editFields.breed} onChange={(e) => setEditFields({ ...editFields, breed: e.target.value })} />
                </label>
                <label>Sex
                  <input value={editFields.sex} onChange={(e) => setEditFields({ ...editFields, sex: e.target.value })} />
                </label>
                <label>Age (months)
                  <input type="number" min="0" max="360" value={editFields.age} onChange={(e) => setEditFields({ ...editFields, age: e.target.value })} />
                </label>
                <label>Color / markings
                  <input value={editFields.color} onChange={(e) => setEditFields({ ...editFields, color: e.target.value })} />
                </label>
                <label>Civilian / owner name
                  <input value={editFields.ownerName} onChange={(e) => setEditFields({ ...editFields, ownerName: e.target.value })} />
                </label>
                <label>Contact number
                  <input value={editFields.contactNumber} onChange={(e) => setEditFields({ ...editFields, contactNumber: e.target.value })} />
                </label>
                <label>Impound area
                  <input value={editFields.impoundArea} onChange={(e) => setEditFields({ ...editFields, impoundArea: e.target.value })} />
                </label>
                <label className="booster-notes">Notes
                  <textarea rows={2} value={editFields.notes} onChange={(e) => setEditFields({ ...editFields, notes: e.target.value })} />
                </label>
                {editError && <p className="form-error">{editError}</p>}
                <div className="booster-actions">
                  <button className="secondary-button" onClick={() => setShowEditForm(false)} disabled={isEditSaving}>Cancel</button>
                  <button className="primary-button" onClick={submitEdit} disabled={isEditSaving}>
                    <Save size={14} /> {isEditSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="animal-detail-fields">
                  <div><dt>Species</dt><dd>{animal.species}</dd></div>
                  <div><dt>Classification</dt><dd>{animal.classification ?? "Pet"}</dd></div>
                  <div><dt>Breed</dt><dd>{animal.breed ?? "—"}</dd></div>
                  <div><dt>Sex</dt><dd>{animal.sex ?? "—"}</dd></div>
                  <div><dt>Age</dt><dd>{animal.age !== undefined ? `${animal.age} month${animal.age === 1 ? "" : "s"}` : "—"}</dd></div>
                  <div><dt>Color / markings</dt><dd>{animal.color ?? "—"}</dd></div>
                  <div><dt>Owner</dt><dd>{animal.owner}</dd></div>
                  <div><dt>Contact</dt><dd>{animal.contact || "—"}</dd></div>
                  <div><dt>Purok</dt><dd><MapPin size={12} /> {animal.purok}</dd></div>
                  <div><dt>Impound area</dt><dd>{animal.impoundArea || "—"}</dd></div>
                  <div><dt>GPS</dt><dd>{animal.latitude && animal.longitude ? `${Number(animal.latitude).toFixed(5)}, ${Number(animal.longitude).toFixed(5)}` : "—"}</dd></div>
                  <div><dt>Vaccine type</dt><dd>{animal.vaccinated ? animal.vaccineType || "—" : "N/A"}</dd></div>
                </div>
                {animal.notes && <p className="animal-detail-notes"><strong>Notes:</strong> {animal.notes}</p>}
              </>
            )}
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
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete animal record"
        message={deleteError || `Permanently delete ${animal.name}'s record, including its vaccination history? This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        busy={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteError(""); }}
      />
    </div>
  );
}