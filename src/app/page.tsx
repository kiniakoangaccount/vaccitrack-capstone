"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Cat,
  CheckCircle2,
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  Dog,
  Eye,
  EyeOff,
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
import { resolveUsernameAuthIdentifier } from "./signin-action";
import { getResetChannels, requestPasswordReset, resetPasswordWithOtp } from "./forgot-password-actions";
import { exportAnimalsCsv } from "./audit-actions";
import { markAllNotificationsRead, markNotificationRead } from "./notification-actions";
import { queueVaccinationReminders } from "./reminder-actions";
import { updatePoundStatus, type PoundStatus } from "./pound-actions";
import { SmsComposer } from "./SmsComposer";
import { getTeamMembers, type TeamMember } from "./team-actions";
import { getFeedbackList, updateFeedbackStatus, type FeedbackItem } from "./feedback-actions";
import { createAppointment, getAppointments, updateAppointmentStatus, type AppointmentItem, type AppointmentStatus } from "./appointment-actions";
import { isWithinEstefaniaSearchArea, purokOptions, getAnimalStatus } from "@/lib/map-data";
import { DOG_BREEDS, CAT_BREEDS } from "@/lib/breed-data";
import { capitalizeFirstLetter } from "@/lib/animal-names";
import { VACCINE_DATA } from "@/lib/vaccine-data";
import { todayLocalIso } from "@/lib/dates";
import dynamic from "next/dynamic";
import type { LeafletMapHandle } from "./LeafletMap";
import type { VaccinationHistoryRow } from "./AnimalDetailPanel";
import ConfirmDialog from "./ConfirmDialog";
import SkeletonBlock from "./Skeleton";
import WorkspaceLoadingScreen from "./WorkspaceLoadingScreen";
import CreateUserAccountForm from "./CreateUserAccountForm";
import { createAdminManagedAccount } from "./user-account-actions";

function MapLoadingSkeleton() {
  return (
    <div className="leaflet-map-wrap map-loading-skeleton" role="status" aria-label="Loading map">
      <div className="leaflet-map-toolbar" aria-hidden="true">
        <SkeletonBlock className="map-loading-search" />
        <SkeletonBlock className="map-loading-toggle" />
        <SkeletonBlock className="map-loading-toggle map-loading-toggle-short" />
      </div>
      <SkeletonBlock className="map-loading-canvas" />
    </div>
  );
}

function AnimalDetailLoadingSkeleton() {
  return (
    <div className="modal-backdrop animal-detail-loading" role="status" aria-label="Loading animal details">
      <section className="modal animal-detail-modal animal-detail-loading-card" aria-hidden="true">
        <div className="animal-detail-loading-heading">
          <SkeletonBlock className="animal-loading-avatar" />
          <div>
            <SkeletonBlock className="animal-loading-title" />
            <SkeletonBlock className="animal-loading-subtitle" />
          </div>
        </div>
        <div className="animal-vaccination-status">
          <SkeletonBlock className="animal-loading-value" />
          <SkeletonBlock className="animal-loading-value" />
          <SkeletonBlock className="animal-loading-value" />
        </div>
        <div className="animal-detail-grid">
          <div className="animal-detail-fields">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="animal-loading-field">
                <SkeletonBlock className="animal-loading-label" />
                <SkeletonBlock className="animal-loading-field-value" />
              </div>
            ))}
          </div>
          <div>
            <SkeletonBlock className="animal-loading-history-title" />
            <SkeletonBlock className="animal-loading-history-row" />
            <SkeletonBlock className="animal-loading-history-row animal-loading-history-row-short" />
          </div>
        </div>
      </section>
    </div>
  );
}

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: MapLoadingSkeleton });
const AuditPanel = dynamic(() => import("./vaccitrack_super_hidden_admin/dashboard/AuditPanel"), {
  loading: () => (
    <div className="deferred-panel-status audit-deferred-skeleton" role="status" aria-label="Loading audit log">
      <SkeletonBlock className="audit-deferred-title" />
      <SkeletonBlock className="audit-deferred-line" />
      <SkeletonBlock className="audit-deferred-line audit-deferred-line-short" />
    </div>
  ),
});
const AnimalDetailPanel = dynamic(() => import("./AnimalDetailPanel"), {
  loading: AnimalDetailLoadingSkeleton,
});

const POUND_STATUSES: PoundStatus[] = ["Under Observation", "Up for Adoption", "Reclaimed"];

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
  imageReferences?: string[];
  imageUrls?: string[];
  imageLoadError?: string;
  poundStatus?: PoundStatus | null;
};

type AnimalFilters = { breed: string; species: string; owner: string; location: string; classification: string };

function matchesAnimalFilters(animal: Animal, filters: AnimalFilters): boolean {
  const breed = animal.breed?.trim() || "Unspecified";
  const owner = animal.owner.trim() || "Unspecified owner";
  const location = animal.purok?.trim() || "Unassigned";
  const classification = animal.classification ?? "Pet";
  return (filters.breed === "All" || breed === filters.breed)
    && (filters.species === "All" || animal.species === filters.species)
    && (filters.owner === "All" || owner === filters.owner)
    && (filters.location === "All" || location === filters.location)
    && (filters.classification === "All" || classification === filters.classification);
}

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
  image_references?: string[] | null;
  pound_status?: PoundStatus | null;
  puroks: { name: string } | { name: string }[] | null;
};

type WorkspaceTab = "Overview" | "Registry" | "Planning" | "Appointments" | "Reports" | "Risk" | "Map" | "Pound" | "Feedback" | "Team" | "SMS" | "Audit";
type ReportId = "animals" | "vaccinations" | "maps" | "pound";
type ReportTabId = ReportId | "all";
type ReportCell = string | number;

interface ReportTableData {
  title: string;
  headers: string[];
  rows: ReportCell[][];
  emptyMessage: string;
}

interface ReportData {
  id: ReportId;
  title: string;
  description: string;
  metrics: { label: string; value: string | number }[];
  tables: ReportTableData[];
}

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
type SupabaseAuthResponse = { data: { user: { id: string } | null }; error: SupabaseError | null };
type AccountStatus = "active" | "disabled" | "pending";


function firstVaccineFor(species: string): string {
  return VACCINE_DATA.find((vaccine) => vaccine.species === "Both" || vaccine.species === species)?.name ?? "";
}

const statusStyles: Record<Animal["status"], string> = {
  Vaccinated: "status-good",
  "Due soon": "status-warn",
  Overdue: "status-danger",
  "Not scheduled": "status-neutral",
};

