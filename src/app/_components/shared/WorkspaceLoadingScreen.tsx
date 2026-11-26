"use client";

import { PawPrint } from "lucide-react";
import SkeletonBlock from "@/app/_components/shared/Skeleton";

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
        <div className="workspace-loading-skeleton" aria-hidden="true">
          <div className="workspace-loading-skeleton-heading">
            <SkeletonBlock className="workspace-loading-skeleton-title" />
            <SkeletonBlock className="workspace-loading-skeleton-control" />
          </div>
          <div className="workspace-loading-skeleton-stats">
            <SkeletonBlock className="workspace-loading-skeleton-stat" />
            <SkeletonBlock className="workspace-loading-skeleton-stat" />
            <SkeletonBlock className="workspace-loading-skeleton-stat" />
          </div>
          <div className="workspace-loading-skeleton-row">
            <SkeletonBlock className="workspace-loading-skeleton-line" />
            <SkeletonBlock className="workspace-loading-skeleton-line workspace-loading-skeleton-line-short" />
          </div>
          <div className="workspace-loading-skeleton-row">
            <SkeletonBlock className="workspace-loading-skeleton-line" />
            <SkeletonBlock className="workspace-loading-skeleton-line workspace-loading-skeleton-line-short" />
          </div>
        </div>
        <div className="workspace-loading-track" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}
