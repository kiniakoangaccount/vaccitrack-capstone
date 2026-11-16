import SkeletonBlock from "../../Skeleton";

export default function Loading() {
  return (
    <main className="admin-shell admin-dashboard-loading" role="status" aria-label="Loading administrator dashboard" aria-busy="true">
      <aside className="admin-sidebar" aria-hidden="true">
        <div className="admin-sidebar-brand">
          <SkeletonBlock className="admin-loading-mark" />
          <span>VacciTrack</span>
        </div>
        <p className="admin-sidebar-label">Administration</p>
        <nav className="admin-sidebar-nav">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="admin-nav-item">
              <SkeletonBlock className="admin-loading-nav-icon" />
              <SkeletonBlock className="admin-loading-nav-label" />
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <SkeletonBlock className="admin-loading-avatar" />
          <div className="admin-loading-user">
            <SkeletonBlock className="admin-loading-user-name" />
            <SkeletonBlock className="admin-loading-user-role" />
          </div>
        </div>
      </aside>

      <section className="admin-content" aria-hidden="true">
        <header className="admin-topbar">
          <SkeletonBlock className="admin-loading-crumb" />
          <SkeletonBlock className="admin-loading-session" />
        </header>
        <div className="admin-page-content">
          <div className="admin-page-heading admin-loading-heading">
            <SkeletonBlock className="admin-loading-eyebrow" />
            <SkeletonBlock className="admin-loading-title" />
            <SkeletonBlock className="admin-loading-description" />
          </div>
          <div className="admin-stat-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="admin-stat-card admin-loading-stat">
                <SkeletonBlock className="admin-loading-stat-icon" />
                <SkeletonBlock className="admin-loading-stat-number" />
                <SkeletonBlock className="admin-loading-stat-label" />
              </div>
            ))}
          </div>
          <div className="admin-quick-grid">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="admin-quick-card admin-loading-quick">
                <SkeletonBlock className="admin-loading-quick-icon" />
                <div>
                  <SkeletonBlock className="admin-loading-quick-title" />
                  <SkeletonBlock className="admin-loading-quick-description" />
                </div>
                <SkeletonBlock className="admin-loading-quick-action" />
              </div>
            ))}
          </div>
          <div className="admin-info-grid admin-loading-info-grid">
            <div className="admin-info-card"><SkeletonBlock className="admin-loading-info-line" /><SkeletonBlock className="admin-loading-info-line" /><SkeletonBlock className="admin-loading-info-action" /></div>
            <div className="admin-info-card"><SkeletonBlock className="admin-loading-info-line" /><SkeletonBlock className="admin-loading-info-line" /><SkeletonBlock className="admin-loading-info-action" /></div>
          </div>
        </div>
      </section>
    </main>
  );
}
