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
  FileText,
  MapPin,
  MessageSquare,
  PawPrint,
  Plus,
  Search,
  Send,
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
  contact: string;
  impoundArea: string;
};

type SupabaseAnimalRecord = {
  id: number;
  name: string;
  species: Animal["species"];
  owner_name: string;
  vaccinated: boolean;
  next_due_date: string | null;
  contact_number: string | null;
  impound_area: string | null;
  puroks: { name: string } | { name: string }[] | null;
};

type DashboardStats = { registered: number; vaccinated: number; dueSoon: number; overdue: number };
type WorkspaceTab = "Overview" | "Registry" | "Planning" | "Reports" | "Risk" | "Map" | "Feedback" | "Team" | "Audit";

type SupabaseError = { code?: string; message: string };
type SupabaseAuthResponse = { data: { user: { id: string; email?: string } | null }; error: SupabaseError | null };
type AccountStatus = "active" | "disabled" | "pending";

const animals: Animal[] = [
  { id: "demo-bantay", name: "Bantay", species: "Dog", owner: "Ramon Dela Cruz", contact: "09171234567", impoundArea: "", purok: "The Palisades", vaccinated: true, status: "Vaccinated", nextDueDate: "2026-10-18", nextDue: "Oct 18, 2026" },
  { id: "demo-miming", name: "Miming", species: "Cat", owner: "Liza Santos", contact: "09181234567", impoundArea: "", purok: "Bagong Silang North", vaccinated: true, status: "Due soon", nextDueDate: "2026-09-23", nextDue: "Sep 23, 2026" },
  { id: "demo-brownie", name: "Brownie", species: "Dog", owner: "Joel Mercado", contact: "09191234567", impoundArea: "Barangay impound kennel A", purok: "Zamora Street", vaccinated: false, status: "Overdue", nextDueDate: "2026-08-30", nextDue: "Aug 30, 2026" },
  { id: "demo-luna", name: "Luna", species: "Dog", owner: "Ana Villareal", contact: "09201234567", impoundArea: "", purok: "Celine Homes East", vaccinated: true, status: "Vaccinated", nextDueDate: "2026-11-04", nextDue: "Nov 04, 2026" },
  { id: "demo-toby", name: "Toby", species: "Dog", owner: "Mark Flores", contact: "09211234567", impoundArea: "", purok: "The Palisades", vaccinated: true, status: "Due soon", nextDueDate: "2026-09-27", nextDue: "Sep 27, 2026" },
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
  const [authUser, setAuthUser] = useState<{ id: string; email: string; fullName: string; role: string; status: AccountStatus } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"landing" | "signin" | "register">("landing");
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [registrationSent, setRegistrationSent] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [registrationForm, setRegistrationForm] = useState({ username: "", fullName: "", email: "", contact: "", idDocument: "", password: "" });
  const [form, setForm] = useState({ name: "", species: "Dog" as Animal["species"], owner: "", contact: "", impoundArea: "", purok: demoPuroks[0], vaccineDate: "", nextDue: "" });
  const [liveStats, setLiveStats] = useState<DashboardStats | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("Last 6 months");
  const [showNotifications, setShowNotifications] = useState(false);
  const [reportRange, setReportRange] = useState({ from: "2026-01-01", to: "2026-12-31" });
  const [bulkMessage, setBulkMessage] = useState("Your animal's vaccination is due. Please visit the barangay health station.");
  const [bulkSent, setBulkSent] = useState(false);
  const supabaseConfigured = Boolean(createClient());
  const canManageAnimals = !isLive || ["admin", "veterinarian", "bhw"].includes(authUser?.role ?? "");

  function switchAuthMode(nextMode: "landing" | "signin" | "register") {
    if (nextMode === authMode || isPageTransitioning) return;
    setIsPageTransitioning(true);
    window.setTimeout(() => {
      setAuthMode(nextMode);
      setIsPageTransitioning(false);
    }, 220);
  }

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

      const { data: profile } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).maybeSingle();
      if (!mounted) return;
      const status = (profile?.status ?? "pending") as AccountStatus;
      if (status !== "active") {
        await supabase.auth.signOut();
        setAuthError(status === "pending" ? "Your civilian account is pending administrator verification." : "This account is disabled. Contact the barangay administrator.");
        setAuthChecked(true);
        return;
      }
      setAuthUser({ id: user.id, email: user.email ?? "", fullName: profile?.full_name ?? user.email ?? "VacciTrack user", role: profile?.role ?? "viewer", status });
      setAuthChecked(true);

      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const [recentResult, totalResult, vaccinatedResult, dueResult, overdueResult] = await Promise.all([
        supabase.from("animals").select("id, name, species, owner_name, contact_number, impound_area, vaccinated, next_due_date, puroks(name)").order("created_at", { ascending: false }).limit(25),
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
            contact: record.contact_number ?? "",
            impoundArea: record.impound_area ?? "",
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

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setAuthError("");
    if (registrationForm.password.length < 8) {
      setAuthError("Password must be at least 8 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(registrationForm.username)) {
      setAuthError("Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    if (!/^09\d{9}$/.test(registrationForm.contact)) {
      setAuthError("Enter a valid 11-digit Philippine mobile number starting with 09.");
      return;
    }
    if (!registrationForm.idDocument.trim()) {
      setAuthError("Enter the valid ID reference required for administrator verification.");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: registrationForm.email,
      password: registrationForm.password,
      options: { data: { full_name: registrationForm.fullName, username: registrationForm.username, contact_number: registrationForm.contact, id_document_reference: registrationForm.idDocument.trim(), requested_role: "client" } },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setRegistrationSent(true);
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

  const reportAnimals = useMemo(() => animalRecords.filter((animal) => {
    if (!animal.nextDueDate) return true;
    return animal.nextDueDate >= reportRange.from && animal.nextDueDate <= reportRange.to;
  }), [animalRecords, reportRange]);

  const reportSummary = useMemo(() => ({
    total: reportAnimals.length,
    vaccinated: reportAnimals.filter((animal) => animal.vaccinated).length,
    expiring: reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").length,
    impounded: reportAnimals.filter((animal) => animal.impoundArea).length,
  }), [reportAnimals]);

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
    return <main className="auth-shell"><section className="auth-card auth-loading"><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div><p className="heading-sub">Connecting to Supabase...</p></section></main>;
  }

  if (supabaseConfigured && authChecked && !authUser) {
    if (authMode === "landing") return <Landing isTransitioning={isPageTransitioning} onSignIn={() => { setAuthError(""); switchAuthMode("signin"); }} />;
    return <main className={`auth-shell ${isPageTransitioning ? "page-exit" : ""}`}><section className="auth-card page-enter" key={`${authMode}-${registrationSent}`}><button className="auth-back" onClick={() => { setAuthError(""); switchAuthMode("landing"); }}>← Back to VacciTrack</button><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>{authMode === "signin" ? <><p className="eyebrow">ROLE-BASED ACCESS</p><h1>Sign in to VacciTrack</h1><p className="heading-sub">Active civilian, BHW, veterinarian, viewer, and administrator accounts are routed by their assigned role.</p><form className="auth-form" onSubmit={signIn}><label>Email<input required type="email" autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label><label>Password<input required type="password" autoComplete="current-password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Sign in</button></form><button className="auth-switch" onClick={() => { setAuthError(""); switchAuthMode("register"); }}>Create a civilian account</button></> : registrationSent ? <div className="confirmation"><CheckCircle2 size={30} /><h1>Check your email</h1><p>We sent a confirmation link to <strong>{registrationForm.email}</strong>. Your civilian account will remain pending until an administrator verifies it.</p><button className="primary-button" onClick={() => { setRegistrationSent(false); switchAuthMode("signin"); }}>Back to sign in</button></div> : <><p className="eyebrow">CIVILIAN ACCOUNT REQUEST</p><h1>Create your account</h1><p className="heading-sub">Public registration creates a civilian / pet-owner account. BHW, veterinarian, viewer, and administrator accounts are created by an administrator.</p><form className="auth-form" onSubmit={signUp}><label>Requested role<select disabled value="client"><option value="client">Civilian / pet owner</option></select></label><label>Username<input required minLength={3} maxLength={80} value={registrationForm.username} onChange={(event) => setRegistrationForm({ ...registrationForm, username: event.target.value })} /></label><label>Full name<input required maxLength={120} value={registrationForm.fullName} onChange={(event) => setRegistrationForm({ ...registrationForm, fullName: event.target.value })} /></label><label>Email<input required type="email" autoComplete="email" value={registrationForm.email} onChange={(event) => setRegistrationForm({ ...registrationForm, email: event.target.value })} /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" placeholder="09171234567" value={registrationForm.contact} onChange={(event) => setRegistrationForm({ ...registrationForm, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} /></label><label>Valid ID reference<input required maxLength={120} placeholder="e.g. National ID ending 1234" value={registrationForm.idDocument} onChange={(event) => setRegistrationForm({ ...registrationForm, idDocument: event.target.value })} /></label><label>Password<input required minLength={8} type="password" autoComplete="new-password" value={registrationForm.password} onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })} /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Submit for verification</button></form><button className="auth-switch" onClick={() => { setAuthError(""); switchAuthMode("signin"); }}>Already have an account? Sign in</button></>}</section></main>;
  }

  async function registerAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);

    const todayIso = new Date().toISOString().slice(0, 10);
    if (!/^09\d{9}$/.test(form.contact)) {
      setFormError("Enter a valid Philippine mobile number (11 digits, starting with 09).");
      setIsSaving(false);
      return;
    }
    if (form.vaccineDate && form.vaccineDate > todayIso) {
      setFormError("The vaccination date cannot be in the future.");
      setIsSaving(false);
      return;
    }
    if (form.nextDue && form.vaccineDate && form.nextDue < form.vaccineDate) {
      setFormError("The next vaccination date must be on or after the last vaccination date.");
      setIsSaving(false);
      return;
    }
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
      contact: form.contact,
      impoundArea: form.impoundArea.trim(),
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
        .insert({ name: fallbackRecord.name, species: form.species, owner_name: fallbackRecord.owner, contact_number: form.contact, impound_area: form.impoundArea.trim() || null, purok_id: purok.id, vaccinated, vaccine_date: form.vaccineDate || null, next_due_date: form.nextDue || null })
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
    setForm({ name: "", species: "Dog", owner: "", contact: "", impoundArea: "", purok: demoPuroks[0], vaccineDate: "", nextDue: "" });
    setShowRegister(false);
    setIsSaving(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania <ChevronDown size={15} /></div>
        <div className={`data-mode ${isLive ? "live" : "demo"}`}><span /> {isLive ? "Connected to Supabase" : "Demo data"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <button className={`nav-item ${activeTab === "Overview" ? "selected" : ""}`} onClick={() => setActiveTab("Overview")}><Activity size={17} /> Overview</button>
          <button className={`nav-item ${activeTab === "Registry" ? "selected" : ""}`} onClick={() => setActiveTab("Registry")}><ClipboardList size={17} /> Animal registry <span className="nav-count">{dashboardStats.registered}</span></button>
          <button className={`nav-item ${activeTab === "Planning" ? "selected" : ""}`} onClick={() => setActiveTab("Planning")}><CalendarDays size={17} /> Vaccination planning</button>
          <button className={`nav-item ${activeTab === "Reports" ? "selected" : ""}`} onClick={() => setActiveTab("Reports")}><FileText size={17} /> Reports</button>
          <button className={`nav-item ${activeTab === "Risk" ? "selected" : ""}`} onClick={() => setActiveTab("Risk")}><ShieldCheck size={17} /> Risk analysis</button>
          <button className={`nav-item ${activeTab === "Map" ? "selected" : ""}`} onClick={() => setActiveTab("Map")}><MapPin size={17} /> Coverage map</button>
          <p className="nav-label nav-label-spaced">Management</p>
          <button className={`nav-item ${activeTab === "Feedback" ? "selected" : ""}`} onClick={() => setActiveTab("Feedback")}><MessageSquare size={17} /> Feedback</button>
          <button className={`nav-item ${activeTab === "Team" ? "selected" : ""}`} onClick={() => setActiveTab("Team")}><UsersRound size={17} /> Team members</button>
          <button className={`nav-item ${activeTab === "Audit" ? "selected" : ""}`} onClick={() => setActiveTab("Audit")}><ShieldCheck size={17} /> Audit log</button>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">{authUser ? authUser.fullName.slice(0, 2).toUpperCase() : "MC"}</span><span><strong>{authUser?.fullName ?? "Maria Cruz"}</strong><small>{authUser?.role ?? "Demo administrator"}</small></span>{authUser ? <button className="icon-button" aria-label="Sign out" onClick={signOut}><ChevronDown size={15} /></button> : <ChevronDown size={15} />}</div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="crumb">Operations <span>/</span> {activeTab}</div><div className="top-actions"><button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications((current) => !current)}><Bell size={18} /><span className="notification-dot" /></button><button className="profile-button" onClick={() => authUser ? signOut() : setActiveTab("Feedback")}><CircleUserRound size={20} /> <span>{authUser ? authUser.fullName.slice(0, 2).toUpperCase() : "MC"}</span></button></div>{showNotifications && <div className="notification-panel"><div className="notification-panel-head"><strong>Notifications</strong><button onClick={() => setShowNotifications(false)}>Close</button></div><div className="notification-item"><span className="notification-icon"><Syringe size={15} /></span><span><strong>{dashboardStats.dueSoon} vaccinations due soon</strong><small>Review the vaccination plan for upcoming visits.</small></span></div><div className="notification-item"><span className="notification-icon danger"><Bell size={15} /></span><span><strong>{dashboardStats.overdue} overdue records</strong><small>Prioritize follow-up in the Risk Analysis workspace.</small></span></div></div>}</header>
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">THURSDAY, SEPTEMBER 11, 2026</p><h1>{activeTab === "Overview" ? `Good morning, ${authUser?.fullName.split(" ")[0] ?? "Maria"}.` : activeTab}</h1><p className="heading-sub">{activeTab === "Overview" ? "Here is what needs your attention across the barangay." : "Barangay Estefania animal health operations"}</p></div>{canManageAnimals && <button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> Register animal</button>}</div>

          {showNotice && <div className="notice"><div className="notice-icon"><Syringe size={19} /></div><div><strong>Vaccination coverage is at {dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}%</strong><p>{dashboardStats.dueSoon} animals are due for their next vaccination.</p></div><button className="notice-action" onClick={() => setActiveTab("Planning")}>View plan <span>→</span></button><button className="notice-close" aria-label="Dismiss notice" onClick={() => setShowNotice(false)}>×</button></div>}

          {activeTab !== "Overview" && <section className="workspace-panel">
            {activeTab === "Registry" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">REGISTRY MANAGEMENT</p><h2>All animal records</h2><p>Search, review, and register dogs and cats across every purok.</p></div><button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> New record</button></div><div className="search-box wide-search"><Search size={16} /><input aria-label="Search all animals" placeholder="Search name, civilian, purok, or species..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Civilian / contact</th><th>Pin area</th><th>Impound area</th><th>Next due</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={`module-${animal.id}`}><td><strong>{animal.name}</strong><small>{animal.species}</small></td><td>{animal.owner}<small>{animal.contact || "No contact"}</small></td><td>{animal.purok}</td><td>{animal.impoundArea || "—"}</td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No records found.</div>}</div></div>}
            {activeTab === "Planning" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">PROGRAM PLANNING</p><h2>Vaccination plan</h2><p>Prioritize overdue animals and upcoming vaccination drives.</p></div><span className="module-chip"><CalendarDays size={14} /> 90-day view</span></div><div className="planning-grid"><div className="planning-list"><h3>Needs immediate action</h3>{animalRecords.filter((animal) => animal.status === "Overdue").map((animal) => <div className="planning-row" key={`overdue-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}{animalRecords.filter((animal) => animal.status === "Overdue").length === 0 && <p className="module-muted"><CheckCircle2 size={16} /> No overdue vaccinations.</p>}</div><div className="planning-list"><h3>Upcoming vaccinations</h3>{animalRecords.filter((animal) => animal.status === "Due soon").map((animal) => <div className="planning-row" key={`due-${animal.id}`}><span className="planning-icon warn"><CalendarDays size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}</div></div></div>}
            {activeTab === "Reports" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">REPORTING</p><h2>Vaccination report by date range</h2><p>Review coverage, expiring vaccinations, and impound cases within a selected period.</p></div><button className="secondary-button" onClick={() => window.print()}><FileText size={15} /> Print report</button></div><div className="report-controls"><label>From<input type="date" value={reportRange.from} onChange={(event) => setReportRange({ ...reportRange, from: event.target.value })} /></label><label>To<input type="date" min={reportRange.from} value={reportRange.to} onChange={(event) => setReportRange({ ...reportRange, to: event.target.value })} /></label></div>{reportRange.to < reportRange.from ? <p className="form-error">The end date must be on or after the start date.</p> : <><div className="report-grid"><article><strong>{reportSummary.total}</strong><span>Records in range</span></article><article><strong>{reportSummary.vaccinated}</strong><span>Vaccinated</span></article><article><strong>{reportSummary.expiring}</strong><span>Expired / due soon</span></article><article><strong>{reportSummary.impounded}</strong><span>In impound area</span></article></div><div className="planning-grid"><div className="planning-list"><h3>Expiry detection</h3>{reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").map((animal) => <div className="planning-row" key={`expiry-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name} — {animal.owner}</strong><small>{animal.contact || "No contact recorded"} · {animal.nextDue}</small></span><em>{animal.status}</em></div>)}</div><form className="planning-list" onSubmit={(event) => { event.preventDefault(); setBulkSent(true); }}><h3>Send reminder to many</h3><p className="heading-sub">Recipients: {reportAnimals.filter((animal) => (animal.status === "Due soon" || animal.status === "Overdue") && animal.contact).length} valid contacts</p><textarea required rows={4} value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} />{bulkSent && <p className="module-muted"><CheckCircle2 size={15} /> Reminder queue prepared for valid contacts.</p>}<button className="primary-button" type="submit"><Send size={15} /> Queue reminders</button></form></div></>}</div>}
            {activeTab === "Risk" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">DECISION SUPPORT</p><h2>Risk analysis by purok</h2><p>Areas below 70% coverage need targeted follow-up.</p></div><span className="module-chip"><ShieldCheck size={14} /> 70% target</span></div><div className="risk-grid">{riskRows.map((row) => <article className={`risk-card risk-${row.risk.toLowerCase().replace(" ", "-")}`} key={row.purok}><div className="risk-card-head"><h3>{row.purok}</h3><span>{row.risk}</span></div><div className="risk-count"><strong>{row.rate}%</strong><small>{row.vaccinated} vaccinated of {row.total}</small></div><div className="progress"><span style={{ width: `${row.rate}%` }} /></div><p>{row.total === 0 ? "No animals registered in this purok." : row.rate < 70 ? `${Math.max(0, Math.ceil(row.total * .7) - row.vaccinated)} more needed to reach target.` : "Herd immunity target met."}</p></article>)}</div></div>}
            {activeTab === "Map" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">GEOSPATIAL COVERAGE</p><h2>Barangay coverage map</h2><p>Use purok-level records to plan field visits and vaccination drives.</p></div><span className="module-chip"><MapPin size={14} /> 6 puroks monitored</span></div><div className="map-demo"><div className="map-grid">{riskRows.map((row, index) => <div className={`map-zone zone-${index}`} key={row.purok}><MapPin size={18} /><strong>{row.purok}</strong><small>{row.rate}% covered · {row.total} animals</small></div>)}</div><div className="map-legend"><span><i className="legend-dot good" /> 70%+ coverage</span><span><i className="legend-dot warn" /> Below target</span><span><i className="legend-dot empty" /> No data</span></div></div></div>}
            {activeTab === "Feedback" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SUPPORT CHANNEL</p><h2>Feedback and suggestions</h2><p>Send notes to the barangay animal health team.</p></div></div>{feedbackSent ? <div className="feedback-success"><CheckCircle2 size={22} /><div><strong>Feedback submitted</strong><p>Thank you. Your message has been recorded for review.</p></div><button className="secondary-button" onClick={() => setFeedbackSent(false)}>Send another</button></div> : <form className="feedback-form" onSubmit={submitFeedback}><label>Category<select><option>Suggestion</option><option>Bug report</option><option>Complaint</option><option>Compliment</option></select></label><label>Message<textarea required rows={5} placeholder="Tell us what would improve the system..." value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} /></label><button className="primary-button" type="submit"><MessageSquare size={16} /> Submit feedback</button></form>}</div>}
            {activeTab === "Team" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">MANAGEMENT</p><h2>Team members</h2><p>Staff access for the Barangay Estefania health team.</p></div></div><div className="team-list"><div className="team-row"><span className="avatar">{authUser?.fullName.slice(0, 2).toUpperCase() ?? "MC"}</span><span><strong>{authUser?.fullName ?? "Maria Cruz"}</strong><small>{authUser?.email ?? "Administrator account"}</small></span><em>{authUser?.role ?? "admin"}</em></div><div className="team-row"><span className="avatar team-muted">BH</span><span><strong>Barangay Health Worker</strong><small>Field operations account</small></span><em>bhw</em></div><div className="team-row"><span className="avatar team-muted">CV</span><span><strong>City Veterinarian</strong><small>Vaccination program oversight</small></span><em>veterinarian</em></div></div></div>}
            {activeTab === "Audit" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SECURITY</p><h2>Audit log</h2><p>Recent actions from this VacciTrack workspace.</p></div><span className="module-chip"><ShieldCheck size={14} /> Protected</span></div><div className="audit-list"><div><span className="audit-dot good" /><span><strong>Registry workspace opened</strong><small>Current session · {authUser?.fullName ?? "Demo administrator"}</small></span><time>Now</time></div><div><span className="audit-dot good" /><span><strong>Supabase connection checked</strong><small>Authenticated data boundary</small></span><time>Today</time></div><div><span className="audit-dot neutral" /><span><strong>Dashboard initialized</strong><small>VacciTrack operations workspace</small></span><time>Today</time></div></div></div>}
          </section>}

          <div className={activeTab === "Overview" ? "" : "overview-hidden"}>
          <div className="stat-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><PawPrint size={18} /></span><span className="trend up"><TrendingUp size={13} /> 8.4%</span></div><p className="stat-number">{dashboardStats.registered}</p><p className="stat-label">Registered animals</p><div className="stat-foot">Current registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Syringe size={18} /></span><span className="trend up"><TrendingUp size={13} /> 4.2%</span></div><p className="stat-number">{dashboardStats.vaccinated}</p><p className="stat-label">Vaccinated animals</p><div className="stat-foot">{dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}% of total registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><CalendarDays size={18} /></span><span className="trend neutral">This month</span></div><p className="stat-number">{dashboardStats.dueSoon}</p><p className="stat-label">Due for vaccination</p><div className="stat-foot">Needs scheduling</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon red"><Bell size={18} /></span><span className="trend danger">Needs action</span></div><p className="stat-number">{dashboardStats.overdue}</p><p className="stat-label">Overdue vaccinations</p><div className="stat-foot">Review registry</div></article>
          </div>

          <div className="section-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Vaccination coverage</h2><p>Progress toward the 80% barangay target</p></div><select className="select-button chart-select" value={chartPeriod} onChange={(event) => setChartPeriod(event.target.value)}><option>Last 6 months</option><option>Last 12 months</option><option>This year</option></select></div><div className="chart-wrap"><div className="chart-y"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><div className="chart"><div className="target-line"><span>Target</span></div><div className="bars"><span className="bar" style={{ height: "47%" }} /><span className="bar" style={{ height: "54%" }} /><span className="bar" style={{ height: "59%" }} /><span className="bar" style={{ height: "64%" }} /><span className="bar" style={{ height: "69%" }} /><span className="bar current" style={{ height: "72%" }} /></div><div className="chart-x"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div><p className="chart-caption">Showing {chartPeriod.toLowerCase()} of barangay coverage.</p></section><section className="panel purok-panel"><div className="panel-heading"><div><h2>Coverage by purok</h2><p>Vaccinated animals / total</p></div><button className="text-button" onClick={() => setActiveTab("Risk")}>View all →</button></div><div className="purok-list"><Coverage name="The Palisades" value={82} count="23 / 28" /><Coverage name="Bagong Silang North" value={76} count="19 / 25" /><Coverage name="Celine Homes East" value={71} count="17 / 24" /><Coverage name="Zamora Street" value={64} count="16 / 25" /><Coverage name="Bagong Silang South" value={59} count="17 / 26" /></div></section></div>

          <section className="panel registry-panel"><div className="panel-heading registry-heading"><div><h2>Recent registry activity</h2><p>{isLive ? "Latest 25 live animal records" : "Latest animal records and vaccination schedules"}</p></div><div className="registry-tools"><div className="search-box"><Search size={16} /><input aria-label="Search registry" placeholder="Search registry..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="text-button" onClick={() => setActiveTab("Registry")}>View registry →</button></div></div>{loadError && <p className="form-error load-error">{loadError}</p>}<div className="table-wrap"><table><thead><tr><th>Animal</th><th>Owner</th><th>Purok</th><th>Next vaccination</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={animal.id}><td><div className="animal-cell"><span className="animal-avatar">{animal.species === "Dog" ? "🐕" : "🐈"}</span><span><strong>{animal.name}</strong><small>{animal.species}</small></span></div></td><td>{animal.owner}</td><td><span className="location"><MapPin size={13} /> {animal.purok}</span></td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No animals match “{query}”.</div>}</div></section>
          </div>
        </div>
      </section>
      {showRegister && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRegister(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="modal-heading"><div><p className="eyebrow">NEW RECORD</p><h2 id="register-title">Register an animal</h2></div><button className="icon-button" aria-label="Close registration form" onClick={() => setShowRegister(false)}><X size={18} /></button></div><form className="animal-form" onSubmit={registerAnimal}><label>Animal name<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Bantay" /></label><label>Species<select value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value as Animal["species"] })}><option>Dog</option><option>Cat</option></select></label><label>Civilian / owner name<input required maxLength={120} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Full name" /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="09171234567" /></label><label>Geospatial pin area<select value={form.purok} onChange={(event) => setForm({ ...form, purok: event.target.value })}>{demoPuroks.map((purok) => <option key={purok}>{purok}</option>)}</select></label><label>Impound area <small>(optional)</small><input maxLength={120} value={form.impoundArea} onChange={(event) => setForm({ ...form, impoundArea: event.target.value })} placeholder="e.g. Barangay kennel A" /></label><label>Last vaccination<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.vaccineDate} onChange={(event) => setForm({ ...form, vaccineDate: event.target.value })} /></label><label>Next vaccination<input type="date" min={form.vaccineDate || undefined} value={form.nextDue} onChange={(event) => setForm({ ...form, nextDue: event.target.value })} /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>Cancel</button><button className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save animal"}</button></div></form></section></div>}
    </main>
  );
}

function Coverage({ name, value, count }: { name: string; value: number; count: string }) {
  return <div className="coverage-row"><div className="coverage-meta"><span>{name}</span><strong>{count} <em>{value}%</em></strong></div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}

function Landing({ onSignIn, isTransitioning }: { onSignIn: () => void; isTransitioning: boolean }) {
  return <main className={`landing-page page-enter ${isTransitioning ? "page-exit" : ""}`}><header className="landing-nav"><button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span className="landing-brand-mark">✣</span><span><strong>VacciTrack</strong><small>BRGY. ESTEFANIA</small></span></button><nav aria-label="Public navigation"><a href="#capabilities">Capabilities</a><a href="#why-it-matters">Why it matters</a><button className="landing-nav-action" onClick={onSignIn}>Sign in <span>→</span></button></nav></header><section className="landing-hero"><div className="landing-hero-image" /><div className="landing-hero-overlay" /><div className="landing-hero-content"><div className="landing-kicker landing-kicker-light">● &nbsp; CLOUD-BASED &nbsp;·&nbsp; BARANGAY ESTEFANIA, BACOLOD CITY 6100</div><h1>Animal Vaccination<br /><em>Monitoring System</em></h1><p>Real-time tracking of immunization compliance for dogs and cats across every purok, with coverage reports and practical planning tools.</p><div className="landing-hero-actions"><button className="landing-primary-action" onClick={onSignIn}>Access the system <span>→</span></button></div></div></section><section className="landing-stats"><div><strong>1,240<span>+</span></strong><small>Animals registered</small></div><div><strong>87<span>%</span></strong><small>Vaccination coverage</small></div><div><strong>6</strong><small>Puroks monitored</small></div><div><strong>4,800<span>+</span></strong><small>Alerts supported</small></div></section><section className="landing-features" id="capabilities"><div className="landing-section-intro"><div className="landing-kicker">SYSTEM CAPABILITIES</div><h2>Everything needed for<br /><em>effective herd immunity</em></h2><p>VacciTrack centralizes animal health data for barangay teams and pet owners in one accessible platform.</p></div><div className="landing-feature-grid"><article><span>⌖</span><h3>Coverage mapping</h3><p>See vaccination coverage across puroks and prioritize field visits.</p></article><article><span>✣</span><h3>Vaccination tracking</h3><p>Maintain a clear record of vaccination dates and upcoming due dates.</p></article><article><span>◌</span><h3>Planning tools</h3><p>Identify overdue animals and organize the next vaccination drive.</p></article><article><span>▤</span><h3>Reports and risk</h3><p>Compare coverage and spot areas below the 70% target.</p></article><article><span>♧</span><h3>Role-based access</h3><p>Keep staff workflows protected with Supabase authentication and RLS.</p></article><article><span>☁</span><h3>Cloud infrastructure</h3><p>Access the latest registry from any device through Vercel and Supabase.</p></article></div></section><section className="landing-why" id="why-it-matters"><div className="landing-why-image" /><div className="landing-why-content"><div className="landing-kicker">WHY IT MATTERS</div><h2>Protecting community health,<br /><em>one animal at a time</em></h2><p>Rabies is preventable with proper vaccination. Systematic tracking closes the gaps.</p><ul><li>Purok-level coverage helps health workers decide where to go next.</li><li>Owners can keep their animal records current and easy to review.</li><li>Cloud-backed records reduce the risk of losing critical health data.</li></ul></div></section><footer className="landing-footer"><div><strong>VacciTrack</strong> · Barangay Estefania Animal Vaccination Monitoring System</div><div>© 2026 Barangay Estefania, Bacolod City 6100</div></footer></main>;
}
