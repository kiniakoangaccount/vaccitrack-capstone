"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  Bell,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  MapPin,
  MessageSquare,
  PawPrint,
  Plus,
  Search,
  ShieldCheck,
  Syringe,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type Animal = {
  id: number | string;
  name: string;
  species: "Dog" | "Cat";
  owner: string;
  purok: string;
  vaccinated: boolean;
  status: "Vaccinated" | "Due soon" | "Overdue" | "Not scheduled";
  nextDueDate: string | null;
  nextDue: string;
};

type SupabaseAnimalRecord = {
  id: number;
  name: string;
  species: Animal["species"];
  owner_name: string;
  vaccinated: boolean;
  next_due_date: string | null;
  puroks: { name: string } | { name: string }[] | null;
};

type DashboardStats = { registered: number; vaccinated: number; dueSoon: number; overdue: number };
type WorkspaceTab = "Overview" | "Registry" | "Planning" | "Risk" | "Map" | "Feedback";

type SupabaseError = { code?: string; message: string };
type SupabaseAuthResponse = { data: { user: { id: string; email?: string } | null }; error: SupabaseError | null };

const animals: Animal[] = [
  { id: "demo-bantay", name: "Bantay", species: "Dog", owner: "Ramon Dela Cruz", purok: "The Palisades", vaccinated: true, status: "Vaccinated", nextDueDate: "2026-10-18", nextDue: "Oct 18, 2026" },
  { id: "demo-miming", name: "Miming", species: "Cat", owner: "Liza Santos", purok: "Bagong Silang North", vaccinated: true, status: "Due soon", nextDueDate: "2026-09-23", nextDue: "Sep 23, 2026" },
  { id: "demo-brownie", name: "Brownie", species: "Dog", owner: "Joel Mercado", purok: "Zamora Street", vaccinated: false, status: "Overdue", nextDueDate: "2026-08-30", nextDue: "Aug 30, 2026" },
  { id: "demo-luna", name: "Luna", species: "Dog", owner: "Ana Villareal", purok: "Celine Homes East", vaccinated: true, status: "Vaccinated", nextDueDate: "2026-11-04", nextDue: "Nov 04, 2026" },
  { id: "demo-toby", name: "Toby", species: "Dog", owner: "Mark Flores", purok: "The Palisades", vaccinated: true, status: "Due soon", nextDueDate: "2026-09-27", nextDue: "Sep 27, 2026" },
];

const demoPuroks = ["The Palisades", "Bagong Silang North", "Celine Homes East", "Bagong Silang South", "Zamora Street", "Celine Homes West"];

const statusStyles: Record<Animal["status"], string> = {
  Vaccinated: "status-good",
  "Due soon": "status-warn",
  Overdue: "status-danger",
  "Not scheduled": "status-warn",
};

