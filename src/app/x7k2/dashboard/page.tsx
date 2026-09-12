import { redirect } from "next/navigation";
import { getAdminSession, adminLogout } from "../actions";
import {
  ShieldCheck,
  Users,
  PawPrint,
  Activity,
  Bell,
  ClipboardList,
  LogOut,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/x7k2");

  return (
    <main className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="brand-mark brand-mark-admin"><PawPrint size={17} /></span>
          <span>VacciTrack</span>
        </div>
        <p className="admin-sidebar-label">Administration</p>
        <nav className="admin-sidebar-nav">
          <span className="admin-nav-item admin-nav-item-active">
            <Activity size={16} /> Overview
          </span>
          <span className="admin-nav-item">
            <Users size={16} /> User accounts
          </span>
          <span className="admin-nav-item">
            <ClipboardList size={16} /> Animal registry
          </span>
          <span className="admin-nav-item">
            <Bell size={16} /> Notifications
          </span>
          <span className="admin-nav-item">
            <ShieldCheck size={16} /> Audit log
          </span>
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-row">
            <span className="admin-avatar">
              {session.username.slice(0, 2).toUpperCase()}
            </span>
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

      {/* Content */}
      <section className="admin-content">
        <header className="admin-topbar">
          <div className="admin-crumb">
            Admin <span>/</span> Overview
          </div>
          <div className="admin-topbar-badge">
            <ShieldCheck size={14} /> Administrator session
          </div>
        </header>

        <div className="admin-page-content">
          <div className="admin-page-heading">
            <p className="eyebrow">ADMINISTRATOR PANEL</p>
            <h1>Welcome back, {session.username}.</h1>
            <p className="heading-sub">
              Full administrative access to VacciTrack — Barangay Estefania.
            </p>
          </div>

          {/* Stat cards */}
          <div className="admin-stat-grid">
            <article className="admin-stat-card">
              <span className="admin-stat-icon blue"><Users size={17} /></span>
              <p className="admin-stat-number">—</p>
              <p className="admin-stat-label">Registered users</p>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon green"><PawPrint size={17} /></span>
              <p className="admin-stat-number">—</p>
              <p className="admin-stat-label">Animal records</p>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon amber"><Bell size={17} /></span>
              <p className="admin-stat-number">—</p>
              <p className="admin-stat-label">Pending verifications</p>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon red"><ShieldCheck size={17} /></span>
              <p className="admin-stat-number">—</p>
              <p className="admin-stat-label">Audit events today</p>
            </article>
          </div>

          {/* Info panel */}
          <div className="admin-info-panel">
            <ShieldCheck size={18} />
            <div>
              <strong>Administrator session active</strong>
              <p>
                You are signed in as <strong>{session.username}</strong>. This
                session expires in 8 hours. Use the sign-out button to end it
                early.
              </p>
            </div>
          </div>

          <div className="admin-connect-note">
            <p className="eyebrow">NEXT STEPS</p>
            <p>
              Connect this dashboard to Supabase to manage user accounts,
              approve pending civilian registrations, and view live audit logs.
              See the{" "}
              <a href="https://supabase.com/docs" target="_blank" rel="noreferrer">
                Supabase docs
              </a>{" "}
              to get started.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
