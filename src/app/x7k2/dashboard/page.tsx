import { redirect } from "next/navigation";
import { getAdminSession, adminLogout } from "../actions";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  ShieldCheck, Users, PawPrint, Activity,
  Bell, ClipboardList, LogOut, MessageSquare,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";

type Tab = "overview" | "users" | "pending" | "feedback" | "audit";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
  id_document_reference: string | null;
  created_at: string;
}

interface FeedbackRow {
  id: number;
  name: string | null;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

interface AuditRow {
  id: number;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: number | null;
  notes: string | null;
  created_at: string;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/x7k2");

  const params = await searchParams;
  const tab = (params.tab ?? "overview") as Tab;

  const db = createAdminClient();

  // ── Live stats ────────────────────────────────────────────
  const [totalAnimals, vaccAnimals, pendingUsers, totalUsers, feedbackNew] =
    await Promise.all([
      db?.from("animals").select("id", { count: "exact", head: true }),
      db?.from("animals").select("id", { count: "exact", head: true }).eq("vaccinated", true),
      db?.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db?.from("profiles").select("id", { count: "exact", head: true }),
      db?.from("feedback").select("id", { count: "exact", head: true }).eq("status", "New"),
    ]);

  const stats = {
    animals: totalAnimals?.count ?? 0,
    vaccinated: vaccAnimals?.count ?? 0,
    pending: pendingUsers?.count ?? 0,
    users: totalUsers?.count ?? 0,
    feedback: feedbackNew?.count ?? 0,
  };

  // ── Tab-specific data ─────────────────────────────────────
  let profiles: Profile[] = [];
  let pendingProfiles: Profile[] = [];
  let feedbackRows: FeedbackRow[] = [];
  let auditRows: AuditRow[] = [];

  if (tab === "users") {
    const { data } = await db!
      .from("profiles")
      .select("id, full_name, username, role, status, contact_number, id_document_reference, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    profiles = (data as Profile[]) ?? [];
  }

  if (tab === "pending") {
    const { data } = await db!
      .from("profiles")
      .select("id, full_name, username, role, status, contact_number, id_document_reference, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pendingProfiles = (data as Profile[]) ?? [];
  }

  if (tab === "feedback") {
    const { data } = await db!
      .from("feedback")
      .select("id, name, category, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    feedbackRows = (data as FeedbackRow[]) ?? [];
  }

  if (tab === "audit") {
    const { data } = await db!
      .from("audit_log")
      .select("id, user_id, action, table_name, record_id, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    auditRows = (data as AuditRow[]) ?? [];
  }

  const navItems: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "overview",  label: "Overview",          icon: <Activity size={16} /> },
    { key: "users",     label: "User accounts",     icon: <Users size={16} />,       badge: stats.users },
    { key: "pending",   label: "Pending verification", icon: <Clock size={16} />,    badge: stats.pending > 0 ? stats.pending : undefined },
    { key: "feedback",  label: "Feedback",           icon: <MessageSquare size={16} />, badge: stats.feedback > 0 ? stats.feedback : undefined },
    { key: "audit",     label: "Audit log",          icon: <ShieldCheck size={16} /> },
  ];

  const supaCfg = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <main className="admin-shell">
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
              href={`/x7k2/dashboard?tab=${item.key}`}
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

      {/* ── Content ── */}
      <section className="admin-content">
        <header className="admin-topbar">
          <div className="admin-crumb">Admin <span>/</span> {navItems.find((n) => n.key === tab)?.label}</div>
          <div className="admin-topbar-badge"><ShieldCheck size={14} /> Administrator session</div>
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
                <article className="admin-stat-card">
                  <span className="admin-stat-icon blue"><Users size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.users : "—"}</p>
                  <p className="admin-stat-label">Registered users</p>
                </article>
                <article className="admin-stat-card">
                  <span className="admin-stat-icon green"><PawPrint size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.animals : "—"}</p>
                  <p className="admin-stat-label">Animal records</p>
                </article>
                <article className="admin-stat-card">
                  <span className="admin-stat-icon amber"><Clock size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.pending : "—"}</p>
                  <p className="admin-stat-label">Pending verifications</p>
                </article>
                <article className="admin-stat-card">
                  <span className="admin-stat-icon red"><MessageSquare size={17} /></span>
                  <p className="admin-stat-number">{supaCfg ? stats.feedback : "—"}</p>
                  <p className="admin-stat-label">New feedback items</p>
                </article>
              </div>

