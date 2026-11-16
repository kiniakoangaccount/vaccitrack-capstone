"use client";

import { PawPrint } from "lucide-react";

export default function WorkspaceLoadingScreen({
  title = "Preparing your workspace",
  description = "Checking your account and loading the right workspace.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="workspace-loading" aria-busy="true">
      <section className="workspace-loading-card" aria-labelledby="workspace-loading-title">
        <div className="workspace-loading-brand">
          <span className="brand-mark"><PawPrint size={20} /></span>
          <span>VacciTrack</span>
        </div>
        <div className="workspace-loading-message" role="status" aria-live="polite">
          <h1 id="workspace-loading-title">{title}</h1>
          <p>{description}</p>
        </div>
        <div className="workspace-loading-track" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}
