"use client";

import { useState, useTransition } from "react";
import { MapPin, Pencil, Save, Trash2, X } from "lucide-react";
import type { ManagedPurok } from "./purok-actions";
import { deleteSuperAdminPurok, saveSuperAdminPurok } from "./purok-actions";

export default function PuroksPanel({ initialPuroks }: { initialPuroks: ManagedPurok[] }) {
  const [puroks, setPuroks] = useState(initialPuroks);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setEditingId(null);
    setName("");
    setLatitude("");
    setLongitude("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await saveSuperAdminPurok({
        id: editingId,
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });
      if (result.error || !result.row) { setError(result.error ?? "Could not save this purok."); return; }
      setPuroks((current) => editingId
        ? current.map((purok) => purok.id === result.row!.id ? result.row! : purok).sort((a, b) => a.name.localeCompare(b.name))
        : [...current, result.row!].sort((a, b) => a.name.localeCompare(b.name)));
      setNotice(`Purok “${result.row.name}” saved. The workspace reports will refresh from this data.`);
      resetForm();
    });
  }

  function remove(id: number) {
    const target = puroks.find((purok) => purok.id === id);
    if (!target || !window.confirm(`Remove ${target.name}? Animal records assigned to this purok may prevent deletion.`)) return;
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await deleteSuperAdminPurok(id);
      if (result.error) { setError(result.error); return; }
      setPuroks((current) => current.filter((purok) => purok.id !== id));
      setNotice(`Purok “${target.name}” removed. The workspace reports will refresh from this data.`);
      if (editingId === id) resetForm();
    });
  }

  return (
    <div className="admin-puroks-panel">
      <section className="admin-info-card" style={{ marginBottom: 18 }}>
        <div className="admin-info-head"><MapPin size={16} /><span>{editingId ? "Edit purok" : "Add a purok"}</span></div>
        <p className="admin-muted">Purok names and coordinates feed the registry map and coverage reports.</p>
        <form className="admin-purok-form" onSubmit={submit}>
          <label>Name<input className="admin-form-select" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Latitude<input className="admin-form-select" type="number" min="-90" max="90" step="any" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label>Longitude<input className="admin-form-select" type="number" min="-180" max="180" step="any" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
          <div className="admin-row-actions">
            <button className="admin-btn-primary" type="submit" disabled={pending || !name.trim() || !latitude || !longitude}><Save size={14} />{pending ? "Saving…" : editingId ? "Save changes" : "Add purok"}</button>
            {editingId !== null && <button className="admin-btn-secondary" type="button" onClick={resetForm} disabled={pending}><X size={14} />Cancel</button>}
          </div>
        </form>
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        {notice && <p className="admin-muted" role="status" aria-live="polite">{notice}</p>}
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Purok</th><th>Latitude</th><th>Longitude</th><th>Actions</th></tr></thead>
          <tbody>
            {puroks.length === 0 ? <tr><td colSpan={4} className="admin-table-empty">No puroks are configured.</td></tr> : puroks.map((purok) => (
              <tr key={purok.id} className="admin-table-row">
                <td>{purok.name}</td><td>{purok.latitude}</td><td>{purok.longitude}</td>
                <td><div className="admin-row-actions">
                  <button type="button" className="admin-action-btn" title={`Edit ${purok.name}`} aria-label={`Edit ${purok.name}`} disabled={pending} onClick={() => { setEditingId(purok.id); setName(purok.name); setLatitude(String(purok.latitude)); setLongitude(String(purok.longitude)); setError(""); setNotice(""); }}><Pencil size={14} /></button>
                  <button type="button" className="admin-action-btn admin-action-delete" title={`Remove ${purok.name}`} aria-label={`Remove ${purok.name}`} disabled={pending} onClick={() => remove(purok.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
