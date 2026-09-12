"use client";

import { useState } from "react";
import { CheckCircle2, MapPin, PawPrint, Plus, Syringe, Trash2 } from "lucide-react";
import { addPurok, deletePurok, addBreed, deleteBreed, addVaccine, deleteVaccine } from "./settings-actions";

export interface PurokRow {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface BreedRow {
  id: number;
  name: string;
  species: string;
}

export interface VaccineRow {
  id: number;
  name: string;
}

interface SettingsPanelProps {
  puroks: PurokRow[];
  breeds: BreedRow[];
  vaccines: VaccineRow[];
}

export default function SettingsPanel({ puroks, breeds, vaccines }: SettingsPanelProps) {
  const [newPurok, setNewPurok] = useState({ name: "", latitude: "", longitude: "" });
  const [newBreed, setNewBreed] = useState({ name: "", species: "Dog" });
  const [newVaccine, setNewVaccine] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleAddPurok() {
    setError("");
    if (!newPurok.name.trim() || !newPurok.latitude || !newPurok.longitude) {
      setError("Purok name, latitude, and longitude are required.");
      return;
    }
    setIsSaving(true);
    const { error: err } = await addPurok(newPurok.name.trim(), Number(newPurok.latitude), Number(newPurok.longitude));
    if (err) { setError(err); setIsSaving(false); return; }
    setNewPurok({ name: "", latitude: "", longitude: "" });
    setSaved("Purok added successfully.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  async function handleAddBreed() {
    setError("");
    if (!newBreed.name.trim()) { setError("Breed name is required."); return; }
    setIsSaving(true);
    const { error: err } = await addBreed(newBreed.name.trim(), newBreed.species);
    if (err) { setError(err); setIsSaving(false); return; }
    setNewBreed({ name: "", species: "Dog" });
    setSaved("Breed added successfully.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  async function handleAddVaccine() {
    setError("");
    if (!newVaccine.trim()) { setError("Vaccine name is required."); return; }
    setIsSaving(true);
    const { error: err } = await addVaccine(newVaccine.trim());
    if (err) { setError(err); setIsSaving(false); return; }
    setNewVaccine("");
    setSaved("Vaccine added successfully.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  async function handleDeletePurok(id: number) {
    setError("");
    setIsSaving(true);
    const { error: err } = await deletePurok(id);
    if (err) { setError(err); setIsSaving(false); return; }
    setSaved("Purok deleted.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  async function handleDeleteBreed(id: number) {
    setError("");
    setIsSaving(true);
    const { error: err } = await deleteBreed(id);
    if (err) { setError(err); setIsSaving(false); return; }
    setSaved("Breed deleted.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  async function handleDeleteVaccine(id: number) {
    setError("");
    setIsSaving(true);
    const { error: err } = await deleteVaccine(id);
    if (err) { setError(err); setIsSaving(false); return; }
    setSaved("Vaccine deleted.");
    setIsSaving(false);
    window.setTimeout(() => setSaved(""), 3000);
  }

  return (
    <div className="module-content">
      <div className="module-intro">
        <div>
          <p className="eyebrow">SYSTEM CONFIGURATION</p>
          <h2>Settings</h2>
          <p>Manage puroks, animal breeds, and vaccine types used across the system.</p>
        </div>
        <span className="module-chip"><MapPin size={14} /> Lookup tables</span>
      </div>

      {saved && <p className="module-muted"><CheckCircle2 size={15} /> {saved}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="settings-grid">
        {/* Puroks */}
        <div className="settings-section">
          <h3>Puroks</h3>
          <div className="settings-list">
            {puroks.map((p) => (
              <div className="settings-row" key={p.id}>
                <MapPin size={13} />
                <span><strong>{p.name}</strong><small>{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}</small></span>
                <button className="settings-delete" onClick={() => handleDeletePurok(p.id)} disabled={isSaving} title="Delete purok">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="settings-add-form">
            <input placeholder="Purok name" value={newPurok.name} onChange={(e) => setNewPurok({ ...newPurok, name: e.target.value })} />
            <input placeholder="Latitude" inputMode="decimal" value={newPurok.latitude} onChange={(e) => setNewPurok({ ...newPurok, latitude: e.target.value })} />
            <input placeholder="Longitude" inputMode="decimal" value={newPurok.longitude} onChange={(e) => setNewPurok({ ...newPurok, longitude: e.target.value })} />
            <button className="primary-button" onClick={handleAddPurok} disabled={isSaving}><Plus size={14} /> Add</button>
          </div>
        </div>

        {/* Breeds */}
        <div className="settings-section">
          <h3>Animal breeds</h3>
          <div className="settings-list">
            {breeds.map((b) => (
              <div className="settings-row" key={b.id}>
                <PawPrint size={13} />
                <span><strong>{b.name}</strong><small>{b.species}</small></span>
                <button className="settings-delete" onClick={() => handleDeleteBreed(b.id)} disabled={isSaving} title="Delete breed">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="settings-add-form">
            <input placeholder="Breed name" value={newBreed.name} onChange={(e) => setNewBreed({ ...newBreed, name: e.target.value })} />
            <select value={newBreed.species} onChange={(e) => setNewBreed({ ...newBreed, species: e.target.value })}>
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
            </select>
            <button className="primary-button" onClick={handleAddBreed} disabled={isSaving}><Plus size={14} /> Add</button>
          </div>
        </div>

        {/* Vaccines */}
        <div className="settings-section">
          <h3>Vaccine types</h3>
          <div className="settings-list">
            {vaccines.map((v) => (
              <div className="settings-row" key={v.id}>
                <Syringe size={13} />
                <span><strong>{v.name}</strong></span>
                <button className="settings-delete" onClick={() => handleDeleteVaccine(v.id)} disabled={isSaving} title="Delete vaccine">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="settings-add-form">
            <input placeholder="Vaccine name" value={newVaccine} onChange={(e) => setNewVaccine(e.target.value)} />
            <button className="primary-button" onClick={handleAddVaccine} disabled={isSaving}><Plus size={14} /> Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}