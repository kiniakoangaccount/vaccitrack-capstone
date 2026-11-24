import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession, adminLogout } from "../actions";
import { createAdminClient } from "@/lib/supabase-admin";
import UsersPanel from "./UsersPanel";
import PendingPanel from "./PendingPanel";
import FeedbackPanel from "./FeedbackPanel";
import AuditPanel from "./AuditPanel";
import MessageHistoryPanel from "./MessageHistoryPanel";
import InvitesPanel from "./InvitesPanel";
import { createSuperAdminUser, listStaffInvites, type StaffInvite } from "./crud-actions";
import CreateUserAccountForm from "@/app/CreateUserAccountForm";
import SmsTestForm from "./SmsTestForm";
import {
  ShieldCheck, Users, PawPrint, Activity, Bell,
  LogOut, MessageSquare, Clock, XCircle,
  UserPlus, MapPin, Menu,
} from "lucide-react";
import { SmsComposer } from "@/app/SmsComposer";
import AdminMapPanel from "./AdminMapPanel";
import PuroksPanel from "./PuroksPanel";
import type { ManagedPurok } from "./purok-actions";
import { purokOptions, getAnimalStatus } from "@/lib/map-data";
import type { MapAnimal } from "../../LeafletMap";

type Tab = "overview" | "users" | "pending" | "feedback" | "audit" | "invites" | "map" | "puroks" | "sms" | "messages";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
  preferred_language: "en" | "tl" | "hil";
  notify_sms: boolean;
  id_document_reference: string | null;
  created_at: string;
}

interface PendingProfile extends Profile {
  idDocumentUrl: string | null;
}

interface FeedbackRow {
  id: number;
  name: string | null;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/vaccitrack_super_hidden_admin");

  const params = await searchParams;
  const tab = (params.tab ?? "overview") as Tab;

  const db = createAdminClient();
  const supaCfg = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Live stats (always fetched) ───────────────────────────
  const [totalAnimals, vaccAnimals, pendingUsers, totalUsers, feedbackNew] = supaCfg
    ? await Promise.all([
        db!.from("animals").select("id", { count: "exact", head: true }),
        db!.from("animals").select("id", { count: "exact", head: true }).eq("vaccinated", true),
        db!.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db!.from("profiles").select("id", { count: "exact", head: true }),
        db!.from("feedback").select("id", { count: "exact", head: true }).eq("status", "New"),
      ])
    : [null, null, null, null, null];

  const stats = {
    animals: totalAnimals?.count ?? 0,
    vaccinated: vaccAnimals?.count ?? 0,
    pending: pendingUsers?.count ?? 0,
    users: totalUsers?.count ?? 0,
    feedback: feedbackNew?.count ?? 0,
  };

  // ── Tab data ──────────────────────────────────────────────
  let profiles: Profile[] = [];
  let pendingProfiles: PendingProfile[] = [];
  let feedbackRows: FeedbackRow[] = [];
  let invites: StaffInvite[] = [];
  let mapAnimals: MapAnimal[] = [];
  let managedPuroks: ManagedPurok[] = [];

  if (supaCfg && tab === "users") {
    const { data } = await db!.from("profiles")
      .select("id, full_name, username, role, status, contact_number, preferred_language, notify_sms, id_document_reference, created_at")
      .order("created_at", { ascending: false }).limit(100);
    profiles = (data as Profile[]) ?? [];
  }

  if (supaCfg && tab === "pending") {
    const { data } = await db!.from("profiles")
      .select("id, full_name, username, role, status, contact_number, id_document_reference, created_at")
      .eq("status", "pending").order("created_at", { ascending: false });
    pendingProfiles = await Promise.all(((data as Profile[]) ?? []).map(async (p) => {
      if (!p.id_document_reference) return { ...p, idDocumentUrl: null };
      const { data: signed } = await db!.storage.from("id-documents").createSignedUrl(p.id_document_reference, 600);
      return { ...p, idDocumentUrl: signed?.signedUrl ?? null };
    }));
  }

