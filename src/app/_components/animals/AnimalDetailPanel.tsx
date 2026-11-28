"use client";

import { useState } from "react";
import Image from "next/image";
import { Cat, CheckCircle2, Dog, Edit2, MapPin, Plus, Save, Syringe, Trash2, X } from "lucide-react";
import { addVaccinationRecord } from "@/app/_features/animals/vaccination-actions";
import { deleteAnimalRecord, updateAnimalRecord, type AnimalEditFields } from "@/app/_features/animals/animal-actions";
import { addMonthsToDateIso, todayLocalIso } from "@/lib/dates";
import { capitalizeFirstLetter } from "@/lib/animal-names";
import ConfirmDialog from "@/app/_components/shared/ConfirmDialog";

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
  imageUrls?: string[];
  imageLoadError?: string;
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

function getImmunizationGroup(vaccineType: string | null, species: string): string {
  const name = (vaccineType ?? "").toLowerCase();
  if (/rabies|anti-rabies|rabisin|defensor|imrab/.test(name)) return "Rabies";
  if (species === "Dog") {
    if (/bordetella|kennel cough/.test(name)) return "Bordetella / kennel cough";
    if (/lepto/.test(name)) return "Leptospirosis";
    if (/distemper|parvovirus|adenovirus|hepatitis|parainfluenza|dhpp|dhlpp|core/.test(name)) return "Canine core vaccines";
  } else {
    if (/leukemia|felv/.test(name)) return "Feline leukemia (FeLV)";
    if (/rhinotracheitis|calicivirus|panleukopenia|fvrcp|rcp|core/.test(name)) return "Feline core vaccines (FVRCP)";
  }
  return "Other immunizations";
}

interface AnimalDetailPanelProps {
  animal: AnimalDetail;
  history: VaccinationHistoryRow[];
  vaccines: string[];
  canManage: boolean;
  onClose: () => void;
  onRecordAdded: () => void;
  onDeleted: (warning?: string) => void;
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
  const vaccineOptionsByGroup = vaccines.reduce<Record<string, string[]>>((groups, vaccine) => {
    const groupName = getImmunizationGroup(vaccine, animal.species);
    groups[groupName] = [...(groups[groupName] ?? []), vaccine];
    return groups;
  }, {});
  const immunizationGroups = history.reduce<Record<string, { record: VaccinationHistoryRow; shotNumber: number }[]>>((groups, record) => {
    const vaccineName = record.vaccine_type ?? "Other / not specified";
    const groupName = getImmunizationGroup(record.vaccine_type, animal.species);
    const entries = groups[groupName] ?? [];
    const earlierEntries = entries.filter((entry) => (entry.record.vaccine_type ?? "Other / not specified") === vaccineName).length;
    const totalShots = history.filter((entry) => (entry.vaccine_type ?? "Other / not specified") === vaccineName).length;
    const shotNumber = totalShots - earlierEntries;
    groups[groupName] = [...entries, { record, shotNumber }];
    return groups;
  }, {});
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
    const updatedFields = { ...editFields, name: capitalizeFirstLetter(editFields.name.trim()) };
    setIsEditSaving(true);
    const { error: err } = await updateAnimalRecord(Number(animal.id), updatedFields);
    setIsEditSaving(false);
    if (err) { setEditError(err); return; }
    onUpdated(updatedFields);
    setShowEditForm(false);
  }

  async function confirmDelete() {
    setDeleteError("");
    setIsDeleting(true);
    const { error: err, warning } = await deleteAnimalRecord(Number(animal.id));
    setIsDeleting(false);
    if (err) { setDeleteError(err); return; }
    setShowDeleteConfirm(false);
    onDeleted(warning);
  }

  return (
    <div className="modal-backdrop animal-detail-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
          <>
            <dl className="animal-vaccination-status">
              <div>
                <dt>Vaccination status</dt>
                <dd><span className={`status ${animal.status === "Vaccinated" ? "status-good" : animal.status === "Expired" ? "status-overdue" : animal.status === "Due soon" ? "status-warn" : "status-neutral"}`}><i />{animal.status}</span></dd>
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
            <section className="animal-identification-photos">
              <h3>Pet photos for identification</h3>
              <p>These photos help owners and BHW recognize this pet.</p>
              {animal.imageUrls?.length ? (
                <div className="animal-photo-gallery">
                  {animal.imageUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><Image src={url} alt={`${animal.name} identification photo ${index + 1}`} width={110} height={110} unoptimized /></a>)}
                </div>
              ) : <p>{animal.imageLoadError ?? "No identification photos have been added."}</p>}
              {animal.imageUrls?.length && animal.imageLoadError ? <p>{animal.imageLoadError}</p> : null}
            </section>
          </>
        )}

        <div className="animal-detail-grid">
          <div className="animal-detail-info">
            <div className="animal-detail-avatar">
              <span>{animal.species === "Cat" ? <Cat size={20} /> : <Dog size={20} />}</span>
            </div>
            {showEditForm ? (
              <div className="booster-form">
                <label>Animal name
                  <input value={editFields.name} onChange={(e) => setEditFields({ ...editFields, name: capitalizeFirstLetter(e.target.value) })} />
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
                  <button className="primary-button" onClick={submitEdit} disabled={isEditSaving} data-loading={isEditSaving ? "true" : undefined} aria-busy={isEditSaving}>
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
                  <input type="date" max={todayLocalIso()} value={vaccineDate} onChange={(e) => { const date = e.target.value; setVaccineDate(date); setNextDueDate(date ? addMonthsToDateIso(date, 12) : ""); }} />
                </label>
                <label>Next due date
                  <input type="date" min={vaccineDate || undefined} value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
                </label>
                <label>Vaccine type
                  <select value={vaccineType} onChange={(e) => setVaccineType(e.target.value)}>
                    {Object.entries(vaccineOptionsByGroup).map(([groupName, options]) => <optgroup key={groupName} label={groupName}>{options.map((v) => <option key={v} value={v}>{v}</option>)}</optgroup>)}
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
                  <button className="primary-button" onClick={submitRecord} disabled={isSaving} data-loading={isSaving ? "true" : undefined} aria-busy={isSaving}>
                    <Syringe size={14} /> {isSaving ? "Saving..." : "Record vaccination"}
                  </button>
                </div>
              </div>
            )}

            {saved && <p className="module-muted"><CheckCircle2 size={15} /> Vaccination recorded successfully.</p>}

            <p className="animal-immunization-intro">Recorded immunization types and shots for this {animal.species.toLowerCase()}. Add each vaccine dose as a separate history entry.</p>
            {history.length === 0 ? (
              <p className="animal-detail-empty">No vaccination records yet.</p>
            ) : (
              <div className="vaccination-timeline">
                {Object.entries(immunizationGroups).map(([groupName, entries]) => (
                  <section className="immunization-group" key={groupName}>
                    <h4>{groupName}</h4>
                    {entries.map(({ record: h, shotNumber }) => (
                      <div className="vaccination-entry" key={h.id}>
                        <span className="vaccination-dot" />
                        <div>
                          <strong>{h.vaccine_type ?? "Other / not specified"}</strong>
                          <small>Recorded dose {shotNumber} · {new Date(`${h.vaccine_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</small>
                          {h.next_due_date && <small>Next due: {new Date(`${h.next_due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</small>}
                          {h.administered_by && <small>Administered by: {h.administered_by}</small>}
                          {h.notes && <small className="vaccination-notes">{h.notes}</small>}
                        </div>
                      </div>
                    ))}
                  </section>
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
