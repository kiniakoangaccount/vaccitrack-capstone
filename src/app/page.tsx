"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Cat,
  CheckCircle2,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  Dog,
  FileText,
  Home as HomeIcon,
  Loader2,
  MapPin,
  Menu,
  MessageSquare,
  PawPrint,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Syringe,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { registerUser } from "./register-action";
import { searchLocation, type LocationSuggestion } from "./geocode-action";
import { resolveUsernameToEmail } from "./signin-action";
import { exportAnimalsCsv } from "./audit-actions";
import { markAllNotificationsRead, markNotificationRead } from "./notification-actions";
import { queueVaccinationReminders } from "./reminder-actions";
import { updatePoundStatus, type PoundStatus } from "./pound-actions";
import { getTeamMembers, type TeamMember } from "./team-actions";
import { purokOptions, getAnimalStatus } from "@/lib/map-data";
import AuditPanel from "./308873d1049ba0/dashboard/AuditPanel";
import dynamic from "next/dynamic";
import type { LeafletMapHandle } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const POUND_STATUSES: PoundStatus[] = ["Impounded", "Under Observation", "Up for Adoption", "Reclaimed"];

type Animal = {
  id: number | string;
  name: string;
  species: "Dog" | "Cat";
  classification?: "Pet" | "Stray";
  neutered?: boolean;
  breed?: string;
  age?: number;
  sex?: string;
  color?: string;
  owner: string;
  purok: string;
  vaccinated: boolean;
  status: "Vaccinated" | "Due soon" | "Overdue" | "Not scheduled";
  vaccineDate?: string | null;
  nextDueDate: string | null;
  nextDue: string;
  contact: string;
  impoundArea: string;
  vaccineType?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
  poundStatus?: PoundStatus | null;
};

type SupabaseAnimalRecord = {
  id: number;
  name: string;
  species: Animal["species"];
  classification?: Animal["classification"];
  neutered?: boolean | null;
  breed?: string | null;
  age?: number | null;
  sex?: string | null;
  color?: string | null;
  owner_name: string;
  vaccinated: boolean;
  vaccine_date: string | null;
  next_due_date: string | null;
  contact_number: string | null;
  impound_area: string | null;
  vaccine_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  pound_status?: PoundStatus | null;
  puroks: { name: string } | { name: string }[] | null;
};

type WorkspaceTab = "Overview" | "Registry" | "Planning" | "Reports" | "Risk" | "Map" | "Pound" | "Feedback" | "Team" | "Audit" | "Profile" | "Settings";

// signIn() reloads the page on success to re-run the auth-check effect fresh.
// That reload resets authMode back to its "landing" default before the effect
// can react to a rejected (pending/disabled) account, so the error it sets
// never had anywhere to render. This sessionStorage flag survives the reload
// and tells the effect the rejection should surface on the sign-in form
// instead of silently landing back on the marketing page.
const POST_SIGNIN_FLAG = "vt-post-signin-attempt";

const ROLE_LABELS: Record<string, string> = {
  client: "civilian account",
  bhw: "BHW account",
  admin: "administrator account",
  viewer: "viewer account",
};

function RoleBlocked({ role, message }: { role: string; message?: string }) {
  return (
    <div className="role-blocked">
      <div className="role-info-card">
        <ShieldCheck size={32} />
        <h3>Access restricted</h3>
        <p>{message ?? `This workspace is not available for ${role} accounts.`}</p>
        <p className="role-help">Contact a barangay administrator if you need elevated access.</p>
      </div>
    </div>
  );
}

type SupabaseError = { code?: string; message: string };
type SupabaseAuthResponse = { data: { user: { id: string; email?: string } | null }; error: SupabaseError | null };
type AccountStatus = "active" | "disabled" | "pending";

const breedOptions = [
  { id: 1, name: "Aspin", species: "Dog" },
  { id: 2, name: "Labrador", species: "Dog" },
  { id: 3, name: "Shih Tzu", species: "Dog" },
  { id: 4, name: "Pomeranian", species: "Dog" },
  { id: 5, name: "Persian", species: "Cat" },
  { id: 6, name: "Siamese", species: "Cat" },
  { id: 7, name: "Puspin", species: "Cat" },
  { id: 8, name: "Maine Coon", species: "Cat" },
];

const vaccineOptions = [
  "Rabisin (Anti-Rabies)",
  "Nobivac DHPPi (Dog Core 5-in-1)",
  "Purevax RCP (Cat Core Booster)",
  "Nobivac Rabies",
  "Vanguard Plus 5/L (Dog Core)",
];

const statusStyles: Record<Animal["status"], string> = {
  Vaccinated: "status-good",
  "Due soon": "status-warn",
  Overdue: "status-danger",
  "Not scheduled": "status-warn",
};

const poundStatusStyles: Record<PoundStatus, string> = {
  Impounded: "status-danger",
  "Under Observation": "status-warn",
  "Up for Adoption": "status-info",
  Reclaimed: "status-good",
};