function formatDueDate(nextDueDate: string | null) {
  if (!nextDueDate) return "Not scheduled";
  return new Date(`${nextDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatVaccineDate(vaccineDate?: string | null) {
  if (!vaccineDate) return "Not vaccinated";
  return new Date(`${vaccineDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const AGE_GROUP_ORDER = ["Under 1 year", "1–3 years", "3–7 years", "7+ years", "Unknown"];

const BREED_OPTIONS = [...DOG_BREEDS.map((name) => ({ name, species: "Dog" })), ...CAT_BREEDS.map((name) => ({ name, species: "Cat" }))].map((breed, index) => ({ id: index + 1, name: breed.name, species: breed.species }));

function ageGroupLabel(ageMonths?: number): string {
  if (ageMonths === undefined || ageMonths === null) return "Unknown";
  if (ageMonths < 12) return "Under 1 year";
  if (ageMonths < 36) return "1–3 years";
  if (ageMonths < 84) return "3–7 years";
  return "7+ years";
}

// Groups animals by an arbitrary key (breed, age group, vaccine type, ...)
// and reports vaccination coverage per group, reusing the same shape the
// purok-based riskRows/Coverage rows already use.
function summarizeReportDimension(animals: Animal[], keyFn: (animal: Animal) => string) {
  const breakdown = buildCoverageBreakdown(animals, keyFn);
  return breakdown.map((row) => ({ label: row.label, count: row.total, vaccinated: row.vaccinated, rate: row.rate }));
}

function buildCoverageBreakdown(animals: Animal[], keyFn: (animal: Animal) => string, order?: string[]) {
  const totals = new Map<string, { total: number; vaccinated: number }>();
  for (const animal of animals) {
    const key = keyFn(animal);
    const entry = totals.get(key) ?? { total: 0, vaccinated: 0 };
    entry.total += 1;
    if (animal.vaccinated) entry.vaccinated += 1;
    totals.set(key, entry);
  }
  const keys = order ? order.filter((key) => totals.has(key)) : Array.from(totals.keys()).sort();
  return keys.map((key) => {
    const { total, vaccinated } = totals.get(key)!;
    return { label: key, total, vaccinated, rate: total ? Math.round((vaccinated / total) * 100) : 0 };
  });
}

function buildPurokRiskRows(animals: Animal[], purokNames: string[]) {
  return purokNames.map((purokName) => {
    const records = animals.filter((animal) => animal.purok === purokName);
    const unvaccinated = records.filter((animal) => !animal.vaccinated).length;
    const vaccinated = records.length - unvaccinated;
    const dueSoon = records.filter((animal) => animal.status === "Due soon").length;
    const overdue = records.filter((animal) => animal.status === "Overdue").length;
    const notScheduled = records.filter((animal) => animal.status === "Not scheduled").length;
    const unvaccinatedRate = records.length ? Math.round((unvaccinated / records.length) * 100) : 0;
    const coverageRate = records.length ? 100 - unvaccinatedRate : 0;
    const maxUnvaccinatedAtTarget = records.length - Math.ceil(records.length * 0.7);
    const gapToTarget = Math.max(0, unvaccinated - maxUnvaccinatedAtTarget);
    const risk = records.length === 0 ? "NO DATA" : unvaccinated * 2 > records.length ? "HIGH" : unvaccinated * 10 > records.length * 3 ? "MODERATE" : "LOW";
    return { purok: purokName, total: records.length, vaccinated, unvaccinated, dueSoon, overdue, notScheduled, gapToTarget, coverageRate, unvaccinatedRate, risk };
  });
}

function ReportSectionView({ report }: { report: ReportData }) {
  return (
    <section className="report-section">
      <div className="report-section-heading">
        <h3>{report.title}</h3>
        <p>{report.description}</p>
      </div>
      <div className="report-grid">
        {report.metrics.map((metric) => (
          <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>
        ))}
      </div>
      {report.tables.map((table, tableIndex) => (
        <div className="report-table-block" key={`${report.id}-${table.title}`}>
          <h4>{table.title}</h4>
          <div className="table-wrap module-table report-data-table">
            <table>
              <thead><tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${report.id}-${tableIndex}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.rows.length === 0 && <div className="empty-state">{table.emptyMessage}</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

function ReportExportMenu({
  reports,
  selectedReportIds,
  onSelectedReportIdsChange,
  rangeInvalid,
  onPrint,
}: {
  reports: ReportData[];
  selectedReportIds: ReportId[];
  onSelectedReportIdsChange: (reportIds: ReportId[]) => void;
  rangeInvalid: boolean;
  onPrint: () => void;
}) {
  const selectedReports = reports.filter((report) => selectedReportIds.includes(report.id));
  const exportDisabled = selectedReports.length === 0 || (rangeInvalid && selectedReportIds.includes("vaccinations"));

  function exportReport(format: string) {
    if (!format || exportDisabled) return;
    if (format === "pdf") {
      onPrint();
      return;
    }
    if (format !== "word" && format !== "excel") return;

    const escapeHtml = (valueToEscape: string | number) => String(valueToEscape)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const reportHtml = selectedReports.map((report) => {
      const metrics = report.metrics.map((metric) => `<tr><th>${escapeHtml(metric.label)}</th><td>${escapeHtml(metric.value)}</td></tr>`).join("");
      const tables = report.tables.map((table) => {
        const headers = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
        const rows = table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
        const emptyRow = `<tr><td colspan="${table.headers.length}">${escapeHtml(table.emptyMessage)}</td></tr>`;
        return `<h3>${escapeHtml(table.title)}</h3><table><thead><tr>${headers}</tr></thead><tbody>${rows || emptyRow}</tbody></table>`;
      }).join("");
      return `<section><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p><table><tbody>${metrics}</tbody></table>${tables}</section>`;
    }).join("<hr>");
    const title = selectedReports.length === 1 ? selectedReports[0].title : "Selected VacciTrack reports";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#20352b}h1{font-size:24px}h2{font-size:20px;margin-top:28px}h3{font-size:16px;margin-top:20px}p{color:#53685d}table{border-collapse:collapse;width:100%;margin:12px 0 18px}th,td{border:1px solid #cbd8cf;padding:7px;text-align:left}th{background:#edf4ee}section{page-break-inside:avoid}</style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleDateString())}</p>${reportHtml}</body></html>`;
    const isWord = format === "word";
    const blob = new Blob(["\ufeff", html], { type: isWord ? "application/msword;charset=utf-8" : "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vaccitrack-${selectedReports.map((report) => report.id).join("-")}.${isWord ? "doc" : "xls"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report-export-controls no-print">
      <details className="report-export-picker">
        <summary>Reports to export ({selectedReports.length})</summary>
        <div className="report-export-options">
          <label>
            <input
              type="checkbox"
              checked={selectedReports.length === reports.length}
              onChange={(event) => onSelectedReportIdsChange(event.target.checked ? reports.map((report) => report.id) : [])}
            />
            All reports
          </label>
          {reports.map((report) => (
            <label key={report.id}>
              <input
                type="checkbox"
                checked={selectedReportIds.includes(report.id)}
                onChange={(event) => onSelectedReportIdsChange(
                  event.target.checked
                    ? [...selectedReportIds, report.id]
                    : selectedReportIds.filter((reportId) => reportId !== report.id),
                )}
              />
              {report.title}
            </label>
          ))}
        </div>
      </details>
      <select
        className="secondary-button report-export-select"
        aria-label="Export selected reports as"
        defaultValue=""
        disabled={exportDisabled}
        onChange={(event) => {
          exportReport(event.target.value);
          event.target.value = "";
        }}
      >
        <option value="" disabled>Export as</option>
        <option value="pdf">PDF</option>
        <option value="word">Word (.doc)</option>
        <option value="excel">Excel (.xls)</option>
      </select>
    </div>
  );
}

function addMonths(dateStr: string, months: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatTodayLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "2-digit", year: "numeric" }).toUpperCase();
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export interface UserNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// Shared by the initial load and the realtime refresh below, so both stay in
// sync with exactly the same query/mapping instead of two copies drifting.
async function loadAnimalRecords(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  isClientRole: boolean,
  ownerId: string
): Promise<Animal[] | null> {
  const today = new Date();
  // Note: intentionally unbounded (no .limit()) — Registry, Map, and Risk
  // analysis all need the complete animal set, not just recent additions.
  const recentQuery = supabase.from("animals").select("id, name, species, classification, neutered, breed, age, sex, color, owner_name, contact_number, impound_area, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, notes, image_references, pound_status, puroks(name)").order("created_at", { ascending: false });
  const recentResult = await (isClientRole ? recentQuery.eq("user_id", ownerId) : recentQuery);
  if (recentResult.error) return null;

  const records = (recentResult.data ?? []) as SupabaseAnimalRecord[];
  return records.map((record) => {
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
      imageReferences: record.image_references ?? [],
      poundStatus: record.pound_status ?? null,
    } satisfies Animal;
  });
}

async function loadRiskPurokNames(
  supabase: NonNullable<ReturnType<typeof createClient>>,
): Promise<string[] | null> {
  const { data, error } = await supabase.from("puroks").select("name").order("name");
  if (error) return null;
  const rows = (data ?? []) as { name: string | null }[];
  return rows.map((row) => row.name).filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
}

export default function Home({ initialAuthMode = "landing" }: { initialAuthMode?: "landing" | "signin" | "register" } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [animalRecords, setAnimalRecords] = useState<Animal[]>([]);
  const [riskPurokNames, setRiskPurokNames] = useState(() => purokOptions.map((purok) => purok.name));
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Overview");
  const [showNotice, setShowNotice] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [selectedRiskPurok, setSelectedRiskPurok] = useState<string | null>(null);
  const [vaccinationHistory, setVaccinationHistory] = useState<VaccinationHistoryRow[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [authUser, setAuthUser] = useState<{ id: string; fullName: string; role: string; status: AccountStatus } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"landing" | "signin" | "register" | "forgot">(initialAuthMode);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [registrationSent, setRegistrationSent] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [forgotForm, setForgotForm] = useState({ identifier: "", code: "", newPassword: "" });
  const [forgotError, setForgotError] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({ username: "", fullName: "", contact: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [idImageFile, setIdImageFile] = useState<File | null>(null);
  const [petImageFiles, setPetImageFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ name: "", species: "Dog" as Animal["species"], classification: "Pet" as "Pet" | "Stray", neutered: "Not neutered" as "Neutered" | "Not neutered", breed: "", age: "", sex: "", color: "", owner: "", contact: "", impoundArea: "", purok: purokOptions[0].name, vaccineDate: "", vaccineType: firstVaccineFor("Dog"), nextDue: "", latitude: "", longitude: "", notes: "" });
  const [customVaccines, setCustomVaccines] = useState<{ name: string; species: string }[]>([]);
  const pickerMapRef = useRef<LeafletMapHandle | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const skipNextLocationSearchRef = useRef(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("Suggestion");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackListError, setFeedbackListError] = useState("");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [appointmentForm, setAppointmentForm] = useState({ animalId: "", assignedTo: "", scheduledDate: "", notes: "" });
  const [appointmentError, setAppointmentError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<ReportTabId>("all");
  const [selectedReportIds, setSelectedReportIds] = useState<ReportId[]>(["animals", "vaccinations", "maps", "pound"]);
  const [reportRange, setReportRange] = useState({ from: "2026-01-01", to: "2026-12-31" });
  const [reportFilters, setReportFilters] = useState<AnimalFilters>({ breed: "All", species: "All", owner: "All", location: "All", classification: "All" });
  const [registryFilters, setRegistryFilters] = useState<AnimalFilters>({ breed: "All", species: "All", owner: "All", location: "All", classification: "All" });
  const [bulkMessage, setBulkMessage] = useState("Your animal's vaccination is due. Please visit the barangay health station.");
  const [bulkSent, setBulkSentState] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [poundQuery, setPoundQuery] = useState("");
  const [poundStatusFilter, setPoundStatusFilter] = useState<PoundStatus | "All">("All");
  const [poundError, setPoundError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void } | null>(null);
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
  const isBhw = userRole === "bhw";
  // Clients may register their own animals; staff may register any animal.
  // Offline mode (no Supabase) keeps the button visible for all roles.
  const canManageAnimals = isStaff || isClient || !isLive;

  function switchAuthMode(nextMode: "landing" | "signin" | "register" | "forgot") {
    if (nextMode === authMode || isPageTransitioning) return;
    if (nextMode === "register") {
      router.push("/register", { scroll: false });
      return;
    }
    setIsPageTransitioning(true);
    window.setTimeout(() => {
      setAuthMode(nextMode);
      setIsPageTransitioning(false);
      if (nextMode === "landing") router.push("/", { scroll: false });
      else if (nextMode === "signin") router.push("/signin", { scroll: false });
      // "forgot" has no dedicated bookmarkable route — it's only ever reached
      // via the sign-in screen's link, so just swap local state in place.
    }, 220);
  }

  // /signin and /register are real, bookmarkable URLs for the auth screens;
  // once a visit to one of them resolves into a signed-in session, send them
  // back to the dashboard at "/" instead of leaving them stranded on an
  // auth-only route.
  useEffect(() => {
    if (authUser && (pathname === "/signin" || pathname === "/register")) {
      router.replace("/");
    }
  }, [authUser, pathname, router]);

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
      setAuthUser({ id: user.id, fullName: profile?.full_name ?? "VacciTrack user", role: resolvedRole, status });
      setAuthChecked(true);
      setNotifications((notificationRows ?? []) as UserNotification[]);

      // Clients only own their own records (RLS: user_id = auth.uid()). Querying
      // the full registry as a client returns nothing and can blank the UI, so
      // scope every query to the signed-in user for the client role.
      const isClientRole = resolvedRole === "client";
      const ownerId = user.id;

      const records = await loadAnimalRecords(supabase, isClientRole, ownerId);
      if (!mounted) return;
      if (records === null) {
        setLoadError("Supabase could not load the registry.");
        return;
      }
      setAnimalRecords(records);
      setIsLive(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Keep the registry, risk analysis, and reports on the same live animal
  // snapshot. Realtime changes refresh immediately; polling covers missed
  // events and reconnects when the browser returns to the foreground.
  useEffect(() => {
    if (!authUser) return;
    const supabase = createClient();
    if (!supabase) return;

    let mounted = true;
    const refreshLiveData = async () => {
      if (document.visibilityState === "hidden") return;

      const isClientRole = authUser.role === "client";
      const ownerId = authUser.id;
      const [records, purokNames, { data: notificationRows }] = await Promise.all([
        loadAnimalRecords(supabase, isClientRole, ownerId),
        loadRiskPurokNames(supabase),
        supabase.from("notifications").select("id, title, message, type, is_read, created_at").eq("user_id", ownerId).eq("is_read", false).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;

      if (records) {
        setAnimalRecords(records);
      }
      if (purokNames) setRiskPurokNames(purokNames);
      setNotifications((notificationRows ?? []) as UserNotification[]);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshLiveData();
    };

    void refreshLiveData();
    const intervalId = window.setInterval(() => void refreshLiveData(), 30_000);
    window.addEventListener("focus", refreshLiveData);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const channel = supabase
      .channel(`animals-live-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "animals", ...(authUser.role === "client" ? { filter: `user_id=eq.${authUser.id}` } : {}) },
        () => { void refreshLiveData(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "puroks" },
        () => { void refreshLiveData(); },
      )
      .subscribe();

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshLiveData);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [authUser]);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const validTabs: WorkspaceTab[] = ["Overview", "Registry", "Planning", "Appointments", "Reports", "Risk", "Map", "Pound", "Feedback", "Team", "Audit"];
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

  useEffect(() => {
    if (!authUser || !isStaff) return;
    let mounted = true;
    void getFeedbackList().then((result) => {
      if (!mounted) return;
      if (result.items) setFeedbackItems(result.items);
      else if (result.error) setFeedbackListError(result.error);
    });
    return () => {
      mounted = false;
    };
  }, [authUser, isStaff]);

  useEffect(() => {
    if (!authUser || !isStaff) return;
    let mounted = true;
    void getAppointments().then((result) => {
      if (!mounted) return;
      if (result.items) setAppointments(result.items);
      else if (result.error) setAppointmentError(result.error);
    });
    return () => {
      mounted = false;
    };
  }, [authUser, isStaff]);

  // Vaccines added via Settings → "Vaccines" supplement
  // the built-in, species-tagged vaccine list below.
  useEffect(() => {
    if (!authUser) return;
    const supabase = createClient();
    if (!supabase) return;
    let mounted = true;
    void supabase.from("vaccines").select("name, species").then(({ data }: { data: { name: string; species: string }[] | null }) => {
      if (mounted && data) setCustomVaccines(data);
    });
    return () => {
      mounted = false;
    };
  }, [authUser]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setAuthError("");

    const { authIdentifier, error: lookupError } = await resolveUsernameAuthIdentifier(authForm.username.trim());
    if (lookupError || !authIdentifier) {
      setAuthError(lookupError ?? "No account found with that username.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: authIdentifier, password: authForm.password });
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setAuthError("The username or password is incorrect.");
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

  async function sendForgotCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotError("");
    setForgotBusy(true);
    const identifier = forgotForm.identifier.trim();
    const account = await getResetChannels(identifier);
    if (!account.found) {
      setForgotBusy(false);
      setForgotError("No account found with that username.");
      return;
    }
    if (!account.hasSms) {
      setForgotBusy(false);
      setForgotError("No valid mobile number on file for this account.");
      return;
    }
    const result = await requestPasswordReset(identifier);
    setForgotBusy(false);
    if (result.error) {
      setForgotError(result.error);
      return;
    }
    setForgotStep("verify");
  }

  async function submitForgotReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotError("");
    setForgotBusy(true);
    const result = await resetPasswordWithOtp(forgotForm.identifier.trim(), forgotForm.code.trim(), forgotForm.newPassword);
    setForgotBusy(false);
    if (result.error) {
      setForgotError(result.error);
      return;
    }
    setForgotStep("request");
    setForgotForm({ identifier: "", code: "", newPassword: "" });
    setAuthError("");
    switchAuthMode("signin");
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
      setAuthError("Choose a photo of yourself or use your camera.");
      return;
    }
    if (!acceptedTerms) {
      setAuthError("You must agree to the Terms and Conditions to register.");
      return;
    }
    const body = new FormData();
    body.set("password", registrationForm.password);
    body.set("fullName", registrationForm.fullName);
    body.set("username", registrationForm.username);
    body.set("contact", registrationForm.contact);
    body.set("profilePhoto", idImageFile);
    const { error } = await registerUser(body);
    if (error) {
      setAuthError(error);
      return;
    }
    setRegistrationSent(true);
  }

  function signOut() {
    setShowAccountMenu(false);
    setConfirmDialog({
      title: "Sign out",
      message: "Sign out of VacciTrack?",
      confirmLabel: "Sign out",
      onConfirm: async () => {
        setConfirmDialog(null);
        const supabase = createClient();
        if (supabase) await supabase.auth.signOut();
        window.location.reload();
      },
    });
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
    if (!value) {
      setBulkSentState(false);
      return;
    }
    const eligibleCount = reportAnimals.filter((animal) => (animal.status === "Due soon" || animal.status === "Overdue") && animal.contact).length;
    setConfirmDialog({
      title: "Send bulk reminder",
      message: `Send this reminder to ${eligibleCount} contact${eligibleCount === 1 ? "" : "s"}? This cannot be undone.`,
      confirmLabel: "Send reminder",
      onConfirm: () => {
        setConfirmDialog(null);
        setBulkSentState(true);
        void queueReminders();
      },
    });
  }

  const animalFilterOptions = useMemo(() => {
    const owners = new Map<string, number>();
    for (const animal of animalRecords) {
      const ownerName = animal.owner.trim() || "Unspecified owner";
      owners.set(ownerName, (owners.get(ownerName) ?? 0) + 1);
    }
    return {
      breeds: Array.from(new Set(animalRecords.map((animal) => animal.breed?.trim() || "Unspecified"))).sort((a, b) => a.localeCompare(b)),
      owners: Array.from(owners.entries()).sort(([a], [b]) => a.localeCompare(b)),
      locations: Array.from(new Set([...riskPurokNames, ...animalRecords.map((animal) => animal.purok?.trim() || "Unassigned")])).sort((a, b) => a.localeCompare(b)),
    };
  }, [animalRecords, riskPurokNames]);

  const filteredAnimals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return animalRecords;
    return animalRecords.filter((animal) =>
      [animal.name, animal.owner, animal.purok, animal.species].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [animalRecords, query]);

  const filteredRegistryAnimals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return animalRecords.filter((animal) => matchesAnimalFilters(animal, registryFilters)
      && (!normalized || [animal.name, animal.owner, animal.purok, animal.species].some((value) => value.toLowerCase().includes(normalized))));
  }, [animalRecords, query, registryFilters]);
  const activeRegistryFilterCount = Object.values(registryFilters).filter((value) => value !== "All").length;

  const dashboardStats = useMemo(() => ({
    registered: animalRecords.length,
    vaccinated: animalRecords.filter((animal) => animal.vaccinated).length,
    unvaccinated: animalRecords.filter((animal) => !animal.vaccinated).length,
    dueSoon: animalRecords.filter((animal) => animal.status === "Due soon").length,
    overdue: animalRecords.filter((animal) => animal.status === "Overdue").length,
  }), [animalRecords]);

  const riskRows = useMemo(() => buildPurokRiskRows(animalRecords, riskPurokNames), [animalRecords, riskPurokNames]);
  const dashboardRiskRows = useMemo(() => [...riskRows].sort((a, b) => b.unvaccinatedRate - a.unvaccinatedRate || b.unvaccinated - a.unvaccinated).slice(0, 5), [riskRows]);
  const dashboardAppointments = useMemo(() => {
    const today = todayLocalIso();
    return appointments
      .filter((appointment) => appointment.status === "Scheduled" && appointment.scheduledDate.slice(0, 10) >= today)
      .slice(0, 5);
  }, [appointments]);
  const selectedRiskRow = selectedRiskPurok ? riskRows.find((row) => row.purok === selectedRiskPurok) ?? null : null;
  const selectedRiskAnimals = selectedRiskPurok ? animalRecords.filter((animal) => animal.purok === selectedRiskPurok) : [];

  const riskSummary = useMemo(() => ({
    totalAnimals: animalRecords.length,
    overdue: animalRecords.filter((animal) => animal.status === "Overdue").length,
    dueSoon: animalRecords.filter((animal) => animal.status === "Due soon").length,
    notScheduled: animalRecords.filter((animal) => animal.status === "Not scheduled").length,
    aboveUnvaccinatedTarget: riskRows.filter((row) => row.total > 0 && row.unvaccinated * 10 > row.total * 3).length,
    highUnvaccinated: riskRows.filter((row) => row.risk === "HIGH").length,
  }), [animalRecords, riskRows]);

  const schedulableAnimals = useMemo(() => animalRecords.filter((animal) => animal.status === "Overdue" || animal.status === "Due soon"), [animalRecords]);

  const vaccineOptions = useMemo(() => {
    const extra = customVaccines.filter((custom) => !VACCINE_DATA.some((vaccine) => vaccine.name.toLowerCase() === custom.name.toLowerCase()));
    return [...VACCINE_DATA, ...extra];
  }, [customVaccines]);

  const filteredReportAnimals = useMemo(() => animalRecords.filter((animal) => matchesAnimalFilters(animal, reportFilters)), [animalRecords, reportFilters]);

  const { from: reportFrom, to: reportTo } = reportRange;
  const reportAnimals = reportTo < reportFrom ? [] : filteredReportAnimals.filter((animal) => {
    if (!animal.nextDueDate) return true;
    return animal.nextDueDate >= reportFrom && animal.nextDueDate <= reportTo;
  });

  const reportPurokNames = useMemo(() => reportFilters.location === "All"
    ? Array.from(new Set([...riskPurokNames, ...filteredReportAnimals.map((animal) => animal.purok?.trim() || "Unassigned")]))
    : [reportFilters.location], [riskPurokNames, filteredReportAnimals, reportFilters.location]);
  const reportRiskRows = useMemo(() => buildPurokRiskRows(filteredReportAnimals, reportPurokNames), [filteredReportAnimals, reportPurokNames]);
  const activeReportFilterCount = Object.values(reportFilters).filter((value) => value !== "All").length;

  const reportSummary = {
    total: reportAnimals.length,
    vaccinated: reportAnimals.filter((animal) => animal.vaccinated).length,
    expiring: reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").length,
    impounded: reportAnimals.filter((animal) => animal.impoundArea).length,
  };

  const coverageByBreed = buildCoverageBreakdown(reportAnimals, (animal) => animal.breed?.trim() || "Unspecified");
  const coverageByAgeGroup = buildCoverageBreakdown(reportAnimals, (animal) => ageGroupLabel(animal.age), AGE_GROUP_ORDER);
  const coverageByVaccine = buildCoverageBreakdown(reportAnimals, (animal) => animal.vaccineType?.trim() || "Not recorded");

  const reportByBreed = useMemo(() => summarizeReportDimension(reportAnimals, (animal) => animal.breed?.trim() || "Unknown"), [reportAnimals]);
  const reportByAge = useMemo(() => summarizeReportDimension(reportAnimals, (animal) => {
    const months = animal.age ?? -1;
    if (months < 0) return "Unknown";
    if (months < 12) return "0-11 months";
    if (months < 36) return "1-2 years";
    if (months < 84) return "3-6 years";
    if (months < 120) return "7-9 years";
    return "10+ years";
  }), [reportAnimals]);
  const reportByVaccine = useMemo(() => summarizeReportDimension(reportAnimals, (animal) => animal.vaccineType?.trim() || "Unknown"), [reportAnimals]);
  const reportByPurok = useMemo(() => summarizeReportDimension(reportAnimals, (animal) => animal.purok?.trim() || "Unassigned"), [reportAnimals]);

  const strayAnimals = useMemo(() => {
    const normalized = poundQuery.trim().toLowerCase();
    return animalRecords.filter((animal) => {
      if (animal.classification !== "Stray") return false;
      if (poundStatusFilter !== "All" && (animal.poundStatus ?? "Under Observation") !== poundStatusFilter) return false;
      if (!normalized) return true;
      return [animal.name, animal.purok, animal.impoundArea].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [animalRecords, poundQuery, poundStatusFilter]);

  const allStrayAnimals = useMemo(
    () => filteredReportAnimals.filter((animal) => (animal.classification ?? "Pet") === "Stray"),
    [filteredReportAnimals],
  );
  const animalsWithPins = filteredReportAnimals.filter((animal) => animal.latitude != null && animal.longitude != null);
  const reportSections: ReportData[] = [
      {
        id: "animals",
        title: "Animal report",
        description: "Registered animals, owners, and identifying details.",
        metrics: [
          { label: "Total animals", value: filteredReportAnimals.length },
          { label: "Dogs", value: filteredReportAnimals.filter((animal) => animal.species === "Dog").length },
          { label: "Cats", value: filteredReportAnimals.filter((animal) => animal.species === "Cat").length },
          { label: "Strays", value: allStrayAnimals.length },
        ],
        tables: [{
          title: "Animal registry",
          headers: ["Animal", "Species", "Classification", "Breed", "Age (months)", "Owner", "Contact", "Purok", "Vaccination status"],
          rows: filteredReportAnimals.map((animal) => [
            animal.name,
            animal.species,
            animal.classification ?? "Pet",
            animal.breed || "Not recorded",
            animal.age ?? "Not recorded",
            animal.owner,
            animal.contact || "Not recorded",
            animal.purok,
            animal.status,
          ]),
          emptyMessage: "No animal records are available.",
        }],
      },
      {
        id: "vaccinations",
        title: "Vaccination report",
        description: `Vaccination schedules and coverage from ${reportRange.from} to ${reportRange.to}.`,
        metrics: [
          { label: "Records in range", value: reportSummary.total },
          { label: "Vaccinated", value: reportSummary.vaccinated },
          { label: "Due soon / overdue", value: reportSummary.expiring },
          { label: "In impound", value: reportSummary.impounded },
        ],
        tables: [
          {
            title: "Vaccination schedule",
            headers: ["Animal", "Species", "Owner", "Purok", "Vaccine", "Last vaccinated", "Next due", "Status"],
            rows: reportAnimals.map((animal) => [
              animal.name,
              animal.species,
              animal.owner,
              animal.purok,
              animal.vaccineType || "Not recorded",
              animal.vaccineDate ? formatVaccineDate(animal.vaccineDate) : "Not recorded",
              animal.nextDue,
              animal.status,
            ]),
            emptyMessage: "No vaccination records match this date range.",
          },
          {
            title: "Coverage by breed",
            headers: ["Breed", "Animals", "Vaccinated", "Coverage"],
            rows: coverageByBreed.map((row) => [row.label, row.total, row.vaccinated, `${row.rate}%`]),
            emptyMessage: "No breed coverage data is available.",
          },
          {
            title: "Coverage by age group",
            headers: ["Age group", "Animals", "Vaccinated", "Coverage"],
            rows: coverageByAgeGroup.map((row) => [row.label, row.total, row.vaccinated, `${row.rate}%`]),
            emptyMessage: "No age group coverage data is available.",
          },
          {
            title: "Coverage by vaccine type",
            headers: ["Vaccine type", "Animals", "Vaccinated", "Coverage"],
            rows: coverageByVaccine.map((row) => [row.label, row.total, row.vaccinated, `${row.rate}%`]),
            emptyMessage: "No vaccine coverage data is available.",
          },
        ],
      },
      {
        id: "maps",
        title: "Map coverage report",
        description: "Purok-level vaccination coverage and animal locations recorded on the map.",
        metrics: [
          { label: "Puroks monitored", value: riskRows.length },
          { label: "Animals with map pins", value: animalsWithPins.length },
          { label: "Animals without map pins", value: filteredReportAnimals.length - animalsWithPins.length },
          { label: "Total animals", value: filteredReportAnimals.length },
        ],
        tables: [
          {
            title: "Coverage by purok",
            headers: ["Purok", "Animals", "Unvaccinated", "Unvaccinated rate", "Vaccinated", "Coverage", "Risk level"],
            rows: reportRiskRows.map((row) => [row.purok, row.total, row.unvaccinated, `${row.unvaccinatedRate}%`, row.vaccinated, `${row.coverageRate}%`, row.risk]),
            emptyMessage: "No purok coverage data is available.",
          },
          {
            title: "Animals with map pins",
            headers: ["Animal", "Species", "Purok", "Latitude", "Longitude", "Vaccination status"],
            rows: animalsWithPins.map((animal) => [
              animal.name,
              animal.species,
              animal.purok,
              animal.latitude ?? "Not recorded",
              animal.longitude ?? "Not recorded",
              animal.status,
            ]),
            emptyMessage: "No animals have map coordinates recorded.",
          },
        ],
      },
      {
        id: "pound",
        title: "Stray & pound report",
        description: "Stray animal intake, impound location, and current outcome status.",
        metrics: [
          { label: "Total strays", value: allStrayAnimals.length },
          { label: "Under observation", value: allStrayAnimals.filter((animal) => (animal.poundStatus ?? "Under Observation") === "Under Observation").length },
          { label: "Up for adoption", value: allStrayAnimals.filter((animal) => animal.poundStatus === "Up for Adoption").length },
          { label: "Reclaimed", value: allStrayAnimals.filter((animal) => animal.poundStatus === "Reclaimed").length },
        ],
        tables: [{
          title: "Stray and pound records",
          headers: ["Animal", "Species", "Owner / contact", "Purok", "Impound area", "Pound status", "Vaccination status"],
          rows: allStrayAnimals.map((animal) => [
            animal.name,
            animal.species,
            `${animal.owner} / ${animal.contact || "No contact"}`,
            animal.purok,
            animal.impoundArea || "Not recorded",
            animal.poundStatus ?? "Under Observation",
            animal.status,
          ]),
          emptyMessage: "No stray or pound records are available.",
        }],
      },
    ];
  const visibleReports = activeReportTab === "all"
    ? reportSections
    : reportSections.filter((report) => report.id === activeReportTab);

  async function changePoundStatus(animalId: number | string, status: PoundStatus) {
    setPoundError("");
    const { error } = await updatePoundStatus(Number(animalId), status);
    if (error) {
      setPoundError(error);
      return;
    }
    setAnimalRecords((current) => current.map((animal) => (animal.id === animalId ? { ...animal, poundStatus: status } : animal)));
  }

  async function openAnimalDetail(animal: Animal) {
    setSelectedAnimal(animal);
    setVaccinationHistory([]);
    const supabase = createClient();
    if (!supabase) return;
    if (animal.imageReferences?.length) {
      const { data, error } = await supabase.storage.from("animal-images").createSignedUrls(animal.imageReferences, 3600);
      if (error) {
        console.error("Could not load submitted pet photos:", error.message);
        setSelectedAnimal((current) => current?.id === animal.id ? { ...current, imageLoadError: "Submitted pet photos could not be loaded." } : current);
      } else {
        const imageUrls = (data ?? []).flatMap((image: { signedUrl?: string | null }) => image.signedUrl ? [image.signedUrl] : []);
        setSelectedAnimal((current) => current?.id === animal.id ? {
          ...current,
          imageUrls,
          imageLoadError: imageUrls.length < animal.imageReferences!.length ? "Some submitted pet photos could not be loaded." : undefined,
        } : current);
      }
    }
    const { data } = await supabase
      .from("vaccination_history")
      .select("id, vaccine_date, next_due_date, vaccine_type, administered_by, notes, created_at")
      .eq("animal_id", Number(animal.id))
      .order("vaccine_date", { ascending: false });
    setVaccinationHistory((data as VaccinationHistoryRow[]) ?? []);
  }

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
      const { error } = await supabase.from("feedback").insert({ user_id: authUser.id, category: feedbackCategory, message: feedbackMessage.trim() });
      if (error) {
        setLoadError("Feedback could not be submitted. Please try again.");
        return;
      }
    }
    setFeedbackSent(true);
    setFeedbackMessage("");
    setFeedbackCategory("Suggestion");
  }

  async function changeFeedbackStatus(id: number, status: "New" | "Reviewed" | "Resolved") {
    setFeedbackItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    const { error } = await updateFeedbackStatus(id, status);
    if (error) setFeedbackListError(error);
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppointmentError("");
    if (!appointmentForm.animalId || !appointmentForm.assignedTo || !appointmentForm.scheduledDate) return;

    const { error } = await createAppointment({
      animalId: Number(appointmentForm.animalId),
      assignedTo: appointmentForm.assignedTo,
      scheduledDate: appointmentForm.scheduledDate,
      notes: appointmentForm.notes.trim() || undefined,
    });
    if (error) {
      setAppointmentError(error);
      return;
    }
    setAppointmentForm({ animalId: "", assignedTo: "", scheduledDate: "", notes: "" });
    const result = await getAppointments();
    if (result.items) setAppointments(result.items);
  }

  async function changeAppointmentStatus(id: number, status: AppointmentStatus) {
    setAppointments((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    const { error } = await updateAppointmentStatus(id, status);
    if (error) setAppointmentError(error);
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const result = await exportAnimalsCsv({ query: query.trim() || undefined, filters: registryFilters });
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

  // Printing straight off the live view would capture the sidebar, topbar,
  // and interactive controls too, so this flags .no-print content to be
  // hidden for the duration of the print (see the .printing-report rules
  // in globals.css) instead of printing a screenshot of the whole page.
  function printReport() {
    document.body.classList.add("printing-report");
    document.body.classList.add("printing-selected-reports");
    window.print();
    document.body.classList.remove("printing-selected-reports");
    document.body.classList.remove("printing-report");
  }

  if (supabaseConfigured && !authChecked) {
    return <WorkspaceLoadingScreen />;
  }

  if (supabaseConfigured && authChecked && !authUser) {
    if (authMode === "landing") return <Landing isTransitioning={isPageTransitioning} onSignIn={() => { setAuthError(""); switchAuthMode("signin"); }} />;
    return <main className={`auth-shell ${isPageTransitioning ? "page-exit" : ""}`}><section className={`auth-card ${authMode === "register" ? "auth-card-register" : ""} page-enter`} key={`${authMode}-${registrationSent}`}><button className="auth-back" onClick={() => { setAuthError(""); switchAuthMode("landing"); }}>← Back to VacciTrack</button><div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>{authMode === "signin" ? <><p className="eyebrow">ROLE-BASED ACCESS</p><h1>Sign in to VacciTrack</h1><form className="auth-form" onSubmit={signIn}><label>Username<input required type="text" autoComplete="username" placeholder="Username" value={authForm.username} onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })} /></label><label>Password<div className="password-field"><input required type={showSigninPassword ? "text" : "password"} autoComplete="current-password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /><button type="button" className="password-toggle" aria-label={showSigninPassword ? "Hide password" : "Show password"} onClick={() => setShowSigninPassword((current) => !current)}>{showSigninPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Sign in</button></form><button className="auth-switch" type="button" onClick={() => { setAuthError(""); switchAuthMode("forgot"); }}>Forgot password?</button><button className="auth-switch" onClick={() => { setAuthError(""); switchAuthMode("register"); }}>Create a civilian account</button></> : authMode === "forgot" ? <><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1>{forgotStep === "request" ? <form className="auth-form" onSubmit={sendForgotCode}><label>Username<input required type="text" value={forgotForm.identifier} onChange={(event) => setForgotForm({ ...forgotForm, identifier: event.target.value })} /></label>{forgotError && <p className="form-error">{forgotError}</p>}<button className="primary-button" type="submit" disabled={forgotBusy}>{forgotBusy ? "Sending..." : "Send reset code"}</button></form> : <form className="auth-form" onSubmit={submitForgotReset}><p className="heading-sub">Enter the code sent via SMS.</p><label>Verification code<input required value={forgotForm.code} onChange={(event) => setForgotForm({ ...forgotForm, code: event.target.value })} /></label><label>New password<div className="password-field"><input required minLength={8} type={showForgotPassword ? "text" : "password"} autoComplete="new-password" value={forgotForm.newPassword} onChange={(event) => setForgotForm({ ...forgotForm, newPassword: event.target.value })} /><button type="button" className="password-toggle" aria-label={showForgotPassword ? "Hide password" : "Show password"} onClick={() => setShowForgotPassword((current) => !current)}>{showForgotPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{forgotError && <p className="form-error">{forgotError}</p>}<button className="primary-button" type="submit" disabled={forgotBusy}>{forgotBusy ? "Saving..." : "Reset password"}</button></form>}<button className="auth-switch" onClick={() => { setForgotError(""); setForgotStep("request"); setForgotForm({ identifier: "", code: "", newPassword: "" }); switchAuthMode("signin"); }}>Back to sign in</button></> : registrationSent ? <div className="confirmation"><CheckCircle2 size={30} /><h1>Registration submitted</h1><p>Your account has been created and is <strong>pending administrator approval</strong>. You will be able to sign in once an admin activates your account.</p><button className="primary-button" onClick={() => { setRegistrationSent(false); switchAuthMode("signin"); }}>Back to sign in</button></div> : <><p className="eyebrow">CIVILIAN ACCOUNT REQUEST</p><h1>Create your account</h1><p className="heading-sub">Public registration creates a civilian / pet-owner account. BHW, viewer, and administrator accounts are created by an administrator.</p><form className="auth-form" onSubmit={signUp}><label>Username<input required minLength={3} maxLength={80} value={registrationForm.username} onChange={(event) => setRegistrationForm({ ...registrationForm, username: event.target.value })} /></label><label>Full name<input required maxLength={120} value={registrationForm.fullName} onChange={(event) => setRegistrationForm({ ...registrationForm, fullName: event.target.value })} /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" placeholder="09171234567" value={registrationForm.contact} onChange={(event) => setRegistrationForm({ ...registrationForm, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} /></label><label>Valid ID photo<input required type="file" accept="image/*" onChange={(event) => setIdImageFile(event.target.files?.[0] ?? null)} /></label><label>Password<div className="password-field"><input required minLength={8} type={showRegisterPassword ? "text" : "password"} autoComplete="new-password" value={registrationForm.password} onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })} /><button type="button" className="password-toggle" aria-label={showRegisterPassword ? "Hide password" : "Show password"} onClick={() => setShowRegisterPassword((current) => !current)}>{showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><p className="terms-intro">Please review our <button type="button" className="terms-link" onClick={() => setShowTermsModal(true)}>Terms and Conditions</button> before registering.</p><label className="terms-check"><input required type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span className="terms-check-copy">I have read and agree to <span className="terms-agreement-phrase">the <button type="button" className="terms-link" onClick={(event) => { event.stopPropagation(); setShowTermsModal(true); }}>Terms and Conditions</button></span>.</span></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button" type="submit">Submit for verification</button></form><p className="auth-switch-row">Already have an account? <button type="button" className="auth-inline-link" onClick={() => { setAuthError(""); switchAuthMode("signin"); }}>Sign in</button></p></>}</section>{showTermsModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowTermsModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="terms-title"><div className="modal-heading"><div><p className="eyebrow">PLEASE READ</p><h2 id="terms-title">Terms and Conditions</h2></div><button className="icon-button" aria-label="Close Terms and Conditions" onClick={() => setShowTermsModal(false)}><X size={18} /></button></div><div className="terms-modal-body"><p>By registering, you confirm the information, contact number, and ID you submit are accurate, current, and belong to you. You are responsible for keeping your password confidential and for activity under your account.</p><p>This account is for registering your own animals and tracking their vaccination records. Civilian accounts are approved manually: your account stays pending, and may be rejected or later suspended, until an administrator verifies your ID and finds the submitted information accurate.</p><p>Data you provide — including owner, contact, animal, and location details — is used only for barangay animal health record-keeping, vaccination scheduling and outreach, and stray/pound tracking, and may be reviewed by BHW and administrator staff. Account actions may be logged for security and audit purposes.</p><p>Vaccination records kept here are for barangay monitoring only and do not replace an official veterinary certificate.</p></div><div className="modal-actions"><button type="button" className="primary-button" onClick={() => setShowTermsModal(false)}>Close</button></div></section></div>}</main>;
  }

  function selectTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    setShowMobileNav(false);
  }

  function pickCoordinates(lat: number, lng: number) {
    if (!isWithinEstefaniaSearchArea(lat, lng)) {
      setFormError("Choose a location within the Barangay Estefania map area.");
      return;
    }
    setFormError("");
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

    if (petImageFiles.length > 3 || petImageFiles.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setFormError("Choose up to 3 JPG, PNG, or WebP images, each smaller than 5MB.");
      setIsSaving(false);
      return;
    }

    const todayIso = todayLocalIso();
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
      name: capitalizeFirstLetter(form.name.trim()),
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
      poundStatus: form.classification === "Stray" ? "Under Observation" : null,
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
      if (petImageFiles.length > 0) {
        const ownerFolder = authUser?.id;
        if (!ownerFolder) {
          setFormError("Sign in again before uploading pet photos.");
          setIsSaving(false);
          return;
        }
        const imagePaths: string[] = [];
        for (const [index, file] of petImageFiles.entries()) {
          const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
          const path = `${ownerFolder}/${data.id}/${index + 1}-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("animal-images").upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
          if (uploadError) {
            if (imagePaths.length > 0) {
              const { error: cleanupError } = await supabase.storage.from("animal-images").remove(imagePaths);
              if (cleanupError) console.error("Could not remove uploaded animal photos after a failed upload:", cleanupError.message);
            }
            const { error: recordCleanupError } = await supabase.from("animals").delete().eq("id", data.id);
            if (recordCleanupError) console.error("Could not remove animal record after a failed photo upload:", recordCleanupError.message);
            setFormError("Could not upload the pet photos. Please try again.");
            setIsSaving(false);
            return;
          }
          imagePaths.push(path);
        }
        const { error: imageSaveError } = await supabase.from("animals").update({ image_references: imagePaths }).eq("id", data.id);
        if (imageSaveError) {
          const { error: cleanupError } = await supabase.storage.from("animal-images").remove(imagePaths);
          if (cleanupError) console.error("Could not remove uploaded animal photos after saving failed:", cleanupError.message);
          const { error: recordCleanupError } = await supabase.from("animals").delete().eq("id", data.id);
          if (recordCleanupError) console.error("Could not remove animal record after saving photos failed:", recordCleanupError.message);
          setFormError(`Could not save the pet photos: ${imageSaveError.message}`);
          setIsSaving(false);
          return;
        }
        fallbackRecord.imageReferences = imagePaths;
        const { data: signedImages, error: signedImagesError } = await supabase.storage.from("animal-images").createSignedUrls(imagePaths, 3600);
        if (signedImagesError) {
          console.error("Animal photos uploaded but could not be displayed:", signedImagesError.message);
        } else {
          fallbackRecord.imageUrls = (signedImages ?? []).flatMap((image: { signedUrl?: string | null }) => image.signedUrl ? [image.signedUrl] : []);
        }
      }
      if (authUser) {
        await supabase.from("audit_log").insert({
          user_id: authUser.id,
          action: "INSERT",
          table_name: "animals",
          record_id: data.id,
          notes: `Animal record "${fallbackRecord.name}" registered.`,
        });
      }
    }

    setAnimalRecords((current) => [fallbackRecord, ...current]);
    setPetImageFiles([]);
    setForm({ name: "", species: "Dog", classification: "Pet", neutered: "Not neutered", breed: "", age: "", sex: "", color: "", owner: "", contact: "", impoundArea: "", purok: purokOptions[0].name, vaccineDate: "", vaccineType: firstVaccineFor("Dog"), nextDue: "", latitude: "", longitude: "", notes: "" });
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
          {isStaff && <button className={`nav-item ${activeTab === "Appointments" ? "selected" : ""}`} onClick={() => selectTab("Appointments")}><CalendarClock size={17} /> Appointments</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Reports" ? "selected" : ""}`} onClick={() => selectTab("Reports")}><FileText size={17} /> Reports</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Risk" ? "selected" : ""}`} onClick={() => selectTab("Risk")}><ShieldCheck size={17} /> Risk analysis</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Map" ? "selected" : ""}`} onClick={() => selectTab("Map")}><MapPin size={17} /> Coverage map</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Pound" ? "selected" : ""}`} onClick={() => selectTab("Pound")}><HomeIcon size={17} /> Stray & pound</button>}
          <p className="nav-label nav-label-spaced">Management</p>
          {(isClient || isStaff) && <button className={`nav-item ${activeTab === "Feedback" ? "selected" : ""}`} onClick={() => selectTab("Feedback")}><MessageSquare size={17} /> Feedback</button>}
          {isStaff && <button className={`nav-item ${activeTab === "Team" ? "selected" : ""}`} onClick={() => selectTab("Team")}><UsersRound size={17} /> Team members</button>}
          {isStaff && <button className={`nav-item ${activeTab === "SMS" ? "selected" : ""}`} onClick={() => selectTab("SMS")}><Send size={17} /> SMS messaging</button>}
          {isAdmin && <button className={`nav-item ${activeTab === "Audit" ? "selected" : ""}`} onClick={() => selectTab("Audit")}><ShieldCheck size={17} /> Audit log</button>}
        </nav>
      </aside>
      {showMobileNav && <div className="sidebar-backdrop" onClick={() => setShowMobileNav(false)} />}

      <section className="content-area">
        <header className="topbar"><button className="icon-button mobile-nav-toggle" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button><div className="crumb">Operations <span>/</span> {activeTab}</div><div className="top-actions">{authUser && <button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => { setShowNotifications((current) => !current); setShowAccountMenu(false); }}><Bell size={18} />{notifications.length > 0 && <span className="notification-dot" />}</button>}<div className="profile-menu-wrap"><button className="profile-button" aria-haspopup="menu" aria-expanded={showAccountMenu} onClick={() => { if (authUser) { setShowAccountMenu((current) => !current); setShowNotifications(false); } else { setActiveTab("Feedback"); } }}><CircleUserRound size={20} /> <span>{authUser ? authUser.fullName.slice(0, 2).toUpperCase() : "MC"}</span></button>{showAccountMenu && authUser && <div className="account-menu" role="menu"><button role="menuitem" onClick={() => router.push("/profile")}><CircleUserRound size={15} /> Manage my account</button><button role="menuitem" onClick={() => router.push("/settings")}><ShieldCheck size={15} /> Settings</button><button role="menuitem" onClick={signOut}><X size={15} /> Sign out</button></div>}</div></div>{showNotifications && authUser && <div className="notification-panel"><div className="notification-panel-head"><strong>Notifications</strong><button onClick={() => void readAllNotifications()}>Mark all read</button></div>{notifications.length === 0 ? <p className="notification-empty">You are all caught up.</p> : notifications.map((notification) => <button className="notification-item" key={notification.id} onClick={() => void readNotification(notification.id)}><span className={`notification-icon ${notification.type === "danger" ? "danger" : ""}`}><Bell size={15} /></span><span><strong>{notification.title}</strong><small>{notification.message}</small></span></button>)}</div>}</header>
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">{formatTodayLabel()}</p><h1>{activeTab === "Overview" ? `${getTimeGreeting()}, ${authUser?.fullName.split(" ")[0] ?? "Maria"}.` : activeTab}</h1><p className="heading-sub">{activeTab === "Overview" ? "Here is what needs your attention across the barangay." : "Barangay Estefania animal health operations"}</p></div></div>

          {showNotice && <div className="notice"><div className="notice-icon"><Syringe size={19} /></div><div><strong>Vaccination coverage is at {dashboardStats.registered ? Math.round((dashboardStats.vaccinated / dashboardStats.registered) * 100) : 0}%</strong><p>{dashboardStats.dueSoon} animals are due for their next vaccination.</p></div>{isStaff && <button type="button" className="notice-action" onClick={() => selectTab("Planning")}>View plan <span>→</span></button>}<button className="notice-close" aria-label="Dismiss notice" onClick={() => setShowNotice(false)}>×</button></div>}

          {activeTab !== "Overview" && <section className="workspace-panel">
            {activeTab === "Registry" && (isViewer ? <RoleBlocked role={userRole} message="The animal registry is not available for viewer accounts. Viewers can access Overview and Feedback only." /> : <div className="module-content">
              <div className="module-intro">
                <div><p className="eyebrow">REGISTRY MANAGEMENT</p><h2>{isClient ? "My registered animals" : "All animal records"}</h2><p>{isClient ? "Review your registered pets and their vaccination schedules." : "Search, review, and register dogs and cats across every purok."}</p></div>
                <div className="module-actions"><button className="secondary-button" onClick={handleExportCsv} disabled={isExporting}><FileText size={15} /> {isExporting ? "Exporting..." : isClient ? "Export my report" : "Export CSV"}</button>{canManageAnimals && <button className="primary-button" onClick={() => setShowRegister(true)}><Plus size={17} /> New record</button>}</div>
              </div>
              <div className="search-box wide-search"><Search size={16} /><input aria-label="Search all animals" placeholder="Search name, civilian, purok, or species..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
              <div className="registry-filter-controls" aria-label="Filter animal registry">
                <label>Breed<select value={registryFilters.breed} onChange={(event) => setRegistryFilters({ ...registryFilters, breed: event.target.value })}><option value="All">All breeds</option>{animalFilterOptions.breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}</select></label>
                <label>Species<select value={registryFilters.species} onChange={(event) => setRegistryFilters({ ...registryFilters, species: event.target.value })}><option value="All">All species</option><option value="Dog">Dogs</option><option value="Cat">Cats</option></select></label>
                <label>Owner (pets)<select value={registryFilters.owner} onChange={(event) => setRegistryFilters({ ...registryFilters, owner: event.target.value })}><option value="All">All owners</option>{animalFilterOptions.owners.map(([owner, count]) => <option key={owner} value={owner}>{owner} ({count} {count === 1 ? "pet" : "pets"})</option>)}</select></label>
                <label>Location / purok<select value={registryFilters.location} onChange={(event) => setRegistryFilters({ ...registryFilters, location: event.target.value })}><option value="All">All locations</option>{animalFilterOptions.locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
                <label>Classification<select value={registryFilters.classification} onChange={(event) => setRegistryFilters({ ...registryFilters, classification: event.target.value })}><option value="All">Pets and strays</option><option value="Pet">Pets</option><option value="Stray">Strays</option></select></label>
                {activeRegistryFilterCount > 0 && <button type="button" className="secondary-button registry-clear-filters" onClick={() => setRegistryFilters({ breed: "All", species: "All", owner: "All", location: "All", classification: "All" })}>Clear filters ({activeRegistryFilterCount})</button>}
              </div>
              <p className="registry-filter-count" role="status" aria-live="polite">Showing {filteredRegistryAnimals.length} of {animalRecords.length} animals{query.trim() ? " matching the search and selected filters." : " matching the selected filters."}</p>
              <div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Civilian / contact</th><th>Pin area</th><th>Impound area</th><th>Last vaccinated</th><th>Next due</th><th>Status</th></tr></thead><tbody>{filteredRegistryAnimals.map((animal) => <tr key={`module-${animal.id}`} className="row-clickable" onClick={() => openAnimalDetail(animal)}><td><strong>{animal.name}</strong><small>{animal.species}</small></td><td>{animal.owner}<small>{animal.contact || "No contact"}</small></td><td>{animal.purok}</td><td>{animal.impoundArea || "—"}</td><td>{formatVaccineDate(animal.vaccineDate)}</td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredRegistryAnimals.length === 0 && <div className="empty-state">No animal records match the search and filters.</div>}</div>
            </div>)}
            {activeTab === "Planning" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">PROGRAM PLANNING</p><h2>Vaccination plan</h2><p>Prioritize overdue animals and upcoming vaccination drives.</p></div><span className="module-chip"><CalendarDays size={14} /> 90-day view</span></div><div className="planning-grid"><div className="planning-list"><h3>Needs immediate action</h3>{animalRecords.filter((animal) => animal.status === "Overdue").map((animal) => <div className="planning-row" key={`overdue-${animal.id}`}><span className="planning-icon danger"><Bell size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}{animalRecords.filter((animal) => animal.status === "Overdue").length === 0 && <p className="module-muted"><CheckCircle2 size={16} /> No overdue vaccinations.</p>}</div><div className="planning-list"><h3>Upcoming vaccinations</h3>{animalRecords.filter((animal) => animal.status === "Due soon").map((animal) => <div className="planning-row" key={`due-${animal.id}`}><span className="planning-icon warn"><CalendarDays size={15} /></span><span><strong>{animal.name}</strong><small>{animal.owner} · {animal.purok}</small></span><em>{animal.nextDue}</em></div>)}</div></div></div> : <RoleBlocked role={userRole} message="Vaccination planning is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Appointments" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">CLINIC WORKFLOW</p><h2>Vaccination appointments</h2><p>Schedule upcoming vaccination visits and assign them to a BHW or admin staff member.</p></div></div><form className="feedback-form" onSubmit={submitAppointment}><label>Animal<select required value={appointmentForm.animalId} onChange={(event) => setAppointmentForm({ ...appointmentForm, animalId: event.target.value })}><option value="">Select an animal needing vaccination</option>{schedulableAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name} — {animal.owner} ({animal.purok})</option>)}</select></label><label>Assign to<select required value={appointmentForm.assignedTo} onChange={(event) => setAppointmentForm({ ...appointmentForm, assignedTo: event.target.value })}><option value="">Select staff</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>)}</select></label><label>Scheduled date<input required type="date" min={todayLocalIso()} value={appointmentForm.scheduledDate} onChange={(event) => setAppointmentForm({ ...appointmentForm, scheduledDate: event.target.value })} /></label><label>Notes <small>(optional)</small><textarea rows={3} value={appointmentForm.notes} onChange={(event) => setAppointmentForm({ ...appointmentForm, notes: event.target.value })} /></label>{appointmentError && <p className="form-error">{appointmentError}</p>}<button className="primary-button" type="submit"><CalendarClock size={16} /> Schedule appointment</button></form><div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Owner</th><th>Assigned to</th><th>Scheduled date</th><th>Status</th></tr></thead><tbody>{appointments.map((appointment) => <tr key={`appt-${appointment.id}`}><td>{appointment.animalName}</td><td>{appointment.ownerName}</td><td>{appointment.assignedName}</td><td>{formatVaccineDate(appointment.scheduledDate)}</td><td><select className="pound-status-select" value={appointment.status} onChange={(event) => void changeAppointmentStatus(appointment.id, event.target.value as AppointmentStatus)}><option>Scheduled</option><option>Completed</option><option>Missed</option><option>Cancelled</option></select></td></tr>)}</tbody></table>{appointments.length === 0 && <div className="empty-state">No appointments scheduled yet.</div>}</div></div> : <RoleBlocked role={userRole} message="Appointments are only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Reports" && (isStaff ? (
              <div className="module-content report-module">
                <div className="module-intro">
                  <div>
                    <p className="eyebrow">REPORTING</p>
                    <h2>Animal health reports</h2>
                    <p>View separate reports for animals, vaccinations, map coverage, and stray/pound records.</p>
                    <p className="report-period">Vaccination period: {reportRange.from} to {reportRange.to}</p>
                  </div>
                  <ReportExportMenu
                    reports={reportSections}
                    selectedReportIds={selectedReportIds}
                    onSelectedReportIdsChange={setSelectedReportIds}
                    rangeInvalid={reportRange.to < reportRange.from}
                    onPrint={printReport}
                  />
                </div>
                <div className="report-tabs no-print" role="group" aria-label="Report categories">
                  {([
                    { id: "all", label: "All reports" },
                    { id: "animals", label: "Animals" },
                    { id: "vaccinations", label: "Vaccinations" },
                    { id: "maps", label: "Map coverage" },
                    { id: "pound", label: "Stray & pound" },
                  ] as { id: ReportTabId; label: string }[]).map((tab) => (
                    <button
                      type="button"
                      aria-pressed={activeReportTab === tab.id}
                      className={`report-tab ${activeReportTab === tab.id ? "selected" : ""}`}
                      key={tab.id}
                      onClick={() => setActiveReportTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="report-controls no-print">
                  <label>Vaccination report from<input type="date" value={reportRange.from} onChange={(event) => setReportRange({ ...reportRange, from: event.target.value })} /></label>
                  <label>To<input type="date" min={reportRange.from} value={reportRange.to} onChange={(event) => setReportRange({ ...reportRange, to: event.target.value })} /></label>
                  <label>Breed<select value={reportFilters.breed} onChange={(event) => setReportFilters({ ...reportFilters, breed: event.target.value })}><option value="All">All breeds</option>{animalFilterOptions.breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}</select></label>
                  <label>Species<select value={reportFilters.species} onChange={(event) => setReportFilters({ ...reportFilters, species: event.target.value })}><option value="All">All species</option><option value="Dog">Dogs</option><option value="Cat">Cats</option></select></label>
                  <label>Owner (pets)<select value={reportFilters.owner} onChange={(event) => setReportFilters({ ...reportFilters, owner: event.target.value })}><option value="All">All owners</option>{animalFilterOptions.owners.map(([owner, count]) => <option key={owner} value={owner}>{owner} ({count} {count === 1 ? "pet" : "pets"})</option>)}</select></label>
                  <label>Location / purok<select value={reportFilters.location} onChange={(event) => setReportFilters({ ...reportFilters, location: event.target.value })}><option value="All">All locations</option>{animalFilterOptions.locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
                  <label>Classification<select value={reportFilters.classification} onChange={(event) => setReportFilters({ ...reportFilters, classification: event.target.value })}><option value="All">Pets and strays</option><option value="Pet">Pets</option><option value="Stray">Strays</option></select></label>
                  {activeReportFilterCount > 0 && <button type="button" className="secondary-button report-clear-filters" onClick={() => setReportFilters({ breed: "All", species: "All", owner: "All", location: "All", classification: "All" })}>Clear filters ({activeReportFilterCount})</button>}
                </div>
                <p className="report-filter-count no-print" role="status" aria-live="polite">Showing {filteredReportAnimals.length} of {animalRecords.length} animals matching the selected filters. Owner selection includes all pets registered to that owner.</p>
                {reportRange.to < reportRange.from && (activeReportTab === "all" || activeReportTab === "vaccinations") && <p className="form-error">The end date must be on or after the start date.</p>}
                <div className="report-current-view">
                  {visibleReports.map((report) => <ReportSectionView key={report.id} report={report} />)}
                </div>
                {(activeReportTab === "all" || activeReportTab === "vaccinations") && (
                  <div className="planning-grid no-print">
                    <div className="planning-list">
                      <h3>Expiry detection</h3>
                      {reportAnimals.filter((animal) => animal.status === "Due soon" || animal.status === "Overdue").map((animal) => (
                        <div className="planning-row" key={`expiry-${animal.id}`}>
                          <span className="planning-icon danger"><Bell size={15} /></span>
                          <span><strong>{animal.name} — {animal.owner}</strong><small>{animal.contact || "No contact recorded"} · {animal.nextDue}</small></span>
                          <em>{animal.status}</em>
                        </div>
                      ))}
                    </div>
                    <form className="planning-list" onSubmit={(event) => { event.preventDefault(); setBulkSent(true); }}>
                      <h3>Send reminder to many</h3>
                      <p className="heading-sub">Recipients: {reportAnimals.filter((animal) => (animal.status === "Due soon" || animal.status === "Overdue") && animal.contact).length} valid contacts</p>
                      <textarea required rows={4} value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} />
                      {bulkSent && <p className="module-muted"><CheckCircle2 size={15} /> Reminder queue prepared for valid contacts.</p>}
                      <button className="primary-button" type="submit"><Send size={15} /> Queue reminders</button>
                    </form>
                  </div>
                )}
                <div className="print-selected-reports">
                  {reportSections.filter((report) => selectedReportIds.includes(report.id)).map((report) => <ReportSectionView key={`print-${report.id}`} report={report} />)}
                </div>
              </div>
            ) : <RoleBlocked role={userRole} message="Reports are only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Risk" && (isStaff ? <div className="module-content">
              <div className="module-intro">
                <div><p className="eyebrow">DECISION SUPPORT</p><h2>Risk analysis by purok</h2><p>Prioritize service areas using their share of unvaccinated animals.</p></div>
                <span className="module-chip"><ShieldCheck size={14} /> 30% maximum unvaccinated</span>
              </div>
              <div className="risk-summary" aria-label="Barangay risk summary">
                <article><strong>{riskSummary.totalAnimals}</strong><span>Registered animals</span></article>
                <article className="risk-summary-alert"><strong>{riskSummary.overdue}</strong><span>Overdue vaccinations</span></article>
                <article><strong>{riskSummary.dueSoon}</strong><span>Due within 30 days</span></article>
                <article><strong>{riskSummary.notScheduled}</strong><span>Without a due date</span></article>
                <article className="risk-summary-alert"><strong>{riskSummary.aboveUnvaccinatedTarget}</strong><span>Puroks above 30% unvaccinated</span></article>
                <article className="risk-summary-high"><strong>{riskSummary.highUnvaccinated}</strong><span>Puroks above 50% unvaccinated</span></article>
              </div>
              <p className="risk-explainer">Unvaccinated rate = unvaccinated animals ÷ registered animals. High risk means more than 50% unvaccinated; Moderate means more than 30% and up to 50%; Low means 30% or less. The 70% vaccination target is met when no more than 30% are unvaccinated. Due soon and overdue counts are shown separately because those animals may have a previous vaccination record. Select a purok card to view all its animal records.</p>
              <div className="risk-grid">{riskRows.map((row) => <article className={`risk-card risk-card-clickable risk-${row.risk.toLowerCase().replace(" ", "-")}`} key={row.purok} role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={selectedRiskPurok === row.purok} aria-label={`View all records for ${row.purok}`} onClick={() => setSelectedRiskPurok(row.purok)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRiskPurok(row.purok); } }}>
                <div className="risk-card-head"><h3>{row.purok}</h3><span>{row.risk === "NO DATA" ? "NO DATA" : `${row.risk} RISK`}</span></div>
                {row.total === 0 ? <p className="risk-no-records">No registered animals in this purok yet.</p> : <>
                  <div className="risk-count"><strong>{row.unvaccinatedRate}%</strong><small>{row.unvaccinated} of {row.total} unvaccinated</small></div>
                  <div className="progress risk-progress" role="progressbar" aria-label={`${row.purok} unvaccinated rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.unvaccinatedRate}><span style={{ width: `${row.unvaccinatedRate}%` }} /></div>
                  <p className="risk-gap">{row.gapToTarget > 0 ? `Vaccinate ${row.gapToTarget} more animal${row.gapToTarget === 1 ? "" : "s"} to reach the 70% coverage target.` : "Unvaccinated rate is within the 30% target."}</p>
                  <dl className="risk-details"><div><dt>Overdue</dt><dd>{row.overdue}</dd></div><div><dt>Due within 30 days</dt><dd>{row.dueSoon}</dd></div><div><dt>No due date</dt><dd>{row.notScheduled}</dd></div></dl>
                </>}
              </article>)}</div>
              {selectedRiskPurok && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedRiskPurok(null)}>
                <section className="modal risk-purok-modal" role="dialog" aria-modal="true" aria-labelledby="risk-purok-title">
                  <div className="modal-heading"><div><p className="eyebrow">PUROK REPORT</p><h2 id="risk-purok-title">{selectedRiskPurok}</h2><p className="heading-sub">Vaccination coverage and follow-up priorities for this area.</p></div><button type="button" className="icon-button" aria-label="Close purok report" onClick={() => setSelectedRiskPurok(null)}><X size={18} /></button></div>
                  {selectedRiskRow && <div className="risk-summary risk-purok-summary">
                    <article><strong>{selectedRiskRow.total}</strong><span>Registered animals</span></article>
                    <article className="risk-summary-alert"><strong>{selectedRiskRow.unvaccinated} ({selectedRiskRow.unvaccinatedRate}%)</strong><span>Unvaccinated</span></article>
                    <article><strong>{selectedRiskRow.dueSoon}</strong><span>Due within 30 days</span></article>
                    <article className="risk-summary-high"><strong>{selectedRiskRow.overdue}</strong><span>Overdue</span></article>
                  </div>}
                  <div className="table-wrap risk-purok-table"><table><thead><tr><th>Animal</th><th>Species / type</th><th>Owner / contact</th><th>Vaccination status</th><th>Vaccine</th><th>Last / next vaccination</th></tr></thead><tbody>{selectedRiskAnimals.map((animal) => <tr key={`purok-${selectedRiskPurok}-${animal.id}`}>
                    <td><strong>{animal.name}</strong></td><td>{animal.species} · {animal.classification ?? "Pet"}</td><td>{animal.owner}<small>{animal.contact || "No contact recorded"}</small></td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td><td>{animal.vaccineType || "Not recorded"}</td><td>Last: {formatVaccineDate(animal.vaccineDate)}<small>Next: {animal.nextDue}</small></td>
                  </tr>)}</tbody></table>{selectedRiskAnimals.length === 0 && <div className="empty-state">No animal records are assigned to this purok.</div>}</div>
                </section>
              </div>}
            </div> : <RoleBlocked role={userRole} message="Risk analysis is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Map" && (isStaff ? <div className="module-content">
              <div className="module-intro"><div><p className="eyebrow">GEOSPATIAL COVERAGE</p><h2>Barangay coverage map</h2><p>Use purok-level records to plan field visits and vaccination drives.</p></div><span className="module-chip"><MapPin size={14} /> {purokOptions.length} puroks monitored</span></div>
              <LeafletMap animals={animalRecords.map((animal) => ({ id: animal.id, name: animal.name, species: animal.species, classification: animal.classification ?? "Pet", owner: animal.owner, purok: animal.purok, vaccinated: animal.vaccinated, status: animal.status, vaccineDate: animal.vaccineDate, nextDueDate: animal.nextDueDate, vaccineType: animal.vaccineType, breed: animal.breed, age: animal.age, contact: animal.contact, latitude: animal.latitude, longitude: animal.longitude }))} puroks={purokOptions} onAnimalSelect={(animalId) => { const animal = animalRecords.find((record) => String(record.id) === String(animalId)); if (animal) void openAnimalDetail(animal); }} />
              <div className="map-legend" role="list" aria-label="Vaccination status legend"><span role="listitem"><i className="map-status-dot vaccinated" /> Vaccinated</span><span role="listitem"><i className="map-status-dot expiring" /> Expiring soon</span><span role="listitem"><i className="map-status-dot overdue" /> Overdue</span><span role="listitem"><i className="map-status-dot unvaccinated" /> Unvaccinated</span></div>
            </div> : <RoleBlocked role={userRole} message="Coverage map is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Pound" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">STRAY &amp; POUND</p><h2>Stray dog directory</h2><p>Track impounded and stray animals through intake, observation, and outcome.</p></div><span className="module-chip"><HomeIcon size={14} /> {strayAnimals.length} strays</span></div><div className="pound-filters"><div className="search-box"><Search size={16} /><input aria-label="Search strays" placeholder="Search name, purok, or impound area..." value={poundQuery} onChange={(event) => setPoundQuery(event.target.value)} /></div><select value={poundStatusFilter} onChange={(event) => setPoundStatusFilter(event.target.value as PoundStatus | "All")}><option value="All">All statuses</option>{POUND_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>{poundError && <p className="form-error">{poundError}</p>}{strayAnimals.length === 0 ? <div className="empty-state">No stray animals match the current filters.</div> : <div className="table-wrap module-table"><table><thead><tr><th>Animal</th><th>Civilian / contact</th><th>Pin area</th><th>Impound area</th><th>Last vaccinated</th><th>Next due</th><th>Status</th><th>Pound status</th></tr></thead><tbody>{strayAnimals.map((animal) => <tr key={`pound-${animal.id}`}><td><strong>{animal.name}</strong><small>{animal.species}</small></td><td>{animal.owner}<small>{animal.contact || "No contact"}</small></td><td>{animal.purok}</td><td>{animal.impoundArea || "—"}</td><td>{formatVaccineDate(animal.vaccineDate)}</td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td><td><select className="pound-status-select" value={animal.poundStatus ?? "Under Observation"} onChange={(event) => changePoundStatus(animal.id, event.target.value as PoundStatus)}>{POUND_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>}</div> : <RoleBlocked role={userRole} message="Stray and pound records are only available for staff accounts (admin, bhw)." />)}
            {activeTab === "Feedback" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SUPPORT CHANNEL</p><h2>Client feedback</h2><p>Feedback submitted by clients, for admin and BHW review.</p></div></div>{feedbackListError && <p className="form-error">{feedbackListError}</p>}{feedbackItems.length === 0 ? <div className="empty-state">No feedback submitted yet.</div> : <div className="table-wrap module-table"><table><thead><tr><th>From</th><th>Category</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>{feedbackItems.map((item) => <tr key={`feedback-${item.id}`}><td>{item.senderName}</td><td>{item.category}</td><td>{item.message}</td><td>{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td><td><select className="pound-status-select" value={item.status} onChange={(event) => void changeFeedbackStatus(item.id, event.target.value as "New" | "Reviewed" | "Resolved")}><option>New</option><option>Reviewed</option><option>Resolved</option></select></td></tr>)}</tbody></table></div>}</div> : isClient ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SUPPORT CHANNEL</p><h2>Feedback and suggestions</h2><p>Send notes to the barangay animal health team.</p></div></div>{feedbackSent ? <div className="feedback-success"><CheckCircle2 size={22} /><div><strong>Feedback submitted</strong><p>Thank you. Your message has been recorded for review.</p></div><button className="secondary-button" onClick={() => setFeedbackSent(false)}>Send another</button></div> : <form className="feedback-form" onSubmit={submitFeedback}><label>Category<select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)}><option>Suggestion</option><option>Complaint</option><option>Compliment</option></select></label><label>Message<textarea required rows={5} placeholder="Tell us how to improve our service." value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} /></label><button className="primary-button" type="submit"><MessageSquare size={16} /> Submit feedback</button></form>}</div> : <RoleBlocked role={userRole} message="Feedback is only available for client and staff accounts (admin, bhw)." />)}
            {activeTab === "Team" && (isStaff ? <div className="module-content">
              <div className="module-intro"><div><p className="eyebrow">MANAGEMENT</p><h2>Team members</h2><p>Staff access for the Barangay Estefania health team.</p></div>{isAdmin && <CreateUserAccountForm createAccount={createAdminManagedAccount} />}</div>
              <div className="team-list">{teamMembers.length === 0 ? <div className="empty-state">No staff accounts found.</div> : teamMembers.map((member) => <div className="team-row" key={member.id}><span className={`avatar${member.id === authUser?.id ? "" : " team-muted"}`}>{member.fullName.slice(0, 2).toUpperCase()}</span><span><strong>{member.fullName}{member.id === authUser?.id ? " (you)" : ""}</strong><small>{member.username ? `@${member.username}` : member.status}</small></span><em>{member.role}</em></div>)}</div>
            </div> : <RoleBlocked role={userRole} message="Team members view is only available for staff accounts (admin, bhw)." />)}
            {activeTab === "SMS" && (isStaff ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">CLIENT COMMUNICATION</p><h2>SMS messaging</h2><p>Send a custom Semaphore SMS to one active client or clients with vaccinations due in 7 days.</p></div></div><SmsComposer /></div> : <RoleBlocked role={userRole} message="SMS messaging is only available for staff accounts (admin, bhw)." />)}

            {activeTab === "Audit" && (isAdmin ? <div className="module-content"><div className="module-intro"><div><p className="eyebrow">SECURITY</p><h2>Audit log</h2><p>Recent actions from this VacciTrack workspace.</p></div><span className="module-chip"><ShieldCheck size={14} /> Protected</span></div><AuditPanel /></div> : <RoleBlocked role={userRole} message="Audit log is only available for administrator accounts." />)}
          </section>}

          <div className={activeTab === "Overview" ? "" : "overview-hidden"}>
          <div className="stat-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><PawPrint size={18} /></span><span className="trend neutral">Total</span></div><p className="stat-number">{dashboardStats.registered}</p><p className="stat-label">Registered animals</p><div className="stat-foot">Current registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon red"><ShieldCheck size={18} /></span><span className="trend danger">Needs follow-up</span></div><p className="stat-number">{dashboardStats.unvaccinated}</p><p className="stat-label">Unvaccinated animals</p><div className="stat-foot">{dashboardStats.registered ? Math.round((dashboardStats.unvaccinated / dashboardStats.registered) * 100) : 0}% of total registry</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><CalendarDays size={18} /></span><span className="trend neutral">This month</span></div><p className="stat-number">{dashboardStats.dueSoon}</p><p className="stat-label">Due for vaccination</p><div className="stat-foot">Needs scheduling</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon red"><Bell size={18} /></span><span className="trend danger">Needs action</span></div><p className="stat-number">{dashboardStats.overdue}</p><p className="stat-label">Overdue vaccinations</p><div className="stat-foot">Review registry</div></article>
          </div>

          {isStaff && <div className="section-grid dashboard-insights-grid"><section className="panel dashboard-insight-panel"><div className="panel-heading"><div><h2>Upcoming appointments</h2><p>Scheduled visits from the live appointment list</p></div><button className="text-button" onClick={() => setActiveTab("Appointments")}>View all →</button></div>{dashboardAppointments.length === 0 ? <p className="module-muted"><CalendarClock size={16} /> No upcoming appointments scheduled.</p> : <div className="purok-list">{dashboardAppointments.map((appointment) => <div className="planning-row" key={`dashboard-appt-${appointment.id}`}><span className="planning-icon warn"><CalendarDays size={15} /></span><span><strong>{appointment.animalName}</strong><small>{appointment.ownerName} · Assigned to {appointment.assignedName}</small></span><em>{formatVaccineDate(appointment.scheduledDate)}</em></div>)}</div>}</section><section className="panel dashboard-insight-panel"><div className="panel-heading"><div><h2>Unvaccinated by purok</h2><p>Highest unvaccinated share, based on registered animals</p></div><button className="text-button" onClick={() => setActiveTab("Risk")}>View risk →</button></div>{dashboardRiskRows.length === 0 ? <p className="module-muted">No purok data available.</p> : <div className="purok-list">{dashboardRiskRows.map((row) => <div className="coverage-row dashboard-risk-row" key={row.purok}><div className="coverage-meta"><span>{row.purok}</span><strong>{row.unvaccinated} / {row.total} <em>{row.unvaccinatedRate}%</em></strong></div><div className="progress"><span style={{ width: `${row.unvaccinatedRate}%` }} /></div></div>)}</div>}</section></div>}

          <section className="panel registry-panel"><div className="panel-heading registry-heading"><div><h2>{isClient ? "Your recent registry activity" : "Recent registry activity"}</h2><p>{isClient ? "Pets you have registered and their vaccination schedules" : isLive ? "Latest 25 live animal records" : "Latest animal records and vaccination schedules"}</p></div><div className="registry-tools"><div className="search-box"><Search size={16} /><input aria-label="Search registry" placeholder="Search registry..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>{!isViewer && <button className="text-button" onClick={() => setActiveTab("Registry")}>View registry →</button>}</div></div>{loadError && <p className="form-error load-error">{loadError}</p>}<div className="table-wrap"><table><thead><tr><th>Animal</th><th>Owner</th><th>Purok</th><th>Next vaccination</th><th>Status</th></tr></thead><tbody>{filteredAnimals.map((animal) => <tr key={animal.id} className="row-clickable" onClick={() => openAnimalDetail(animal)}><td><div className="animal-cell"><span className="animal-avatar">{animal.species === "Dog" ? <Dog size={16} /> : <Cat size={16} />}</span><span><strong>{animal.name}</strong><small>{animal.species}</small></span></div></td><td>{animal.owner}</td><td><span className="location"><MapPin size={13} /> {animal.purok}</span></td><td>{animal.nextDue}</td><td><span className={`status ${statusStyles[animal.status]}`}><i />{animal.status}</span></td></tr>)}</tbody></table>{filteredAnimals.length === 0 && <div className="empty-state">No animals match “{query}”.</div>}</div></section>
          </div>
        </div>
      </section>
      {showRegister && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRegister(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="modal-heading"><div><p className="eyebrow">NEW RECORD</p><h2 id="register-title">Register an animal</h2></div><button className="icon-button" aria-label="Close registration form" onClick={() => setShowRegister(false)}><X size={18} /></button></div><form className="animal-form" onSubmit={registerAnimal}><label>Animal name<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: capitalizeFirstLetter(event.target.value) })} placeholder="e.g. Bantay" /></label><label>Species<select value={form.species} onChange={(event) => { const species = event.target.value as Animal["species"]; setForm({ ...form, species, breed: "", vaccineType: firstVaccineFor(species) }); }}><option>Dog</option><option>Cat</option></select></label><label>Classification<select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value as "Pet" | "Stray" })}><option>Pet</option><option>Stray</option></select></label><label>Neuter status<select value={form.neutered} onChange={(event) => setForm({ ...form, neutered: event.target.value as "Neutered" | "Not neutered" })}><option>Not neutered</option><option>Neutered</option></select></label><label>Breed<select value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })}><option value="">Select breed</option>{BREED_OPTIONS.filter((breed) => breed.species === form.species).map((breed) => <option key={breed.id} value={breed.name}>{breed.name}</option>)}</select></label><label>Sex<input required maxLength={20} value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })} /></label><label>Age (months)<input type="number" min="0" max="360" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="e.g. 36" /></label><label>Color / markings<input maxLength={60} value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} placeholder="e.g. Brown" /></label><label>Civilian / owner name<input required maxLength={120} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Full name" /></label><label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="09171234567" /></label><label>Geospatial pin area<select value={form.purok} onChange={(event) => setForm({ ...form, purok: event.target.value })}>{purokOptions.map((purok) => <option key={purok.id} value={purok.name}>{purok.name}</option>)}</select></label><label>Impound area <small>(optional)</small><input maxLength={120} value={form.impoundArea} onChange={(event) => setForm({ ...form, impoundArea: event.target.value })} placeholder="e.g. Barangay kennel A" /></label><label>Pet photos for identification<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPetImageFiles(Array.from(event.target.files ?? []))} /><small>Add clear photos so owners and BHW can recognize this pet in its profile. Up to 3 photos, 5MB each.</small></label><label>Last vaccination<input type="date" max={todayLocalIso()} value={form.vaccineDate} onChange={(event) => { const vaccineDate = event.target.value; setForm((current) => ({ ...current, vaccineDate, nextDue: vaccineDate ? addMonths(vaccineDate, 12) : "" })); }} /></label><label>Vaccine type<select value={form.vaccineType} onChange={(event) => setForm({ ...form, vaccineType: event.target.value })}>{vaccineOptions.filter((vaccine) => vaccine.species === "Both" || vaccine.species === form.species).map((vaccine) => <option key={vaccine.name} value={vaccine.name}>{vaccine.name}</option>)}</select></label><label>Next vaccination<input type="date" min={form.vaccineDate || undefined} value={form.nextDue} onChange={(event) => setForm({ ...form, nextDue: event.target.value })} /></label><div className="map-picker-field"><div className="map-picker-hint"><small>Search is focused on Barangay Estefania using an approximate area. You can also click the map or use your current location.</small><button type="button" className="secondary-button" onClick={useMyLocation}><MapPin size={13} /> Use my location</button></div><div className="map-picker-search"><Search size={14} /><input type="text" placeholder="Search places in Estefania..." autoComplete="off" value={locationQuery} onChange={(event) => { const value = event.target.value; setLocationQuery(value); if (value.trim().length < 3) { setLocationSuggestions([]); setIsSearchingLocation(false); } else { setIsSearchingLocation(true); } }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (locationSuggestions[0]) selectLocationSuggestion(locationSuggestions[0]); } }} />{isSearchingLocation && <Loader2 size={14} className="admin-spin" />}{locationSuggestions.length > 0 && <ul className="map-picker-suggestions">{locationSuggestions.map((suggestion, index) => <li key={index}><button type="button" onClick={() => selectLocationSuggestion(suggestion)}>{suggestion.label}</button></li>)}</ul>}</div><LeafletMap animals={form.latitude && form.longitude ? [{ id: "picked", name: "Selected location", species: form.species, classification: form.classification, owner: form.owner || "—", purok: form.purok, vaccinated: false, status: "Pending", latitude: Number(form.latitude), longitude: Number(form.longitude) }] : []} puroks={purokOptions} pickMode onPickCoordinates={pickCoordinates} onMapReady={(handle) => { pickerMapRef.current = handle; }} /></div><label>Notes <small>(optional)</small><textarea rows={3} maxLength={400} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Temperament, medical notes, etc." /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>Cancel</button><button className="primary-button" disabled={isSaving}>{isSaving ? "Registering..." : "Register animal"}</button></div></form></section></div>}
      {selectedAnimal && <AnimalDetailPanel animal={selectedAnimal} history={vaccinationHistory} vaccines={vaccineOptions.filter((vaccine) => vaccine.species === "Both" || vaccine.species === selectedAnimal.species).map((vaccine) => vaccine.name)} canManage={isStaff} onClose={() => setSelectedAnimal(null)} onRecordAdded={() => openAnimalDetail(selectedAnimal)} onDeleted={(warning) => { setAnimalRecords((current) => current.filter((a) => a.id !== selectedAnimal.id)); setSelectedAnimal(null); if (warning) setLoadError(warning); }} onUpdated={(fields) => { const patch = { name: fields.name, breed: fields.breed || undefined, age: fields.age ? Number(fields.age) : undefined, sex: fields.sex || undefined, color: fields.color || undefined, owner: fields.ownerName, contact: fields.contactNumber, impoundArea: fields.impoundArea, notes: fields.notes || undefined }; setAnimalRecords((current) => current.map((a) => (a.id === selectedAnimal.id ? { ...a, ...patch } : a))); setSelectedAnimal((current) => (current ? { ...current, ...patch } : current)); }} />}
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel}
        danger={confirmDialog?.danger}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </main>
  );
}

function AppointmentManager({ animals, teamMembers }: { animals: Animal[]; teamMembers: TeamMember[] }) {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [location, setLocation] = useState("Barangay health station");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshAppointments() {
    const result = await getAppointments();
    if (result.error) setError(result.error);
    else setAppointments(result.items ?? []);
  }

  useEffect(() => {
    void refreshAppointments();
  }, []);

  async function scheduleAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const animal = animals.find((item) => String(item.id) === animalId);
    const result = await createAppointment({
      animalId: Number(animalId),
      assignedTo: staffId,
      scheduledDate: appointmentAt,
      notes,
    });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setSuccess("Appointment scheduled and the owner has been notified.");
    setAnimalId("");
    setStaffId("");
    setAppointmentAt("");
    setNotes("");
    await refreshAppointments();
  }

  async function changeStatus(appointment: AppointmentItem, status: AppointmentStatus) {
    setError("");
    setSuccess("");
    setBusy(true);
    const result = await updateAppointmentStatus(appointment.id, status);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(`Appointment marked ${status.toLowerCase()} and the owner notified.`);
    await refreshAppointments();
  }

  return (
    <div className="module-content appointment-manager">
      <div className="module-intro">
        <div>
          <p className="eyebrow">VACCINATION APPOINTMENTS</p>
          <h2>Schedule and assign appointments</h2>
          <p>Create upcoming vaccination visits and assign responsible BHW or admin staff.</p>
        </div>
      </div>

      <form className="appointment-form" onSubmit={scheduleAppointment}>
        <label>Animal
          <select value={animalId} onChange={(event) => setAnimalId(event.target.value)} required>
            <option value="">Select animal</option>
            {animals.filter((animal) => typeof animal.id === "number").map((animal) => <option key={animal.id} value={animal.id}>{animal.name} - {animal.owner}</option>)}
          </select>
        </label>
        <label>Assigned staff
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">Unassigned</option>
            {teamMembers.filter((member) => member.status === "active").map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>)}
          </select>
        </label>
        <label>Date and time
          <input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} required />
        </label>
        <label>Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} required />
        </label>
        <label className="appointment-notes">Notes
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instructions for staff or the owner" />
        </label>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="appointment-success">{success}</p>}
        <div className="modal-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Schedule appointment"}</button></div>
      </form>

      <div className="appointment-list">
        <h3>Scheduled appointments</h3>
        {appointments.length === 0 ? <p className="module-muted">No vaccination appointments scheduled.</p> : appointments.map((appointment) => (
          <article className="appointment-row" key={appointment.id}>
            <div>
              <strong>{appointment.animalName}</strong>
              <small>{appointment.ownerName} · {appointment.assignedName}</small>
              <span>{new Date(appointment.scheduledDate).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}</span>
            </div>
            <div className="appointment-actions">
              <span className={`appointment-status appointment-${appointment.status.toLowerCase()}`}>{appointment.status}</span>
              {appointment.status !== "Completed" && appointment.status !== "Cancelled" && <>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => changeStatus(appointment, "Scheduled")}>Confirm</button>
                <button type="button" className="secondary-button" disabled={busy} onClick={async () => { const value = window.prompt("Enter the new date and time", appointment.scheduledDate.slice(0, 16)); if (!value) return; setBusy(true); setError(""); setSuccess(""); const result = await updateAppointmentStatus(appointment.id, "Scheduled"); setBusy(false); if (result.error) { setError(result.error); return; } setSuccess("Appointment rescheduled and the owner notified."); await refreshAppointments(); }}>Reschedule</button>
                <button type="button" className="primary-button" disabled={busy} onClick={() => changeStatus(appointment, "Completed")}>Complete</button>
                <button type="button" className="danger-button" disabled={busy} onClick={() => changeStatus(appointment, "Cancelled")}>Cancel</button>
              </>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Coverage({ name, value, count }: { name: string; value: number; count: string }) {
  return <div className="coverage-row"><div className="coverage-meta"><span>{name}</span><strong>{count} <em>{value}%</em></strong></div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}

type ReportBreakdownRow = { label: string; count: number; vaccinated: number; rate: number };

function ReportBreakdownTable({ title, rows }: { title: string; rows: ReportBreakdownRow[] }) {
  return (
    <article className="report-breakdown-card">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="module-muted">No records in range.</p> : (
        <div className="report-breakdown-table">
          <div className="report-breakdown-head"><span>Category</span><span>Vaccinated</span><span>Total</span><span>Coverage</span></div>
          {rows.map((row) => (
            <div className="report-breakdown-row" key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.vaccinated}</span>
              <span>{row.count}</span>
              <em>{row.rate}%</em>
            </div>
          ))}
        </div>
      )}
    </article>
  );
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