              <div className="admin-quick-grid">
                <a href="/x7k2/dashboard?tab=pending" className="admin-quick-card admin-quick-warn">
                  <Clock size={20} />
                  <div>
                    <strong>Pending verifications</strong>
                    <p>{stats.pending} account{stats.pending !== 1 ? "s" : ""} waiting for ID review</p>
                  </div>
                  <span>Review →</span>
                </a>
                <a href="/x7k2/dashboard?tab=feedback" className="admin-quick-card admin-quick-blue">
                  <MessageSquare size={20} />
                  <div>
                    <strong>Unread feedback</strong>
                    <p>{stats.feedback} new message{stats.feedback !== 1 ? "s" : ""} from users</p>
                  </div>
                  <span>View →</span>
                </a>
                <a href="/x7k2/dashboard?tab=audit" className="admin-quick-card admin-quick-green">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Audit log</strong>
                    <p>Track all system changes and actions</p>
                  </div>
                  <span>Open →</span>
                </a>
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
              <div className="admin-page-heading">
                <p className="eyebrow">USER MANAGEMENT</p>
                <h1>All user accounts</h1>
                <p className="heading-sub">View and manage every profile in the system.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Full name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Contact</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.length === 0 && (
                        <tr><td colSpan={6} className="admin-table-empty">No user accounts found.</td></tr>
                      )}
                      {profiles.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.full_name}</strong></td>
                          <td className="admin-muted">@{p.username ?? "—"}</td>
                          <td><RoleBadge role={p.role} /></td>
                          <td><StatusBadge status={p.status} /></td>
                          <td className="admin-muted">{p.contact_number ?? "—"}</td>
                          <td className="admin-muted">{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── PENDING VERIFICATION ── */}
          {tab === "pending" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">IDENTITY VERIFICATION</p>
                <h1>Pending accounts</h1>
                <p className="heading-sub">Civilian registrations awaiting administrator review. Approve or reject each ID submission in Supabase.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : pendingProfiles.length === 0 ? (
                <div className="admin-empty-state">
                  <CheckCircle2 size={28} />
                  <strong>All clear</strong>
                  <p>No accounts are currently pending verification.</p>
                </div>
              ) : (
                <div className="admin-pending-grid">
                  {pendingProfiles.map((p) => (
                    <article key={p.id} className="admin-pending-card">
                      <div className="admin-pending-head">
                        <span className="admin-avatar admin-avatar-lg">{p.full_name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{p.full_name}</strong>
                          <small>@{p.username ?? "no username"}</small>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <dl className="admin-pending-meta">
                        <div><dt>Contact</dt><dd>{p.contact_number ?? "—"}</dd></div>
                        <div><dt>ID reference</dt><dd>{p.id_document_reference ?? "—"}</dd></div>
                        <div><dt>Registered</dt><dd>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</dd></div>
                      </dl>
                      <p className="admin-pending-action-hint">
                        To approve or reject, update this profile&apos;s <code>status</code> field in the Supabase dashboard.
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── FEEDBACK ── */}
          {tab === "feedback" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">USER FEEDBACK</p>
                <h1>Feedback inbox</h1>
                <p className="heading-sub">Messages submitted by barangay residents and staff.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : feedbackRows.length === 0 ? (
                <div className="admin-empty-state">
                  <MessageSquare size={28} />
                  <strong>No feedback yet</strong>
                  <p>Submissions from users will appear here.</p>
                </div>
              ) : (
                <div className="admin-feedback-list">
                  {feedbackRows.map((f) => (
                    <article key={f.id} className="admin-feedback-card">
                      <div className="admin-feedback-head">
                        <span className="admin-feedback-category">{f.category}</span>
                        <FeedbackStatusBadge status={f.status} />
                        <span className="admin-muted admin-feedback-date">
                          {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                        </span>
                      </div>
                      {f.name && <p className="admin-feedback-from">From: <strong>{f.name}</strong></p>}
                      <p className="admin-feedback-msg">{f.message}</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── AUDIT LOG ── */}
          {tab === "audit" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">SECURITY</p>
                <h1>Audit log</h1>
                <p className="heading-sub">All INSERT, UPDATE, and DELETE operations recorded by the system.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : auditRows.length === 0 ? (
                <div className="admin-empty-state">
                  <ClipboardList size={28} />
                  <strong>No audit events</strong>
                  <p>Actions will be logged here as users interact with the system.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Table</th>
                        <th>Record</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((a) => (
                        <tr key={a.id}>
                          <td className="admin-muted admin-nowrap">
                            {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td><AuditActionBadge action={a.action} /></td>
                          <td><code className="admin-code">{a.table_name}</code></td>
                          <td className="admin-muted">{a.record_id ?? "—"}</td>
                          <td className="admin-muted admin-audit-notes">{a.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </section>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: "admin-badge-red",
    veterinarian: "admin-badge-purple",
    bhw: "admin-badge-blue",
    client: "admin-badge-green",
    viewer: "admin-badge-gray",
  };
  return <span className={`admin-badge ${map[role] ?? "admin-badge-gray"}`}>{role}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "admin-badge-green",
    pending: "admin-badge-amber",
    disabled: "admin-badge-gray",
  };
  return <span className={`admin-badge ${map[status] ?? "admin-badge-gray"}`}>{status}</span>;
}

function FeedbackStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    New: "admin-badge-blue",
    Reviewed: "admin-badge-amber",
    Resolved: "admin-badge-green",
  };
  return <span className={`admin-badge ${map[status] ?? "admin-badge-gray"}`}>{status}</span>;
}

function AuditActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    INSERT: "admin-badge-green",
    UPDATE: "admin-badge-amber",
    DELETE: "admin-badge-red",
    SMS_SENT: "admin-badge-purple",
    SMS_ATTEMPT: "admin-badge-gray",
  };
  return <span className={`admin-badge ${map[action] ?? "admin-badge-gray"}`}>{action}</span>;
}

function NotConfigured() {
  return (
    <div className="admin-not-configured">
      <XCircle size={26} />
      <strong>Supabase not fully configured</strong>
      <p>Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to your <code>.env.local</code> file to enable live data in the admin panel.</p>
    </div>
  );
}