function formatDueDate(nextDueDate: string | null) {
  if (!nextDueDate) return "Not scheduled";
  return new Date(`${nextDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function addMonths(dateStr: string, months: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatTodayLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "2-digit", year: "numeric" }).toUpperCase();
}

export interface UserNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [animalRecords, setAnimalRecords] = useState<Animal[]>([]);
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
  const [loginMode, setLoginMode] = useState<"email" | "username">("email");
  const [registrationForm, setRegistrationForm] = useState({ username: "", fullName: "", email: "", contact: "", password: "" });
  const [idImageFile, setIdImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", species: "Dog" as Animal["species"], classification: "Pet" as "Pet" | "Stray", neutered: "Not neutered" as "Neutered" | "Not neutered", breed: "", age: "", sex: "", color: "", owner: "", contact: "", impoundArea: "", purok: purokOptions[0].name, vaccineDate: "", vaccineType: vaccineOptions[0], nextDue: "", latitude: "", longitude: "", notes: "" });
  const pickerMapRef = useRef<LeafletMapHandle | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const skipNextLocationSearchRef = useRef(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("Last 6 months");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [reportRange, setReportRange] = useState({ from: "2026-01-01", to: "2026-12-31" });
  const [bulkMessage, setBulkMessage] = useState("Your animal's vaccination is due. Please visit the barangay health station.");
  const [bulkSent, setBulkSentState] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [poundQuery, setPoundQuery] = useState("");
  const [poundStatusFilter, setPoundStatusFilter] = useState<PoundStatus | "All">("All");
  const [poundError, setPoundError] = useState("");
  const supabaseConfigured = Boolean(createClient());

  // Role-based access helpers matching the RBAC matrix in supabase/schema.sql.
  // When Supabase is not configured we treat the workspace as fully offline
  // (role = admin) so every feature stays reachable. While a signed-in user's
  // profile is still resolving we optimistically treat them as staff so the
  // sidebar and actions do not flicker or disappear, then correct once the
  // real role arrives.
  const userRole: string = authUser?.role ?? (authUser ? "admin" : supabaseConfigured ? "viewer" : "admin");
  const isViewer = userRole === "viewer";
  const isClient = userRole === "client";
  const isStaff = ["admin", "bhw"].includes(userRole);
  const isAdmin = userRole === "admin";
  // Clients may register their own animals; staff may register any animal.
  // Offline mode (no Supabase) keeps the button visible for all roles.
  const canManageAnimals = isStaff || isClient || !isLive;

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
      queueMicrotask(() => setAuthChecked(true));
      return;
    }

    let justAttemptedSignIn = false;
    try {
      justAttemptedSignIn = sessionStorage.getItem(POST_SIGNIN_FLAG) === "1";
      sessionStorage.removeItem(POST_SIGNIN_FLAG);
    } catch {
      // sessionStorage can throw in private/locked-down browser contexts —
      // worst case we fall back to the pre-fix landing-page behavior.
    }

    let mounted = true;
    void supabase.auth.getUser().then(async ({ data: { user }, error }: SupabaseAuthResponse) => {
      if (!mounted) return;
      if (error || !user) {
        setAuthChecked(true);
        return;
      }

      // Profile and notifications only depend on user.id, so fetch both in the
      // same round trip instead of one after another (was adding a full extra
      // network hop to every page load).
      const [{ data: profile }, { data: notificationRows }] = await Promise.all([
        supabase.from("profiles").select("full_name, role, status").eq("id", user.id).maybeSingle(),
        supabase.from("notifications").select("id, title, message, type, is_read, created_at").eq("user_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;
      const status = (profile?.status ?? "pending") as AccountStatus;
      const resolvedRole = profile?.role ?? "viewer";
      if (status !== "active") {
        await supabase.auth.signOut();
        setAuthError(status === "pending" ? `Your ${ROLE_LABELS[resolvedRole] ?? "account"} is pending administrator verification.` : "This account is disabled. Contact the barangay administrator.");
        if (justAttemptedSignIn) setAuthMode("signin");
        setAuthChecked(true);
        return;
      }
      setAuthUser({ id: user.id, email: user.email ?? "", fullName: profile?.full_name ?? user.email ?? "VacciTrack user", role: resolvedRole, status });
      setAuthChecked(true);
      setNotifications((notificationRows ?? []) as UserNotification[]);

      // Clients only own their own records (RLS: user_id = auth.uid()). Querying
      // the full registry as a client returns nothing and can blank the UI, so
      // scope every query to the signed-in user for the client role.
      const isClientRole = resolvedRole === "client";
      const ownerId = user.id;

      const today = new Date();
      // Note: intentionally unbounded (no .limit()) — Registry, Map, and Risk
      // analysis all need the complete animal set, not just recent additions.
      const recentQuery = supabase.from("animals").select("id, name, species, classification, neutered, breed, age, sex, color, owner_name, contact_number, impound_area, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, notes, pound_status, puroks(name)").order("created_at", { ascending: false });

      const recentResult = await (isClientRole ? recentQuery.eq("user_id", ownerId) : recentQuery);
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
            classification: record.classification,
            neutered: record.neutered ?? undefined,
            breed: record.breed ?? undefined,
            age: record.age ?? undefined,
            sex: record.sex ?? undefined,
            color: record.color ?? undefined,
            owner: record.owner_name,
            vaccinated,
            vaccineDate: record.vaccine_date ?? null,
            purok: Array.isArray(record.puroks) ? record.puroks[0]?.name ?? "Unassigned" : record.puroks?.name ?? "Unassigned",
            status: getAnimalStatus(vaccinated, nextDueDate, today),
            nextDueDate,
            nextDue: formatDueDate(nextDueDate),
            contact: record.contact_number ?? "",
            impoundArea: record.impound_area ?? "",
            vaccineType: record.vaccine_type ?? undefined,
            latitude: record.latitude ?? undefined,
            longitude: record.longitude ?? undefined,
            notes: record.notes ?? undefined,
            poundStatus: record.pound_status ?? null,
          } satisfies Animal;
        });
      setAnimalRecords(records);
      setIsLive(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const validTabs: WorkspaceTab[] = ["Overview", "Registry", "Planning", "Reports", "Risk", "Map", "Pound", "Feedback", "Team", "Audit", "Profile", "Settings"];
    if (tabParam && (validTabs as string[]).includes(tabParam)) {
      queueMicrotask(() => setActiveTab(tabParam as WorkspaceTab));
    }
  }, []);

  useEffect(() => {
    if (!authUser || !isStaff) return;
    let mounted = true;
    void getTeamMembers().then((result) => {
      if (mounted && result.members) setTeamMembers(result.members);
    });
    return () => {
      mounted = false;
    };
  }, [authUser, isStaff]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setAuthError("");

    let email = authForm.email;

    if (loginMode === "username") {
      const { email: resolved, error: lookupError } = await resolveUsernameToEmail(authForm.email);
      if (lookupError || !resolved) {
        setAuthError(lookupError ?? "No account found with that username.");
        return;
      }
      email = resolved;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: authForm.password });
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setAuthError("The email or password is incorrect.");
      } else if (error.message.toLowerCase().includes("fetch") || error.message.toLowerCase().includes("network")) {
        setAuthError("The deployed app cannot reach Supabase. Check the Vercel Project URL and Publishable key, then redeploy.");
      } else {
        console.error("Supabase sign-in failed", { code: error.code, status: error.status, message: error.message });
        setAuthError(`Supabase sign-in error${error.code ? ` (${error.code})` : ""}: ${error.message}`);
      }
      return;
    }
    try {
      sessionStorage.setItem(POST_SIGNIN_FLAG, "1");
    } catch {
      // Best-effort — see the comment on POST_SIGNIN_FLAG's declaration.
    }
    window.location.reload();
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (!idImageFile) {
      setAuthError("Upload a photo of a valid ID for administrator verification.");
      return;
    }
    const body = new FormData();
    body.set("email", registrationForm.email);
    body.set("password", registrationForm.password);
    body.set("fullName", registrationForm.fullName);
    body.set("username", registrationForm.username);
    body.set("contact", registrationForm.contact);
    body.set("idImage", idImageFile);
    const { error } = await registerUser(body);
    if (error) {
      setAuthError(error);
      return;
    }
    setRegistrationSent(true);
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
  }

  async function readNotification(notificationId: number) {
    const result = await markNotificationRead(notificationId);
    if (!result.error) setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }

  async function readAllNotifications() {
    if (!authUser) return;
    const result = await markAllNotificationsRead(authUser.id);
    if (!result.error) setNotifications([]);
  }

  async function queueReminders() {
    setBulkSentState(false);
    const eligibleIds = reportAnimals
      .filter((animal) => (animal.status === "Due soon" || animal.status === "Overdue") && typeof animal.id === "number")
      .map((animal) => animal.id as number);
    const result = await queueVaccinationReminders(eligibleIds, bulkMessage);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setBulkSentState(true);
  }

  function setBulkSent(value: boolean) {
    setBulkSentState(value);
    if (value) void queueReminders();
  }

  const filteredAnimals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return animalRecords;
    return animalRecords.filter((animal) =>
      [animal.name, animal.owner, animal.purok, animal.species].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [animalRecords, query]);

  const dashboardStats = useMemo(() => ({
    registered: animalRecords.length,
    vaccinated: animalRecords.filter((animal) => animal.vaccinated).length,
    dueSoon: animalRecords.filter((animal) => animal.status === "Due soon").length,
    overdue: animalRecords.filter((animal) => animal.status === "Overdue").length,
  }), [animalRecords]);

  const riskRows = useMemo(() => purokOptions.map((purok) => {
    const purokName = purok.name;
    const records = animalRecords.filter((animal) => animal.purok === purokName);
    const vaccinated = records.filter((animal) => animal.vaccinated).length;
    const rate = records.length ? Math.round((vaccinated / records.length) * 100) : 0;
    return { purok: purokName, total: records.length, vaccinated, rate, risk: records.length === 0 ? "NO DATA" : rate < 50 ? "HIGH" : rate < 70 ? "MODERATE" : "LOW" };
  }), [animalRecords]);

  const reportAnimals = animalRecords.filter((animal) => {
    if (!animal.nextDueDate) return true;
    return animal.nextDueDate >= reportRange.from && animal.nextDueDate <= reportRange.to;
  });

  const reportSummary = useMemo(() => ({
    total: reportAnimals.length,
    vaccinated: reportAnimals.filter((animal) => animal.vaccinated).length,
    expiring: reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").length,
    impounded: reportAnimals.filter((animal) => animal.impoundArea).length,
  }), [reportAnimals]);

  const strayAnimals = useMemo(() => {
    const normalized = poundQuery.trim().toLowerCase();
    return animalRecords.filter((animal) => {
      if (animal.classification !== "Stray") return false;
      if (poundStatusFilter !== "All" && (animal.poundStatus ?? "Impounded") !== poundStatusFilter) return false;
      if (!normalized) return true;
      return [animal.name, animal.purok, animal.impoundArea].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [animalRecords, poundQuery, poundStatusFilter]);

  async function changePoundStatus(animalId: number | string, status: PoundStatus) {
    setPoundError("");
    const { error } = await updatePoundStatus(Number(animalId), status);
    if (error) {
      setPoundError(error);
      return;
    }
    setAnimalRecords((current) => current.map((animal) => (animal.id === animalId ? { ...animal, poundStatus: status } : animal)));
  }

  const chartMonths = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      const vaccinated = animalRecords.filter((animal) => animal.vaccineDate?.startsWith(key)).length;
      const coverage = animalRecords.length ? Math.round((vaccinated / animalRecords.length) * 100) : 0;
      return { label: month.toLocaleDateString("en-US", { month: "short" }), value: Math.max(0, Math.min(100, coverage)) };
    });
  }, [animalRecords]);

  useEffect(() => {
    const bars = document.querySelectorAll<HTMLElement>(".chart-panel .bar");
    const labels = document.querySelectorAll<HTMLElement>(".chart-panel .chart-x span");
    chartMonths.forEach((month, index) => {
      if (bars[index]) bars[index].style.height = `${month.value}%`;
      if (labels[index]) labels[index].textContent = month.label;
    });
  }, [chartMonths]);

  // Predictive place search for the location picker: debounce keystrokes and
  // drop stale results so a fast typist doesn't see an older query's matches
  // replace a newer one.
  useEffect(() => {
    if (skipNextLocationSearchRef.current) {
      skipNextLocationSearchRef.current = false;
      return;
    }
    const query = locationQuery.trim();
    if (query.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchLocation(query);
      if (!cancelled) {
        setLocationSuggestions(result.results ?? []);
        setIsSearchingLocation(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackMessage.trim()) return;
    const supabase = createClient();
    if (supabase && authUser) {
      const { error } = await supabase.from("feedback").insert({ user_id: authUser.id, category: "Suggestion", message: feedbackMessage.trim() });
      if (error) {
        setLoadError("Feedback could not be submitted. Please try again.");
        return;
      }
    }
    setFeedbackSent(true);
    setFeedbackMessage("");
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const result = await exportAnimalsCsv({ query: query.trim() || undefined });
      if ("error" in result && result.error) {
        setLoadError(result.error);
        return;
      }
      if (!("csv" in result)) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }
  
  if (supabaseConfigured && !authChecked) {
    return <main className="auth-shell"><section className="auth-card auth-loading"><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div><p className="heading-sub">Connecting to Supabase...</p></section></main>;
  }

  if (supabaseConfigured && authChecked && !authUser) {
    if (authMode === "landing") return <Landing isTransitioning={isPageTransitioning} onSignIn={() => { setAuthError(""); switchAuthMode("signin"); }} />;
    return <main className={`auth-shell ${isPageTransitioning ? "page-exit" : ""}`}><section className="auth-card page-enter" key={`${authMode}-${registrationSent}`}><button className="auth-back" onClick={() => { setAuthError(""); switchAuthMode("landing"); }}>← Back to VacciTrack</button><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>{authMode === "signin" ? <><p className="eyebrow">ROLE-BASED ACCESS</p><h1>Sign in to VacciTrack</h1><div className="auth-mode-toggle"><button className={`auth-mode-btn${loginMode === "email" ? " active" : ""}`} type="button" onClick={() => { setLoginMode("email"); setAuthError(""); setAuthForm({ email: "", password: "" }); }}>Email</button><button className={`auth-mode-btn${loginMode === "username" ? " active" : ""}`} type="button" onClick={() => { setLoginMode("username"); setAuthError(""); setAuthForm({ email: "", password: "" }); }}>Username</button></div><form className="auth-form" onSubmit={signIn}><label>{loginMode === "email" ? "Email" : "Username"}<input required type={loginMode === "email" ? "email" : "text"} autoComplete={loginMode === "email" ? "email" : "username"} placeholder={loginMode === "email" ? "Email Address" : "Username"} value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label><label>Password<input required type="password" autoComplete="current-password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Sign in</button></form><button className="auth-switch" onClick={() => { setAuthError(""); switchAuthMode("register"); }}>Create a civilian account</button></> : registrationSent ? <div className="confirmation"><CheckCircle2 size={30} /><h1>Registration submitted</h1><p>Your account has been created and is <strong>pending administrator approval</strong>. You will be able to sign in once an admin activates your account.</p><button className="primary-button" onClick={() => { setRegistrationSent(false); switchAuthMode("signin"); }}>Back to sign in</button></div> : <><p className="eyebrow">CIVILIAN ACCOUNT REQUEST</p><h1>Create your account</h1><p className="heading-sub">Public registration creates a civilian / pet-owner account. BHW, viewer, and administrator accounts are created by an administrator.</p><form className="auth-form" onSubmit={signUp}><label>Username<input required minLength={3} maxLength={80} value={registrationForm.username} onChange={(event) => setRegistrationForm({ ...registrationForm, username: event.target.value })} /></label><label>Full name<input required maxLength={120} value={registrationForm.fullName} onChange={(event) => setRegistrationForm({ ...registrationForm, fullName: event.target.value })} /></label><label>Email (optional)<input type="email" autoComplete="email" placeholder="you@example.com" value={registrationForm.email} onChange={(event) => setRegistrationForm({ ...registrationForm, email: event.target.value })} /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" placeholder="09171234567" value={registrationForm.contact} onChange={(event) => setRegistrationForm({ ...registrationForm, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} /></label><label>Valid ID photo<input required type="file" accept="image/*" onChange={(event) => setIdImageFile(event.target.files?.[0] ?? null)} /></label><label>Password<input required minLength={8} type="password" autoComplete="new-password" value={registrationForm.password} onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })} /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Submit for verification</button></form><button className="auth-switch" onClick={() => { setAuthError(""); switchAuthMode("signin"); }}>Already have an account? Sign in</button></>}</section></main>;
  }

  function selectTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    setShowMobileNav(false);
  }

  function pickCoordinates(lat: number, lng: number) {
    setForm((current) => ({ ...current, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormError("Location access is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        pickCoordinates(latitude, longitude);
        pickerMapRef.current?.flyTo(latitude, longitude, 16);
      },
      () => setFormError("Could not access your location. Pick a point on the map instead."),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  function selectLocationSuggestion(suggestion: LocationSuggestion) {
    pickCoordinates(suggestion.lat, suggestion.lon);
    pickerMapRef.current?.flyTo(suggestion.lat, suggestion.lon, 16);
    skipNextLocationSearchRef.current = true;
    setLocationQuery(suggestion.label);
    setLocationSuggestions([]);
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
      id: `local-${Date.now()}`,
      name: form.name.trim(),
      species: form.species,
      classification: form.classification,
      neutered: form.neutered === "Neutered",
      breed: form.breed.trim(),
      age: form.age ? Number(form.age) : undefined,
      sex: form.sex,
      color: form.color.trim(),
      owner: form.owner.trim(),
      purok: form.purok,
      vaccinated,
      status: getAnimalStatus(vaccinated, nextDueDate),
      nextDueDate,
      nextDue: formatDueDate(nextDueDate),
      contact: form.contact,
      impoundArea: form.impoundArea.trim(),
      vaccineType: form.vaccineType,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      notes: form.notes.trim(),
      poundStatus: form.classification === "Stray" ? "Impounded" : null,
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
        .insert({ name: fallbackRecord.name, species: form.species, classification: form.classification, neutered: form.neutered === "Neutered", breed: form.breed.trim() || null, age: form.age ? Number(form.age) : null, sex: form.sex || null, color: form.color.trim() || null, owner_name: fallbackRecord.owner, contact_number: form.contact, impound_area: form.impoundArea.trim() || null, purok_id: purok.id, vaccinated, vaccine_date: form.vaccineDate || null, vaccine_type: form.vaccineType || null, next_due_date: form.nextDue || null, latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null, notes: form.notes.trim() || null, pound_status: fallbackRecord.poundStatus, user_id: isClient && authUser ? authUser.id : null })
        .select("id")
        .single();
      if (error) {
        setFormError(error.code === "42501" ? "Your Supabase account is not allowed to register animals. Contact a barangay administrator." : error.message);
        setIsSaving(false);
        return;
      }
      fallbackRecord.id = data.id;
    }

    setAnimalRecords((current) => [fallbackRecord, ...current]);
    setForm({ name: "", species: "Dog", classification: "Pet", neutered: "Not neutered", breed: "", age: "", sex: "", color: "", owner: "", contact: "", impoundArea: "", purok: purokOptions[0].name, vaccineDate: "", vaccineType: vaccineOptions[0], nextDue: "", latitude: "", longitude: "", notes: "" });
    setShowRegister(false);
    setIsSaving(false);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania</div>
        <div className={`data-mode ${isLive ? "live" : "offline"}`}><span /> {isLive ? "Connected to Supabase" : "Not connected"}</div>
        <button className="sidebar-close" aria-label="Close navigation" onClick={() => setShowMobileNav(false)}><X size={18} /></button>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <button className={`nav-item ${activeTab === "Overview" ? "selected" : ""}`} onClick={() => selectTab("Overview")}><Activity size={17} /> Overview</button>
          {!isViewer && <button className={`nav-item ${activeTab === "Registry" ? "selected" : ""}`} onClick={() => selectTab("Registry")}><ClipboardList size={17} /> {isClient ? "My animals" : "Animal registry"} <span className="nav-count">{dashboardStats.registered}</span></button>}
          {isStaff && <button className={`nav-item ${activeTab === "Planning" ? "selected" : ""}`} onClick={() => selectTab("Planning")}><CalendarDays size={17} /> Vaccination planning</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Reports" ? "selected" : ""}`} onClick={() => selectTab("Reports")}><FileText size={17} /> Reports</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Risk" ? "selected" : ""}`} onClick={() => selectTab("Risk")}><ShieldCheck size={17} /> Risk analysis</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Map" ? "selected" : ""}`} onClick={() => selectTab("Map")}><MapPin size={17} /> Coverage map</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Pound" ? "selected" : ""}`} onClick={() => selectTab("Pound")}><HomeIcon size={17} /> Stray & pound</button>}
          <p className="nav-label nav-label-spaced">Management</p>
          <button className={`nav-item ${activeTab === "Feedback" ? "selected" : ""}`} onClick={() => selectTab("Feedback")}><MessageSquare size={17} /> Feedback</button>
          {isStaff && <button className={`nav-item ${activeTab === "Team" ? "selected" : ""}`} onClick={() => selectTab("Team")}><UsersRound size={17} /> Team members</button>}
          {isAdmin && <button className={`nav-item ${activeTab === "Audit" ? "selected" : ""}`} onClick={() => selectTab("Audit")}><ShieldCheck size={17} /> Audit log</button>}
        </nav>
      </aside>
      {showMobileNav && <div className="sidebar-backdrop" onClick={() => setShowMobileNav(false)} />}

      <section className="content-area">
        <header className="topbar"><button className="icon-button mobile-nav-toggle" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button><div className="crumb">Operations <span>/</span> {activeTab}</div><div className="top-actions">{authUser && <button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => { setShowNotifications((current) => !current); setShowAccountMenu(false); }}><Bell size={18} />{notifications.length > 0 && <span className="notification-dot" />}</button>}<div className="profile-menu-wrap"><button className="profile-button" aria-haspopup="menu" aria-expanded={showAccountMenu} onClick={() => { if (authUser) { setShowAccountMenu((current) => !current); setShowNotifications(false); } else { setActiveTab("Feedback"); } }}><CircleUserRound size={20} /> <span>{authUser ? authUser.fullName.slice(0, 2).toUpperCase() : "MC"}</span></button>{showAccountMenu && authUser && <div className="account-menu" role="menu"><button role="menuitem" onClick={() => router.push("/profile")}><CircleUserRound size={15} /> Manage my account</button><button role="menuitem" onClick={() => router.push("/settings")}><ShieldCheck size={15} /> Settings</button><button role="menuitem" onClick={signOut}><X size={15} /> Sign out</button></div>}</div></div>{showNotifications && authUser && <div className="notification-panel"><div className="notification-panel-head"><strong>Notifications</strong><button onClick={() => void readAllNotifications()}>Mark all read</button></div>{notifications.length === 0 ? <p className="notification-empty">You are all caught up.</p> : notifications.map((notification) => <button className="notification-item" key={notification.id} onClick={() => void readNotification(notification.id)}><span className={`notification-icon ${notification.type === "danger" ? "danger" : ""}`}><Bell size={15} /></span><span><strong>{notification.title}</strong><small>{notification.message}</small></span></button>)}</div>}</header>
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">{formatTodayLabel()}</p><h1>{activeTab === "Overview" ? `Good morning, ${authUser?.fullName.split(" ")[0] ?? "Maria"}.` : activeTab}</h1><p className="heading-sub">{activeTab === "Overview" ? "Here is what needs your attention across the barangay." : "Barangay Estefania animal health operations"}</p></div></div>

          {showNotice && <div className="notice"><div className="notice-icon"><Syringe size={19} /></div><div><strong>Vaccination coverage is at {dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}%</strong><p>{dashboardStats.dueSoon} animals are due for their next vaccination.</p></div>{isStaff && <button className="notice-action" onClick={() => setActiveTab("Planning")}>View plan <span>→</span></button>}<button className="notice-close" aria-label="Dismiss notice" onClick={() => setShowNotice(false)}>×</button></div>}

          {activeTab !== "Overview" && <section className="workspace-panel">
            {activeTab === "Registry" && (isViewer ? <RoleBlocked role={userRole} message="The animal registry is not available for viewer accounts. Viewers can access Overview and Feedback only." /> : <div className="module-content"><div className="module-intro"><div><p className="eyebrow">REGISTRY MANAGEMENT</p><h2>{isClient ? "My registered animals" : "All animal records"}</h2><p>{isClient ? "Review your registered pets and their vaccination schedules." : "Search, review, and register dogs and cats across every purok."}</p></div><div className="module-actions"><button className="secondary-button" onClick={handleExportCsv} disabled={isExporting}><FileText size={15} /> {isExporting ? "Exporting..." : isClient ? "Export my report" : "Export CSV"}</button>{canManageAnimals && <button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> New record</button>}</div></div><div className="search-box wide-search"><Search size={16} /><input aria-label="Search all animals" placeholder="Search name, civilian, purok, or species..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Civilian / contact</th><th>Pin area</th><th>Impound area</th><th>Next due</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={`module-${animal.id}`}><td><strong>{animal.name}</strong><small>{animal.species}</small></td><td>{animal.owner}<small>{animal.contact || "No contact"}</small></td><td>{animal.purok}</td><td>{animal.impoundArea || "—"}</td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No records found.</div>}</div></div>)}
            {activeTab === "Planning" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">PROGRAM PLANNING</p><h2>Vaccination plan</h2><p>Prioritize overdue animals and upcoming vaccination drives.</p></div><span className="module-chip"><CalendarDays size={14} /> 90-day view</span></div><div className="planning-grid"><div className="planning-list"><h3>Needs immediate action</h3>{animalRecords.filter((animal) => animal.status === "Overdue").map((animal) => <div className="planning-row" key={`overdue-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}{animalRecords.filter((animal) => animal.status === "Overdue").length === 0 && <p className="module-muted"><CheckCircle2 size={16} /> No overdue vaccinations.</p>}</div><div className="planning-list"><h3>Upcoming vaccinations</h3>{animalRecords.filter((animal) => animal.status === "Due soon").map((animal) => <div className="planning-row" key={`due-${animal.id}`}><span className="planning-icon warn"><CalendarDays size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}</div></div></div> : <RoleBlocked role={userRole} message="Vaccination planning is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Reports" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">REPORTING</p><h2>Vaccination report by date range</h2><p>Review coverage, expiring vaccinations, and impound cases within a selected period.</p></div><button className="secondary-button" onClick={() => window.print()}><FileText size={15} /> Print report</button></div><div className="report-controls"><label>From<input type="date" value={reportRange.from} onChange={(event) => setReportRange({ ...reportRange, from: event.target.value })} /></label><label>To<input type="date" min={reportRange.from} value={reportRange.to} onChange={(event) => setReportRange({ ...reportRange, to: event.target.value })} /></label></div>{reportRange.to < reportRange.from ? <p className="form-error">The end date must be on or after the start date.</p> : <><div className="report-grid"><article><strong>{reportSummary.total}</strong><span>Records in range</span></article><article><strong>{reportSummary.vaccinated}</strong><span>Vaccinated</span></article><article><strong>{reportSummary.expiring}</strong><span>Expired / due soon</span></article><article><strong>{reportSummary.impounded}</strong><span>In impound area</span></article></div><div className="planning-grid"><div className="planning-list"><h3>Expiry detection</h3>{reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").map((animal) => <div className="planning-row" key={`expiry-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name} — {animal.owner}</strong><small>{animal.contact || "No contact recorded"} · {animal.nextDue}</small></span><em>{animal.status}</em></div>)}</div><form className="planning-list" onSubmit={(event) => { event.preventDefault(); setBulkSent(true); }}><h3>Send reminder to many</h3><p className="heading-sub">Recipients: {reportAnimals.filter((animal) => (animal.status === "Due soon" || animal.status === "Overdue") && animal.contact).length} valid contacts</p><textarea required rows={4} value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} />{bulkSent && <p className="module-muted"><CheckCircle2 size={15} /> Reminder queue prepared for valid contacts.</p>}<button className="primary-button" type="submit"><Send size={15} /> Queue reminders</button></form></div></>}</div> : <RoleBlocked role={userRole} message="Reports are only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Risk" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">DECISION SUPPORT</p><h2>Risk analysis by purok</h2><p>Areas below 70% coverage need targeted follow-up.</p></div><span className="module-chip"><ShieldCheck size={14} /> 70% target</span></div><div className="risk-grid">{riskRows.map((row) => <article className={`risk-card risk-${row.risk.toLowerCase().replace(" ", "-")}`} key={row.purok}><div className="risk-card-head"><h3>{row.purok}</h3><span>{row.risk}</span></div><div className="risk-count"><strong>{row.rate}%</strong><small>{row.vaccinated} vaccinated of {row.total}</small></div><div className="progress"><span style={{ width: `${row.rate}%` }} /></div><p>{row.total === 0 ? "No animals registered in this purok." : row.rate < 70 ? `${Math.max(0, Math.ceil(row.total * .7) - row.vaccinated)} more needed to reach target.` : "Herd immunity target met."}</p></article>)}</div></div> : <RoleBlocked role={userRole} message="Risk analysis is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Map" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">GEOSPATIAL COVERAGE</p><h2>Barangay coverage map</h2><p>Use purok-level records to plan field visits and vaccination drives.</p></div><span className="module-chip"><MapPin size={14} /> {purokOptions.length} puroks monitored</span></div><LeafletMap animals={animalRecords.map((animal) => ({ id: animal.id, name: animal.name, species: animal.species, owner: animal.owner, purok: animal.purok, vaccinated: animal.vaccinated, status: animal.status, latitude: animal.latitude, longitude: animal.longitude }))} puroks={purokOptions} /><div className="map-legend"><span><i className="legend-dot good" /> Vaccinated</span><span><i className="legend-dot warn" /> Due soon</span><span><i className="legend-dot danger" /> Overdue</span></div></div> : <RoleBlocked role={userRole} message="Coverage map is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Pound" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">STRAY &amp; POUND</p><h2>Stray dog directory</h2><p>Track impounded and stray animals through intake, observation, and outcome.</p></div><span className="module-chip"><HomeIcon size={14} /> {strayAnimals.length} strays</span></div><div className="pound-filters"><div className="search-box"><Search size={16} /><input aria-label="Search strays" placeholder="Search name, purok, or impound area..." value={poundQuery} onChange={(event) => setPoundQuery(event.target.value)} /></div><select value={poundStatusFilter} onChange={(event) => setPoundStatusFilter(event.target.value as PoundStatus | "All")}><option value="All">All statuses</option>{POUND_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>{poundError && <p className="form-error">{poundError}</p>}{strayAnimals.length === 0 ? <div className="empty-state">No stray animals match the current filters.</div> : <div className="pound-grid">{strayAnimals.map((animal) => <article className="pound-card" key={`pound-${animal.id}`}><div className="pound-card-head"><h3>{animal.name}</h3><span className={`status ${poundStatusStyles[animal.poundStatus ?? "Impounded"]}`}><i />{animal.poundStatus ?? "Impounded"}</span></div><div className="pound-card-meta"><span>{animal.species} · {animal.purok}</span><span>{animal.impoundArea || "No impound area recorded"}</span></div><select className="pound-status-select" value={animal.poundStatus ?? "Impounded"} onChange={(event) => changePoundStatus(animal.id, event.target.value as PoundStatus)}>{POUND_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></article>)}</div>}</div> : <RoleBlocked role={userRole} message="Stray and pound records are only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Feedback" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SUPPORT CHANNEL</p><h2>Feedback and suggestions</h2><p>Send notes to the barangay animal health team.</p></div></div>{feedbackSent ? <div className="feedback-success"><CheckCircle2 size={22} /><div><strong>Feedback submitted</strong><p>Thank you. Your message has been recorded for review.</p></div><button className="secondary-button" onClick={() => setFeedbackSent(false)}>Send another</button></div> : <form className="feedback-form" onSubmit={submitFeedback}><label>Category<select><option>Suggestion</option><option>Complaint</option><option>Compliment</option></select></label><label>Message<textarea required rows={5} placeholder="Tell us how to improve our service." value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} /></label><button className="primary-button" type="submit"><MessageSquare size={16} /> Submit feedback</button></form>}</div>}
            {activeTab === "Team" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">MANAGEMENT</p><h2>Team members</h2><p>Staff access for the Barangay Estefania health team.</p></div></div><div className="team-list">{teamMembers.length === 0 ? <div className="empty-state">No staff accounts found.</div> : teamMembers.map((member) => <div className="team-row" key={member.id}><span className={`avatar${member.id === authUser?.id ? "" : " team-muted"}`}>{member.fullName.slice(0, 2).toUpperCase()}</span><span><strong>{member.fullName}{member.id === authUser?.id ? " (you)" : ""}</strong><small>{member.username ? `@${member.username}` : member.status}</small></span><em>{member.role}</em></div>)}</div></div> : <RoleBlocked role={userRole} message="Team members view is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Audit" && (isAdmin ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SECURITY</p><h2>Audit log</h2><p>Recent actions from this VacciTrack workspace.</p></div><span className="module-chip"><ShieldCheck size={14} /> Protected</span></div><AuditPanel /></div> : <RoleBlocked role={userRole} message="Audit log is only available for administrator accounts." />)}
            {activeTab === "Profile" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">ACCOUNT</p><h2>My profile</h2><p>Review the account details linked to this session.</p></div></div><div className="account-form"><label>Full name<input value={authUser?.fullName ?? ""} readOnly /></label><label>Email<input value={authUser?.email ?? ""} readOnly /></label><label>Role<input value={userRole} readOnly /></label><label>Account status<input value={authUser?.status ?? "active"} readOnly /></label><p className="module-muted">Use the admin panel to update account details or roles.</p></div></div>}
            {activeTab === "Settings" && <div className="module-content"><div className="module-intro"><div><p className="eyebrow">PREFERENCES</p><h2>Workspace settings</h2><p>Adjust how the VacciTrack workspace behaves for this session.</p></div></div><div className="account-form"><label>Default landing tab<select value={activeTab} onChange={() => undefined}><option>Overview</option></select></label><label>Coverage target<input type="number" defaultValue={70} min={0} max={100} readOnly /></label><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Reset session</button></div></div>}
          </section>}

          <div className={activeTab === "Overview" ? "" : "overview-hidden"}>
          <div className="stat-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><PawPrint size={18} /></span><span className="trend neutral">Total</span></div><p className="stat-number">{dashboardStats.registered}</p><p className="stat-label">Registered animals</p><div className="stat-foot">Current registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Syringe size={18} /></span><span className="trend neutral">Coverage</span></div><p className="stat-number">{dashboardStats.vaccinated}</p><p className="stat-label">Vaccinated animals</p><div className="stat-foot">{dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}% of total registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><CalendarDays size={18} /></span><span className="trend neutral">This month</span></div><p className="stat-number">{dashboardStats.dueSoon}</p><p className="stat-label">Due for vaccination</p><div className="stat-foot">Needs scheduling</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon red"><Bell size={18} /></span><span className="trend danger">Needs action</span></div><p className="stat-number">{dashboardStats.overdue}</p><p className="stat-label">Overdue vaccinations</p><div className="stat-foot">Review registry</div></article>
          </div>

          {isStaff && <div className="section-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Vaccination coverage</h2><p>Progress toward the 80% barangay target</p></div><select className="select-button chart-select" value={chartPeriod} onChange={(event) => setChartPeriod(event.target.value)}><option>Last 6 months</option><option>Last 12 months</option><option>This year</option></select></div><div className="chart-wrap"><div className="chart-y"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><div className="chart"><div className="target-line"><span>Target</span></div><div className="bars"><span className="bar" style={{ height: "47%" }} /><span className="bar" style={{ height: "54%" }} /><span className="bar" style={{ height: "59%" }} /><span className="bar" style={{ height: "64%" }} /><span className="bar" style={{ height: "69%" }} /><span className="bar current" style={{ height: "72%" }} /></div><div className="chart-x"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div><p className="chart-caption">Showing {chartPeriod.toLowerCase()} of barangay coverage.</p></section><section className="panel purok-panel"><div className="panel-heading"><div><h2>Coverage by purok</h2><p>Vaccinated animals / total</p></div><button className="text-button" onClick={() => setActiveTab("Risk")}>View all →</button></div><div className="purok-list">{riskRows.slice(0, 5).map((row) => <Coverage key={row.purok} name={row.purok} value={row.rate} count={`${row.vaccinated} / ${row.total}`} />)}</div></section></div>}

          <section className="panel registry-panel"><div className="panel-heading registry-heading"><div><h2>{isClient ? "Your recent registry activity" : "Recent registry activity"}</h2><p>{isClient ? "Pets you have registered and their vaccination schedules" : isLive ? "Latest 25 live animal records" : "Latest animal records and vaccination schedules"}</p></div><div className="registry-tools"><div className="search-box"><Search size={16} /><input aria-label="Search registry" placeholder="Search registry..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>{!isViewer && <button className="text-button" onClick={() => setActiveTab("Registry")}>View registry →</button>}</div></div>{loadError && <p className="form-error load-error">{loadError}</p>}<div className="table-wrap"><table><thead><tr><th>Animal</th><th>Owner</th><th>Purok</th><th>Next vaccination</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={animal.id}><td><div className="animal-cell"><span className="animal-avatar">{animal.species === "Dog" ? <Dog size={16} /> : <Cat size={16} />}</span><span><strong>{animal.name}</strong><small>{animal.species}</small></span></div></td><td>{animal.owner}</td><td><span className="location"><MapPin size={13} /> {animal.purok}</span></td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No animals match “{query}”.</div>}</div></section>
          </div>
        </div>
      </section>
      {showRegister && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRegister(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="modal-heading"><div><p className="eyebrow">NEW RECORD</p><h2 id="register-title">Register an animal</h2></div><button className="icon-button" aria-label="Close registration form" onClick={() => setShowRegister(false)}><X size={18} /></button></div><form className="animal-form" onSubmit={registerAnimal}><label>Animal name<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Bantay" /></label><label>Species<select value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value as Animal["species"], breed: "" })}><option>Dog</option><option>Cat</option></select></label><label>Classification<select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value as "Pet" | "Stray" })}><option>Pet</option><option>Stray</option></select></label><label>Neuter status<select value={form.neutered} onChange={(event) => setForm({ ...form, neutered: event.target.value as "Neutered" | "Not neutered" })}><option>Not neutered</option><option>Neutered</option></select></label><label>Breed<select value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })}><option value="">Select breed</option>{breedOptions.filter((breed) => breed.species === form.species).map((breed) => <option key={breed.id} value={breed.name}>{breed.name}</option>)}</select></label><label>Sex<input required maxLength={20} value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })} /></label><label>Age (months)<input type="number" min="0" max="360" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="e.g. 36" /></label><label>Color / markings<input maxLength={60} value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} placeholder="e.g. Brown" /></label><label>Civilian / owner name<input required maxLength={120} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Full name" /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="09171234567" /></label><label>Geospatial pin area<select value={form.purok} onChange={(event) => setForm({ ...form, purok: event.target.value })}>{purokOptions.map((purok) => <option key={purok.id} value={purok.name}>{purok.name}</option>)}</select></label><label>Impound area <small>(optional)</small><input maxLength={120} value={form.impoundArea} onChange={(event) => setForm({ ...form, impoundArea: event.target.value })} placeholder="e.g. Barangay kennel A" /></label><label>Last vaccination<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.vaccineDate} onChange={(event) => { const vaccineDate = event.target.value; setForm((current) => ({ ...current, vaccineDate, nextDue: vaccineDate ? addMonths(vaccineDate, 6) : "" })); }} /></label><label>Vaccine type<select value={form.vaccineType} onChange={(event) => setForm({ ...form, vaccineType: event.target.value })}>{vaccineOptions.map((vaccine) => <option key={vaccine} value={vaccine}>{vaccine}</option>)}</select></label><label>Next vaccination<input type="date" min={form.vaccineDate || undefined} value={form.nextDue} onChange={(event) => setForm({ ...form, nextDue: event.target.value })} /></label><div className="map-picker-field"><div className="map-picker-hint"><small>Search a place, click the map to drop a pin, or use your current location.</small><button type="button" className="secondary-button" onClick={useMyLocation}><MapPin size={13} /> Use my location</button></div><div className="map-picker-search"><Search size={14} /><input type="text" placeholder="Search for a place or address..." autoComplete="off" value={locationQuery} onChange={(event) => { const value = event.target.value; setLocationQuery(value); if (value.trim().length < 3) { setLocationSuggestions([]); setIsSearchingLocation(false); } else { setIsSearchingLocation(true); } }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (locationSuggestions[0]) selectLocationSuggestion(locationSuggestions[0]); } }} />{isSearchingLocation && <Loader2 size={14} className="admin-spin" />}{locationSuggestions.length > 0 && <ul className="map-picker-suggestions">{locationSuggestions.map((suggestion, index) => <li key={index}><button type="button" onClick={() => selectLocationSuggestion(suggestion)}>{suggestion.label}</button></li>)}</ul>}</div><LeafletMap animals={form.latitude && form.longitude ? [{ id: "picked", name: "Selected location", species: form.species, owner: form.owner || "—", purok: form.purok, vaccinated: false, status: "Pending", latitude: Number(form.latitude), longitude: Number(form.longitude) }] : []} puroks={purokOptions} pickMode onPickCoordinates={pickCoordinates} onMapReady={(handle) => { pickerMapRef.current = handle; }} /></div><label>Notes <small>(optional)</small><textarea rows={3} maxLength={400} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Temperament, medical notes, etc." /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>Cancel</button><button className="primary-button" disabled={isSaving}>{isSaving ? "Registering..." : "Register animal"}</button></div></form></section></div>}
    </main>
  );
}

function Coverage({ name, value, count }: { name: string; value: number; count: string }) {
  return <div className="coverage-row"><div className="coverage-meta"><span>{name}</span><strong>{count} <em>{value}%</em></strong></div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}

function Landing({ onSignIn, isTransitioning }: { onSignIn: () => void; isTransitioning: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <main className={`landing-page page-enter ${isTransitioning ? "page-exit" : ""}`}>
      <div className={`landing-nav-wrap${scrolled ? " scrolled" : ""}`}>
        <header className="landing-nav">
          <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="landing-brand-mark">✣</span>
            <span><strong>VacciTrack</strong><small>BRGY. ESTEFANIA</small></span>
          </button>
          <nav aria-label="Public navigation">
            <button className="landing-nav-action" onClick={onSignIn}>Sign in <span>→</span></button>
          </nav>
        </header>
      </div>
      <section className="landing-hero">
        <div className="landing-hero-image" />
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <div className="landing-kicker landing-kicker-light">● &nbsp; CLOUD-BASED &nbsp;·&nbsp; BARANGAY ESTEFANIA, BACOLOD CITY 6100</div>
          <h1>Animal Vaccination<br /><em>Monitoring System</em></h1>
          <p>Real-time tracking of immunization compliance for dogs and cats across every purok, with coverage reports and practical planning tools.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary-action" onClick={onSignIn}>Access the system <span>→</span></button>
          </div>
        </div>
      </section>
    </main>
  );
}
