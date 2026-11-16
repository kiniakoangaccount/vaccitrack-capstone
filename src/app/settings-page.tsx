"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { ShieldCheck, Bell, ChevronDown, Settings as SettingsIcon, Trash2, Edit2, MapPin, Save, Menu, X, ArrowLeft } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import WorkspaceLoadingScreen from "./WorkspaceLoadingScreen";

function initials(fullName: string) {
  return fullName.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "VT";
}

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [profile, setProfile] = useState({ fullName: "", username: "" });

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(async (result: { data: { user: SupabaseUser | null } }) => {
      const user = result.data.user;
      if (!user) { router.replace("/signin"); return; }
      setCheckingAuth(false);
      const { data } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle();
      setProfile({ fullName: data?.full_name ?? "", username: data?.username ?? "" });
    });
  }, [supabase, router]);

  if (checkingAuth) {
    return <WorkspaceLoadingScreen title="Checking your session" description="Loading workspace settings." />;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania <ChevronDown size={15} /></div>
        <div className={`data-mode ${supabase ? "live" : "demo"}`}><span /> {supabase ? "Connected to Supabase" : "Demo mode"}</div>
        <button className="sidebar-close" aria-label="Close navigation" onClick={() => setShowMobileNav(false)}><X size={18} /></button>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Management</p>
          <Link href="/" className="nav-item"><Bell size={17} /> My account</Link>
          <Link href="/profile" className="nav-item"><SettingsIcon size={17} /> Account settings</Link>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">{initials(profile.fullName)}</span><span><strong>{profile.fullName || "VacciTrack user"}</strong><small>{profile.username ? `@${profile.username}` : "No username set"}</small></span><ChevronDown size={15} /></div></div>
      </aside>
      {showMobileNav && <div className="sidebar-backdrop" onClick={() => setShowMobileNav(false)} />}

      <section className="content-area">
        <header className="topbar"><div className="topbar-left"><button className="icon-button" aria-label="Back" onClick={() => window.history.back()}><ArrowLeft size={18} /></button><button className="icon-button mobile-nav-toggle" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button><div className="crumb">Settings <span>/</span> Lookup tables</div></div></header>

        <div className="page-content">
          <div className="page-heading">
            <p className="eyebrow">LOOKUP TABLES</p>
            <h1>Puroks and vaccines</h1>
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

function PurokManager() {
  const supabase = createClient();
  const [puroks, setPuroks] = useState<{ id: number; name: string; latitude: string; longitude: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "" });
  const [editing, setEditing] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

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
    setRemoving(true);
    const { error } = await supabase.from("puroks").delete().eq("id", id);
    setRemoving(false);
    if (error) { setError(error.message); setRemoveTarget(null); return; }
    setPuroks((prev) => prev.filter((p) => p.id !== id));
    setError("");
    setRemoveTarget(null);
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
              <button className="icon-button" title="Remove" onClick={() => setRemoveTarget({ id: p.id, name: p.name })}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove purok"
        message={`Remove "${removeTarget?.name}"? Animal records referencing it will become unassigned.`}
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={() => removeTarget && remove(removeTarget.id)}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
function VaccineManager() {
  const supabase = createClient();
  const [vaccines, setVaccines] = useState<{ id: number; name: string; species: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", species: "Both" });
  const [editing, setEditing] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("vaccines").select("id, name, species").order("name");
    setVaccines(((data ?? []) as { id: number; name: string; species: string | null }[]).map((v) => ({ ...v, species: v.species ?? "Both" })));
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
    const payload = { name: form.name.trim(), species: form.species };
    if (editing) {
      const { error } = await supabase.from("vaccines").update(payload).eq("id", editing);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("vaccines").insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setForm({ name: "", species: "Both" });
    setEditing(null);
    if (editing) {
      setVaccines((prev) => prev.map((v) => (v.id === editing ? { ...v, ...payload } : v)));
    } else {
      setVaccines((prev) => [...prev, { ...payload, id: 0 }]);
    }
  };

  const remove = async (id: number) => {
    if (!supabase) return;
    setRemoving(true);
    const { error } = await supabase.from("vaccines").delete().eq("id", id);
    setRemoving(false);
    if (error) { setError(error.message); setRemoveTarget(null); return; }
    setVaccines((prev) => prev.filter((v) => v.id !== id));
    setError("");
    setRemoveTarget(null);
  };

  return (
    <div>
      <form className="settings-form" onSubmit={submit}>
        <div className="settings-grid-2">
          <input className="account-input" placeholder="Vaccine name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="account-input" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
            <option value="Both">Dog &amp; Cat</option>
            <option value="Dog">Dog only</option>
            <option value="Cat">Cat only</option>
          </select>
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="submit" disabled={saving || !form.name.trim()}><Save size={14} /> {editing ? "Update" : "Add"} vaccine</button>
          {editing && <button className="secondary-button" type="button" onClick={() => { setEditing(null); setForm({ name: "", species: "Both" }); }}>Cancel</button>}
        </div>
      </form>
      {error && <div className="notice danger"><Trash2 size={14} /><span>{error}</span></div>}
      <ul className="settings-list">
        {loading ? <li className="settings-empty-row">Loading…</li> : vaccines.length === 0 ? <li className="settings-empty-row">No vaccines yet.</li> : vaccines.map((v) => (
          <li key={v.id} className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-name">{v.name}</span>
              <span className="settings-row-meta"><span className="settings-species-tag" data-species={v.species.toLowerCase()}>{v.species === "Both" ? "Dog & Cat" : v.species}</span></span>
            </div>
            <div className="settings-row-actions">
              <button className="icon-button" title="Edit" onClick={() => { setEditing(v.id); setForm({ name: v.name, species: v.species }); }}><Edit2 size={13} /></button>
              <button className="icon-button" title="Remove" onClick={() => setRemoveTarget({ id: v.id, name: v.name })}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove vaccine"
        message={`Remove "${removeTarget?.name}" from the vaccine list?`}
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={() => removeTarget && remove(removeTarget.id)}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