function getAnimalStatus(vaccinated: boolean, nextDueDate: string | null, today = new Date()): Animal["status"] {
  if (!nextDueDate) return vaccinated ? "Vaccinated" : "Not scheduled";

  const dueDate = new Date(`${nextDueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return vaccinated ? "Vaccinated" : "Not scheduled";

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000);
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 30) return "Due soon";
  return "Vaccinated";
}

function formatDueDate(nextDueDate: string | null) {
  if (!nextDueDate) return "Not scheduled";
  return new Date(`${nextDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export default function Home() {
  const [animalRecords, setAnimalRecords] = useState(animals);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Overview");
  const [showNotice, setShowNotice] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [authUser, setAuthUser] = useState<{ id: string; email: string; fullName: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [form, setForm] = useState({ name: "", species: "Dog" as Animal["species"], owner: "", purok: demoPuroks[0], vaccineDate: "", nextDue: "" });
  const [liveStats, setLiveStats] = useState<DashboardStats | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const supabaseConfigured = Boolean(createClient());
  const canManageAnimals = !isLive || ["admin", "veterinarian", "bhw"].includes(authUser?.role ?? "");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    let mounted = true;
    void supabase.auth.getUser().then(async ({ data: { user }, error }: SupabaseAuthResponse) => {
      if (!mounted) return;
      if (error || !user) {
        setAuthChecked(true);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
      if (!mounted) return;
      setAuthUser({ id: user.id, email: user.email ?? "", fullName: profile?.full_name ?? user.email ?? "Fieldwatch user", role: profile?.role ?? "viewer" });
      setAuthChecked(true);

      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const [recentResult, totalResult, vaccinatedResult, dueResult, overdueResult] = await Promise.all([
        supabase.from("animals").select("id, name, species, owner_name, vaccinated, next_due_date, puroks(name)").order("created_at", { ascending: false }).limit(25),
        supabase.from("animals").select("id", { count: "exact", head: true }),
        supabase.from("animals").select("id", { count: "exact", head: true }).eq("vaccinated", true),
        supabase.from("animals").select("id", { count: "exact", head: true }).gte("next_due_date", todayIso).lte("next_due_date", new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("animals").select("id", { count: "exact", head: true }).lt("next_due_date", todayIso),
      ]);
      if (!mounted) return;
      if (recentResult.error) {
        setLoadError("Supabase could not load the registry.");
        return;
      }

      const records = ((recentResult.data ?? []) as SupabaseAnimalRecord[]).map((record) => {
          const nextDueDate = record.next_due_date ?? null;
          const vaccinated = Boolean(record.vaccinated);
          return {
            id: record.id,
            name: record.name,
            species: record.species,
            owner: record.owner_name,
            vaccinated,
            purok: Array.isArray(record.puroks) ? record.puroks[0]?.name ?? "Unassigned" : record.puroks?.name ?? "Unassigned",
            status: getAnimalStatus(vaccinated, nextDueDate, today),
            nextDueDate,
            nextDue: formatDueDate(nextDueDate),
          } satisfies Animal;
        });
      setAnimalRecords(records);
      setLiveStats({ registered: totalResult.count ?? 0, vaccinated: vaccinatedResult.count ?? 0, dueSoon: dueResult.count ?? 0, overdue: overdueResult.count ?? 0 });
      setIsLive(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword(authForm);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setAuthError("Confirm your email in Supabase Authentication first, then try again.");
      } else if (error.message.toLowerCase().includes("invalid login credentials")) {
        setAuthError("The email or password is incorrect.");
      } else if (error.message.toLowerCase().includes("fetch") || error.message.toLowerCase().includes("network")) {
        setAuthError("The deployed app cannot reach Supabase. Check the Vercel Project URL and Publishable key, then redeploy.");
      } else {
        console.error("Supabase sign-in failed", { code: error.code, status: error.status, message: error.message });
        setAuthError(`Supabase sign-in error${error.code ? ` (${error.code})` : ""}: ${error.message}`);
      }
      return;
    }
    window.location.reload();
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
  }

  const filteredAnimals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return animalRecords;
    return animalRecords.filter((animal) =>
      [animal.name, animal.owner, animal.purok, animal.species].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [animalRecords, query]);

  const dashboardStats = useMemo(() => {
    if (!isLive) return { registered: 128, vaccinated: 92, dueSoon: 18, overdue: 9 };
    if (liveStats) return liveStats;
    return {
      registered: animalRecords.length,
      vaccinated: animalRecords.filter((animal) => animal.vaccinated).length,
      dueSoon: animalRecords.filter((animal) => animal.status === "Due soon").length,
      overdue: animalRecords.filter((animal) => animal.status === "Overdue").length,
    };
  }, [animalRecords, isLive]);

  const riskRows = useMemo(() => demoPuroks.map((purok) => {
    const records = animalRecords.filter((animal) => animal.purok === purok);
    const vaccinated = records.filter((animal) => animal.vaccinated).length;
    const rate = records.length ? Math.round((vaccinated / records.length) * 100) : 0;
    return { purok, total: records.length, vaccinated, rate, risk: records.length === 0 ? "NO DATA" : rate < 50 ? "HIGH" : rate < 70 ? "MODERATE" : "LOW" };
  }), [animalRecords]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackMessage.trim()) return;
    const supabase = createClient();
    if (supabase && authUser) {
      const { error } = await supabase.from("feedback").insert({ user_id: authUser.id, name: authUser.fullName, category: "Suggestion", message: feedbackMessage.trim() });
      if (error) {
        setLoadError("Feedback could not be submitted. Please try again.");
        return;
      }
    }
    setFeedbackSent(true);
    setFeedbackMessage("");
  }
  
  if (supabaseConfigured && !authChecked) {
    return <main className="auth-shell"><section className="auth-card auth-loading"><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>fieldwatch</span></div><p className="heading-sub">Connecting to Supabase...</p></section></main>;
  }

  if (supabaseConfigured && authChecked && !authUser) {
    return <main className="auth-shell"><section className="auth-card"><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>fieldwatch</span></div><p className="eyebrow">BARANGAY ANIMAL HEALTH</p><h1>Sign in to Fieldwatch</h1><p className="heading-sub">Access the live animal registry and vaccination plan.</p><form className="auth-form" onSubmit={signIn}><label>Email<input required type="email" autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label><label>Password<input required type="password" autoComplete="current-password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Sign in</button></form></section></main>;
  }

  async function registerAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);

    const nextDueDate = form.nextDue || null;
    const vaccinated = Boolean(form.vaccineDate);
    const fallbackRecord: Animal = {
      id: `demo-${Date.now()}`,
      name: form.name.trim(),
      species: form.species,
      owner: form.owner.trim(),
      purok: form.purok,
      vaccinated,
      status: getAnimalStatus(vaccinated, nextDueDate),
      nextDueDate,
      nextDue: formatDueDate(nextDueDate),
    };

    const supabase = createClient();
    if (supabase) {
      const { data: purok, error: purokError } = await supabase.from("puroks").select("id").eq("name", form.purok).single();
      if (purokError || !purok) {
        setFormError("That purok is not available in Supabase yet.");
        setIsSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("animals")
        .insert({ name: fallbackRecord.name, species: form.species, owner_name: fallbackRecord.owner, purok_id: purok.id, vaccinated, vaccine_date: form.vaccineDate || null, next_due_date: form.nextDue || null })
        .select("id")
        .single();
      if (error) {
        setFormError(error.code === "42501" ? "Your Supabase user needs a staff profile to register animals." : error.message);
        setIsSaving(false);
        return;
      }
      fallbackRecord.id = data.id;
    }

    setAnimalRecords((current) => [fallbackRecord, ...current]);
    setForm({ name: "", species: "Dog", owner: "", purok: demoPuroks[0], vaccineDate: "", nextDue: "" });
    setShowRegister(false);
    setIsSaving(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>fieldwatch</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania <ChevronDown size={15} /></div>
        <div className={`data-mode ${isLive ? "live" : "demo"}`}><span /> {isLive ? "Connected to Supabase" : "Demo data"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <button className={`nav-item ${activeTab === "Overview" ? "selected" : ""}`} onClick={() => setActiveTab("Overview")}><Activity size={17} /> Overview</button>
          <button className={`nav-item ${activeTab === "Registry" ? "selected" : ""}`} onClick={() => setActiveTab("Registry")}><ClipboardList size={17} /> Animal registry <span className="nav-count">{dashboardStats.registered}</span></button>
          <button className={`nav-item ${activeTab === "Planning" ? "selected" : ""}`} onClick={() => setActiveTab("Planning")}><CalendarDays size={17} /> Vaccination planning</button>
          <button className={`nav-item ${activeTab === "Risk" ? "selected" : ""}`} onClick={() => setActiveTab("Risk")}><ShieldCheck size={17} /> Risk analysis</button>
          <button className={`nav-item ${activeTab === "Map" ? "selected" : ""}`} onClick={() => setActiveTab("Map")}><MapPin size={17} /> Coverage map</button>
          <p className="nav-label nav-label-spaced">Management</p>
          <button className={`nav-item ${activeTab === "Feedback" ? "selected" : ""}`} onClick={() => setActiveTab("Feedback")}><MessageSquare size={17} /> Feedback</button>
          <button className="nav-item"><UsersRound size={17} /> Team members</button>
          <button className="nav-item"><ShieldCheck size={17} /> Audit log</button>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">{authUser ? authUser.fullName.slice(0, 2).toUpperCase() : "MC"}</span><span><strong>{authUser?.fullName ?? "Maria Cruz"}</strong><small>{authUser?.role ?? "Demo administrator"}</small></span>{authUser ? <button className="icon-button" aria-label="Sign out" onClick={signOut}><ChevronDown size={15} /></button> : <ChevronDown size={15} />}</div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="crumb">Operations <span>/</span> {activeTab}</div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button><button className="profile-button"><CircleUserRound size={20} /> <span>MC</span></button></div></header>
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">THURSDAY, SEPTEMBER 11, 2026</p><h1>{activeTab === "Overview" ? `Good morning, ${authUser?.fullName.split(" ")[0] ?? "Maria"}.` : activeTab}</h1><p className="heading-sub">{activeTab === "Overview" ? "Here is what needs your attention across the barangay." : "Barangay Estefania animal health operations"}</p></div>{canManageAnimals && <button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> Register animal</button>}</div>

          {showNotice && <div className="notice"><div className="notice-icon"><Syringe size={19} /></div><div><strong>Vaccination coverage is at {dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}%</strong><p>{dashboardStats.dueSoon} animals are due for their next vaccination.</p></div><button className="notice-action" onClick={() => setActiveTab("Planning")}>View plan <span>→</span></button><button className="notice-close" aria-label="Dismiss notice" onClick={() => setShowNotice(false)}>×</button></div>}

          {activeTab !== "Overview" && <section className="workspace-panel">
            {activeTab === "Registry" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">REGISTRY MANAGEMENT</p><h2>All animal records</h2><p>Search, review, and register dogs and cats across every purok.</p></div><button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> New record</button></div><div className="search-box wide-search"><Search size={16} /><input aria-label="Search all animals" placeholder="Search name, owner, purok, or species..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Owner</th><th>Purok</th><th>Vaccination</th><th>Next due</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={`module-${animal.id}`}><td><strong>{animal.name}</strong><small>{animal.species}</small></td><td>{animal.owner}</td><td>{animal.purok}</td><td>{animal.vaccinated ? "Vaccinated" : "Unvaccinated"}</td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No records found.</div>}</div></div>}
            {activeTab === "Planning" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">PROGRAM PLANNING</p><h2>Vaccination plan</h2><p>Prioritize overdue animals and upcoming vaccination drives.</p></div><span className="module-chip"><CalendarDays size={14} /> 90-day view</span></div><div className="planning-grid"><div className="planning-list"><h3>Needs immediate action</h3>{animalRecords.filter((animal) => animal.status === "Overdue").map((animal) => <div className="planning-row" key={`overdue-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}{animalRecords.filter((animal) => animal.status === "Overdue").length === 0 && <p className="module-muted"><CheckCircle2 size={16} /> No overdue vaccinations.</p>}</div><div className="planning-list"><h3>Upcoming vaccinations</h3>{animalRecords.filter((animal) => animal.status === "Due soon").map((animal) => <div className="planning-row" key={`due-${animal.id}`}><span className="planning-icon warn"><CalendarDays size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}</div></div></div>}
            {activeTab === "Risk" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">DECISION SUPPORT</p><h2>Risk analysis by purok</h2><p>Areas below 70% coverage need targeted follow-up.</p></div><span className="module-chip"><ShieldCheck size={14} /> 70% target</span></div><div className="risk-grid">{riskRows.map((row) => <article className={`risk-card risk-${row.risk.toLowerCase().replace(" ", "-")}`} key={row.purok}><div className="risk-card-head"><h3>{row.purok}</h3><span>{row.risk}</span></div><div className="risk-count"><strong>{row.rate}%</strong><small>{row.vaccinated} vaccinated of {row.total}</small></div><div className="progress"><span style={{ width: `${row.rate}%` }} /></div><p>{row.total === 0 ? "No animals registered in this purok." : row.rate < 70 ? `${Math.max(0, Math.ceil(row.total * .7) - row.vaccinated)} more needed to reach target.` : "Herd immunity target met."}</p></article>)}</div></div>}
            {activeTab === "Map" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">GEOSPATIAL COVERAGE</p><h2>Barangay coverage map</h2><p>Use purok-level records to plan field visits and vaccination drives.</p></div><span className="module-chip"><MapPin size={14} /> 6 puroks monitored</span></div><div className="map-demo"><div className="map-grid">{riskRows.map((row, index) => <div className={`map-zone zone-${index}`} key={row.purok}><MapPin size={18} /><strong>{row.purok}</strong><small>{row.rate}% covered · {row.total} animals</small></div>)}</div><div className="map-legend"><span><i className="legend-dot good" /> 70%+ coverage</span><span><i className="legend-dot warn" /> Below target</span><span><i className="legend-dot empty" /> No data</span></div></div></div>}
            {activeTab === "Feedback" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SUPPORT CHANNEL</p><h2>Feedback and suggestions</h2><p>Send notes to the barangay animal health team.</p></div></div>{feedbackSent ? <div className="feedback-success"><CheckCircle2 size={22} /><div><strong>Feedback submitted</strong><p>Thank you. Your message has been recorded for review.</p></div><button className="secondary-button" onClick={() => setFeedbackSent(false)}>Send another</button></div> : <form className="feedback-form" onSubmit={submitFeedback}><label>Category<select><option>Suggestion</option><option>Bug report</option><option>Complaint</option><option>Compliment</option></select></label><label>Message<textarea required rows={5} placeholder="Tell us what would improve the system..." value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} /></label><button className="primary-button" type="submit"><MessageSquare size={16} /> Submit feedback</button></form>}</div>}
          </section>}

          <div className={activeTab === "Overview" ? "" : "overview-hidden"}>
          <div className="stat-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><PawPrint size={18} /></span><span className="trend up"><TrendingUp size={13} /> 8.4%</span></div><p className="stat-number">{dashboardStats.registered}</p><p className="stat-label">Registered animals</p><div className="stat-foot">Current registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Syringe size={18} /></span><span className="trend up"><TrendingUp size={13} /> 4.2%</span></div><p className="stat-number">{dashboardStats.vaccinated}</p><p className="stat-label">Vaccinated animals</p><div className="stat-foot">{dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}% of total registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><CalendarDays size={18} /></span><span className="trend neutral">This month</span></div><p className="stat-number">{dashboardStats.dueSoon}</p><p className="stat-label">Due for vaccination</p><div className="stat-foot">Needs scheduling</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon red"><Bell size={18} /></span><span className="trend danger">Needs action</span></div><p className="stat-number">{dashboardStats.overdue}</p><p className="stat-label">Overdue vaccinations</p><div className="stat-foot">Review registry</div></article>
          </div>

          <div className="section-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Vaccination coverage</h2><p>Progress toward the 80% barangay target</p></div><button className="select-button">Last 6 months <ChevronDown size={14} /></button></div><div className="chart-wrap"><div className="chart-y"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><div className="chart"><div className="target-line"><span>Target</span></div><div className="bars"><span className="bar" style={{ height: "47%" }} /><span className="bar" style={{ height: "54%" }} /><span className="bar" style={{ height: "59%" }} /><span className="bar" style={{ height: "64%" }} /><span className="bar" style={{ height: "69%" }} /><span className="bar current" style={{ height: "72%" }} /></div><div className="chart-x"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div></section><section className="panel purok-panel"><div className="panel-heading"><div><h2>Coverage by purok</h2><p>Vaccinated animals / total</p></div><button className="text-button">View all →</button></div><div className="purok-list"><Coverage name="The Palisades" value={82} count="23 / 28" /><Coverage name="Bagong Silang North" value={76} count="19 / 25" /><Coverage name="Celine Homes East" value={71} count="17 / 24" /><Coverage name="Zamora Street" value={64} count="16 / 25" /><Coverage name="Bagong Silang South" value={59} count="17 / 26" /></div></section></div>

          <section className="panel registry-panel"><div className="panel-heading registry-heading"><div><h2>Recent registry activity</h2><p>{isLive ? "Latest 25 live animal records" : "Latest animal records and vaccination schedules"}</p></div><div className="registry-tools"><div className="search-box"><Search size={16} /><input aria-label="Search registry" placeholder="Search registry..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="text-button" onClick={() => setActiveTab("Registry")}>View registry →</button></div></div>{loadError && <p className="form-error load-error">{loadError}</p>}<div className="table-wrap"><table><thead><tr><th>Animal</th><th>Owner</th><th>Purok</th><th>Next vaccination</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={animal.id}><td><div className="animal-cell"><span className="animal-avatar">{animal.species === "Dog" ? "🐕" : "🐈"}</span><span><strong>{animal.name}</strong><small>{animal.species}</small></span></div></td><td>{animal.owner}</td><td><span className="location"><MapPin size={13} /> {animal.purok}</span></td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No animals match “{query}”.</div>}</div></section>
          </div>
        </div>
      </section>
      {showRegister && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRegister(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="modal-heading"><div><p className="eyebrow">NEW RECORD</p><h2 id="register-title">Register an animal</h2></div><button className="icon-button" aria-label="Close registration form" onClick={() => setShowRegister(false)}><X size={18} /></button></div><form className="animal-form" onSubmit={registerAnimal}><label>Animal name<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Bantay" /></label><label>Species<select value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value as Animal["species"] })}><option>Dog</option><option>Cat</option></select></label><label>Owner name<input required maxLength={120} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Full name" /></label><label>Purok<select value={form.purok} onChange={(event) => setForm({ ...form, purok: event.target.value })}>{demoPuroks.map((purok) => <option key={purok}>{purok}</option>)}</select></label><label>Last vaccination<input type="date" value={form.vaccineDate} onChange={(event) => setForm({ ...form, vaccineDate: event.target.value })} /></label><label>Next vaccination<input type="date" min={form.vaccineDate || undefined} value={form.nextDue} onChange={(event) => setForm({ ...form, nextDue: event.target.value })} /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>Cancel</button><button className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save animal"}</button></div></form></section></div>}
    </main>
  );
}

function Coverage({ name, value, count }: { name: string; value: number; count: string }) {
  return <div className="coverage-row"><div className="coverage-meta"><span>{name}</span><strong>{count} <em>{value}%</em></strong></div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}