  if (supaCfg && tab === "feedback") {
    const { data } = await db!.from("feedback")
      .select("id, name, category, message, status, created_at")
      .order("created_at", { ascending: false }).limit(60);
    feedbackRows = (data as FeedbackRow[]) ?? [];
  }

  if (supaCfg && tab === "invites") {
    const { invites: rows } = await listStaffInvites();
    invites = rows ?? [];
  }

  if (supaCfg && tab === "map") {
    const { data } = await db!.from("animals")
      .select("id, name, species, classification, owner_name, contact_number, breed, age, vaccinated, vaccine_date, next_due_date, vaccine_type, latitude, longitude, puroks(name)");
    mapAnimals = ((data as { id: number; name: string; species: string; classification: string; owner_name: string; contact_number: string | null; breed: string | null; age: number | null; vaccinated: boolean; vaccine_date: string | null; next_due_date: string | null; vaccine_type: string | null; latitude: number | null; longitude: number | null; puroks: { name: string } | { name: string }[] | null }[]) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      species: r.species,
      classification: r.classification,
      owner: r.owner_name,
      purok: Array.isArray(r.puroks) ? r.puroks[0]?.name ?? "Unassigned" : r.puroks?.name ?? "Unassigned",
      vaccinated: r.vaccinated,
      status: getAnimalStatus(r.vaccinated, r.next_due_date),
      vaccineDate: r.vaccine_date,
      nextDueDate: r.next_due_date,
      vaccineType: r.vaccine_type ?? undefined,
      breed: r.breed ?? undefined,
      age: r.age,
      contact: r.contact_number ?? "",
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  }

  if (supaCfg && tab === "puroks") {
    const { data } = await db!.from("puroks").select("id, name, latitude, longitude").order("name");
    managedPuroks = ((data ?? []) as ManagedPurok[]);
  }

  const navItems: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "overview",  label: "Overview",             icon: <Activity size={16} /> },
    { key: "users",     label: "User accounts",        icon: <Users size={16} />,          badge: stats.users },
    { key: "pending",   label: "Pending verification", icon: <Clock size={16} />,          badge: stats.pending > 0 ? stats.pending : undefined },
    { key: "invites",   label: "Invite staff",         icon: <UserPlus size={16} /> },
    { key: "feedback",  label: "Feedback",             icon: <MessageSquare size={16} />,  badge: stats.feedback > 0 ? stats.feedback : undefined },
    { key: "sms",       label: "SMS messaging",         icon: <MessageSquare size={16} /> },
    { key: "messages",  label: "Sent messages",         icon: <Clock size={16} /> },
    { key: "map",       label: "Coverage map",         icon: <MapPin size={16} /> },
    { key: "puroks",    label: "Purok areas",           icon: <MapPin size={16} /> },
    { key: "audit",     label: "Audit log",            icon: <ShieldCheck size={16} /> },
  ];

  return (
    <main className="admin-shell">
      <input type="checkbox" id="admin-nav-toggle" className="admin-nav-toggle-checkbox" />
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="brand-mark brand-mark-admin"><PawPrint size={17} /></span>
          <span>VacciTrack</span>
        </div>
        <p className="admin-sidebar-label">Administration</p>
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={`/vaccitrack_super_hidden_admin/dashboard?tab=${item.key}`}
              className={`admin-nav-item admin-nav-link${tab === item.key ? " admin-nav-item-active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className={`admin-nav-badge${item.key === "pending" ? " admin-nav-badge-warn" : ""}`}>
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-row">
            <span className="admin-avatar">{session.username.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{session.username}</strong>
              <small>Administrator</small>
            </span>
          </div>
          <form action={adminLogout}>
            <button className="admin-logout-btn" type="submit" title="Sign out">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </aside>
      <label htmlFor="admin-nav-toggle" className="admin-sidebar-backdrop" aria-hidden="true" />

      {/* ── Content ── */}
      <section className="admin-content">
        <header className="admin-topbar">
          <label htmlFor="admin-nav-toggle" className="admin-mobile-nav-toggle" aria-label="Open navigation"><Menu size={20} /></label>
          <div className="admin-crumb">
            Admin <span>/</span> {navItems.find((n) => n.key === tab)?.label}
          </div>
          <div className="admin-topbar-badge">
            <ShieldCheck size={14} /> Administrator session
          </div>
        </header>

        <div className="admin-page-content">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">ADMINISTRATOR PANEL</p>
                <h1>Welcome back, {session.username}.</h1>
                <p className="heading-sub">Full administrative access to VacciTrack — Barangay Estefania.</p>
              </div>

              {!supaCfg && (
                <div className="admin-warn-banner">
                  <Bell size={16} />
                  <span>Supabase service role key not configured — live stats unavailable. Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to your environment.</span>
                </div>
              )}

              <div className="admin-stat-grid">
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=users" className="admin-stat-card admin-stat-hoverable admin-stat-link">
                  <span className="admin-stat-icon blue"><Users size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.users : "—"}</p>
                  <p className="admin-stat-label">Registered users</p>
                </Link>
                <Link href="/?tab=Registry" className="admin-stat-card admin-stat-hoverable admin-stat-link">
                  <span className="admin-stat-icon green"><PawPrint size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.animals : "—"}</p>
                  <p className="admin-stat-label">Animal records</p>
                </Link>
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=pending" className="admin-stat-card admin-stat-hoverable admin-stat-link">
                  <span className="admin-stat-icon amber"><Clock size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.pending : "—"}</p>
                  <p className="admin-stat-label">Pending verifications</p>
                </Link>
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=feedback" className="admin-stat-card admin-stat-hoverable admin-stat-link">
                  <span className="admin-stat-icon red"><MessageSquare size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.feedback : "—"}</p>
                  <p className="admin-stat-label">New feedback items</p>
                </Link>
              </div>

              <div className="admin-quick-grid">
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=pending" className="admin-quick-card admin-quick-warn">
                  <Clock size={20} />
                  <div>
                    <strong>Pending verifications</strong>
                    <p>{stats.pending} account{stats.pending !== 1 ? "s" : ""} waiting for ID review</p>
                  </div>
                  <span>Review →</span>
                </Link>
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=feedback" className="admin-quick-card admin-quick-blue">
                  <MessageSquare size={20} />
                  <div>
                    <strong>Unread feedback</strong>
                    <p>{stats.feedback} new message{stats.feedback !== 1 ? "s" : ""} from users</p>
                  </div>
                  <span>View →</span>
                </Link>
                <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=audit" className="admin-quick-card admin-quick-green">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Audit log</strong>
                    <p>Track all system changes and actions</p>
                  </div>
                  <span>Open →</span>
                </Link>
              </div>

              <div className="admin-info-grid">
                <div className="admin-info-card">
                  <div className="admin-info-head"><ShieldCheck size={16} /><span>Recent activity</span></div>
                  <p className="admin-muted">The audit log shows every create, update, delete, and SMS operation across the system.</p>
                  <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=audit" className="admin-link">View audit log <span>→</span></Link>
                </div>
                <div className="admin-info-card">
                  <div className="admin-info-head"><MessageSquare size={16} /><span>SMS messaging</span></div>
                  <p className="admin-muted">Send a custom message to one active client or clients with vaccinations due in 7 days.</p>
                  <Link href="/vaccitrack_super_hidden_admin/dashboard?tab=sms" className="admin-link">Open SMS messaging <span>→</span></Link>
                </div>
              </div>
              <div className="admin-info-panel">
                <ShieldCheck size={18} />
                <div>
                  <strong>Administrator session active</strong>
                  <p>Signed in as <strong>{session.username}</strong>. Session expires in 8 hours.</p>
                </div>
              </div>
            </>
          )}

          {/* ── USERS ── */}
          {tab === "users" && (
            <>
              <div className="admin-page-heading admin-user-heading">
                <div>
                  <p className="eyebrow">USER MANAGEMENT</p>
                  <h1>All user accounts</h1>
                  <p className="heading-sub">Edit role and status, or permanently delete any account.</p>
                </div>
                {supaCfg && <CreateUserAccountForm createAccount={createSuperAdminUser} />}
              </div>
              {!supaCfg ? <NotConfigured /> : <>
                <UsersPanel profiles={profiles} />
              </>}
            </>
          )}

          {/* ── PENDING VERIFICATION ── */}
          {tab === "pending" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">IDENTITY VERIFICATION</p>
                <h1>Pending accounts</h1>
                <p className="heading-sub">Approve civilian registrations to grant access, or reject invalid submissions.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <PendingPanel profiles={pendingProfiles} />}
            </>
          )}

          {/* ── INVITE STAFF ── */}
          {tab === "invites" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">STAFF ONBOARDING</p>
                <h1>Invite staff</h1>
                <p className="heading-sub">Generate a role-locked registration link for a BHW or administrator. Each link works once and expires after 7 days.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <InvitesPanel invites={invites} />}
            </>
          )}

          {/* ── FEEDBACK ── */}
          {tab === "feedback" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">USER FEEDBACK</p>
                <h1>Feedback inbox</h1>
                <p className="heading-sub">Click the status badge to cycle New → Reviewed → Resolved. Delete to remove.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <FeedbackPanel rows={feedbackRows} />}
            </>
          )}

          {/* ── COVERAGE MAP ── */}
          {tab === "map" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">GEOSPATIAL COVERAGE</p>
                <h1>Barangay coverage map</h1>
                <p className="heading-sub">Every registered animal across every purok, for field planning.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <AdminMapPanel animals={mapAnimals} puroks={purokOptions} />}
            </>
          )}

          {tab === "puroks" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">AREA MANAGEMENT</p>
                <h1>Purok areas</h1>
                <p className="heading-sub">Add, edit, and remove service areas. Updates flow into the workspace coverage and vaccination reports.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <PuroksPanel initialPuroks={managedPuroks} />}
            </>
          )}

          {/* ── SMS MESSAGING ── */}
          {tab === "sms" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">CLIENT COMMUNICATION</p>
                <h1>SMS messaging</h1>
                <p className="heading-sub">Send SMS messages to an active client or an upcoming vaccination group.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : (
                <div className="admin-communication-groups">
                  <section className="admin-communication-group">
                    <div className="admin-communication-heading">
                      <p className="eyebrow">OWNER MESSAGING</p>
                      <h2>Send messages</h2>
                      <p>Send a custom message to one active client or clients with vaccinations due in 7 days.</p>
                    </div>
                    <section className="admin-communication-card">
                      <h3>SMS</h3>
                      <SmsComposer />
                    </section>
                  </section>
                  <section className="admin-communication-group">
                    <div className="admin-communication-heading">
                      <p className="eyebrow">SUPER-ADMIN ONLY</p>
                      <h2>Test messages</h2>
                      <p>Send test messages only to phone numbers you control.</p>
                    </div>
                    <div className="admin-communication-channels">
                      <SmsTestForm />
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

          {/* ── SENT MESSAGE HISTORY ── */}
          {tab === "messages" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">MESSAGE HISTORY</p>
                <h1>Sent messages</h1>
                <p className="heading-sub">Track recipients, subjects, delivery status, timestamps, and senders. Message content is not retained.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <MessageHistoryPanel />}
            </>
          )}

          {/* ── AUDIT LOG ── */}
          {tab === "audit" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">SECURITY & TRACEABILITY</p>
                <h1>Audit log</h1>
                <p className="heading-sub">Every create, update, delete, and SMS operation recorded across the system.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <AuditPanel />}
            </>
          )}

        </div>
      </section>
    </main>
  );
}

function NotConfigured() {
  return (
    <div className="admin-not-configured">
      <XCircle size={26} />
      <strong>Supabase not fully configured</strong>
      <p>Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to your <code>.env.local</code> to enable live data.</p>
    </div>
  );
}
