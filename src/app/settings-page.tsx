"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ShieldCheck, Bell, ChevronDown, Settings as SettingsIcon, Trash2, Edit2, MapPin, Save } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania <ChevronDown size={15} /></div>
        <div className={`data-mode ${supabase ? "live" : "demo"}`}><span /> {supabase ? "Connected to Supabase" : "Demo mode"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Management</p>
          <Link href="/" className="nav-item"><Bell size={17} /> My account</Link>
          <Link href="/profile" className="nav-item"><SettingsIcon size={17} /> Account settings</Link>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">UP</span><span><strong>VacciTrack user</strong><small>Demo account</small></span><ChevronDown size={15} /></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="crumb">Settings <span>/</span> Lookup tables</div><div className="top-actions"><button className="icon-button" aria-label="Back" onClick={() => window.history.back()}><ChevronDown size={18} /></button></div></header>

        <div className="page-content">
          <div className="page-heading">
            <p className="eyebrow">LOOKUP TABLES</p>
            <h1>Puroks, breeds, and vaccines</h1>
            <p className="heading-sub">Manage the shared lists used across the registry and planning tools.</p>
          </div>

          <div className="settings-page">
            <section className="settings-section">
              <div className="settings-card">
                <div className="settings-head">
                  <h2>Purok areas</h2>
                  <p>Geographic pin areas used to group animal records on the map and planning views.</p>
                </div>
                {supabase ? <PurokManager /> : <div className="settings-empty"><MapPin size={24} /><p>Supabase is not configured, so lookup tables are managed from the database directly.</p></div>}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-card">
                <div className="settings-head">
                  <h2>Animal breeds</h2>
                  <p>Breed options grouped by species. Used in the animal registration form.</p>
                </div>
                {supabase ? <BreedManager /> : <div className="settings-empty"><Edit2 size={24} /><p>Supabase is not configured, so breeds are only available as demo values in the registry.</p></div>}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-card">
                <div className="settings-head">
                  <h2>Vaccines</h2>
                  <p>Available vaccine types for dropdown selection in vaccination records.</p>
                </div>
                {supabase ? <VaccineManager /> : <div className="settings-empty"><Save size={24} /><p>Supabase is not configured, so vaccines are available as a small demo list for registration.</p></div>}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function BreedManager() {
  const supabase = createClient();
  const [breeds, setBreeds] = useState<{ id: number; name: string; species: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", species: "Dog" });
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("breeds").select("id, name, species").order("species, name");
    setBreeds(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setSaving(true);
    const payload = { name: form.name.trim(), species: form.species };
    if (editing) {
      const { error } = await supabase.from("breeds").update(payload).eq("id", editing);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("breeds").insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setForm({ name: "", species: "Dog" });
    setEditing(null);
    if (editing) {
      setBreeds((prev) => prev.map((b) => (b.id === editing ? { ...b, ...payload } : b)));
    } else {
      setBreeds((prev) => [...prev, { ...payload, id: 0 }]);
    }
  };

  const remove = async (id: number) => {
    if (!supabase) return;
    if (!confirm("Remove this breed?")) return;
    const { error } = await supabase.from("breeds").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setBreeds((prev) => prev.filter((b) => b.id !== id));
    setError("");
  };

  return (
    <div>
      <form className="settings-form" onSubmit={submit}>
        <div className="settings-grid-2">
          <input className="account-input" placeholder="Breed name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="account-input" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
            <option>Dog</option>
            <option>Cat</option>
          </select>
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="submit" disabled={saving || !form.name.trim()}><Save size={14} /> {editing ? "Update" : "Add"} breed</button>
          {editing && <button className="secondary-button" type="button" onClick={() => { setEditing(null); setForm({ name: "", species: "Dog" }); }}>Cancel</button>}
        </div>
      </form>
      {error && <div className="notice danger"><Trash2 size={14} /><span>{error}</span></div>}
      <ul className="settings-list">
        {loading ? <li className="settings-empty-row">Loading…</li> : breeds.length === 0 ? <li className="settings-empty-row">No breeds yet.</li> : breeds.map((b) => (
          <li key={b.id} className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-name">{b.name}</span>
              <span className="settings-row-meta"><span className="settings-species-tag" data-species={b.species.toLowerCase()}>{b.species}</span></span>
            </div>
            <div className="settings-row-actions">
              <button className="icon-button" title="Edit" onClick={() => { setEditing(b.id); setForm({ name: b.name, species: b.species }); }}><Edit2 size={13} /></button>
              <button className="icon-button" title="Remove" onClick={() => remove(b.id)}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PurokManager() {
  const supabase = createClient();
  const [puroks, setPuroks] = useState<{ id: number; name: string; latitude: string; longitude: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "" });
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("puroks").select("id, name, latitude, longitude").order("name");
    setPuroks(((data ?? []) as { id: number; name: string | null; latitude: number | null; longitude: number | null }[]).map((r) => ({ id: r.id, name: r.name ?? "", latitude: String(r.latitude ?? ""), longitude: String(r.longitude ?? "") })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    };
    if (editing) {
      const { error } = await supabase.from("puroks").update(payload).eq("id", editing);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("puroks").insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setForm({ name: "", latitude: "", longitude: "" });
    setEditing(null);
    setPuroks((prev) => editing ? prev.map((p) => p.id === editing ? { ...p, ...payload, latitude: String(payload.latitude), longitude: String(payload.longitude) } : p) : [...prev, { ...payload, latitude: String(payload.latitude), longitude: String(payload.longitude), id: 0 }]);
  };

  const remove = async (id: number) => {
    if (!supabase) return;
    if (!confirm("Remove this purok? Animal records referencing it will become unassigned.")) return;
    const { error } = await supabase.from("puroks").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setPuroks((prev) => prev.filter((p) => p.id !== id));
    setError("");
  };

  return (
    <div>
      <form className="settings-form" onSubmit={submit}>
        <input className="account-input" placeholder="Purok name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <div className="settings-coords">
          <input className="account-input" placeholder="Latitude (optional)" inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          <input className="account-input" placeholder="Longitude (optional)" inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="submit" disabled={saving || !form.name.trim()}><Save size={14} /> {editing ? "Update" : "Add"} purok</button>
          {editing && <button className="secondary-button" type="button" onClick={() => { setEditing(null); setForm({ name: "", latitude: "", longitude: "" }); }}>Cancel</button>}
        </div>
      </form>
      {error && <div className="notice danger"><Trash2 size={14} /><span>{error}</span></div>}
      <ul className="settings-list">
        {loading ? <li className="settings-empty-row">Loading…</li> : puroks.length === 0 ? <li className="settings-empty-row">No puroks yet.</li> : puroks.map((p) => (
          <li key={p.id} className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-name">{p.name}</span>
              {p.latitude || p.longitude ? <span className="settings-row-meta"><span className="settings-dot" />{p.latitude ? `${p.latitude}, ` : ""}{p.longitude || ""}</span> : null}
            </div>
            <div className="settings-row-actions">
              <button className="icon-button" title="Edit" onClick={() => { setEditing(p.id); setForm({ name: p.name, latitude: p.latitude, longitude: p.longitude }); }}><Edit2 size={13} /></button>
              <button className="icon-button" title="Remove" onClick={() => remove(p.id)}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function VaccineManager() {
  const supabase = createClient();
  const [vaccines, setVaccines] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "" });
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("vaccines").select("id, name").order("name");
    setVaccines(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!form.name.trim()) return;
    setError("");
    setSaving(true);
    const payload = { name: form.name.trim() };
    if (editing) {
      const { error } = await supabase.from("vaccines").update(payload).eq("id", editing);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("vaccines").insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setForm({ name: "" });
    setEditing(null);
    if (editing) {
      setVaccines((prev) => prev.map((v) => (v.id === editing ? { ...v, ...payload } : v)));
    } else {
      setVaccines((prev) => [...prev, { ...payload, id: 0 }]);
    }
  };

  const remove = async (id: number) => {
    if (!supabase) return;
    if (!confirm("Remove this vaccine?")) return;
    const { error } = await supabase.from("vaccines").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setVaccines((prev) => prev.filter((v) => v.id !== id));
    setError("");
  };

  return (
    <div>
      <form className="settings-form" onSubmit={submit}>
        <input className="account-input" placeholder="Vaccine name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <div className="settings-actions">
          <button className="primary-button" type="submit" disabled={saving || !form.name.trim()}><Save size={14} /> {editing ? "Update" : "Add"} vaccine</button>
          {editing && <button className="secondary-button" type="button" onClick={() => { setEditing(null); setForm({ name: "" }); }}>Cancel</button>}
        </div>
      </form>
      {error && <div className="notice danger"><Trash2 size={14} /><span>{error}</span></div>}
      <ul className="settings-list">
        {loading ? <li className="settings-empty-row">Loading…</li> : vaccines.length === 0 ? <li className="settings-empty-row">No vaccines yet.</li> : vaccines.map((v) => (
          <li key={v.id} className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-name">{v.name}</span>
            </div>
            <div className="settings-row-actions">
              <button className="icon-button" title="Edit" onClick={() => { setEditing(v.id); setForm({ name: v.name }); }}><Edit2 size={13} /></button>
              <button className="icon-button" title="Remove" onClick={() => remove(v.id)}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

