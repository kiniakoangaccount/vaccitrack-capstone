"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { approveUser, rejectUser } from "./crud-actions";
import AdminConfirmDialog from "./AdminConfirmDialog";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
  id_document_reference: string | null;
  idDocumentUrl: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  client: "Pet owner",
  bhw: "Barangay Health Worker",
  admin: "Administrator application",
  viewer: "Viewer",
};

export default function PendingPanel({ profiles }: { profiles: Profile[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acted, setActed] = useState<Record<string, "approved" | "rejected">>({});
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; fullName: string; action: "approve" | "reject" } | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const { error } = await approveUser(id);
      if (error) { setErrors((prev) => ({ ...prev, [id]: error })); return; }
      setActed((prev) => ({ ...prev, [id]: "approved" }));
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const { error } = await rejectUser(id);
      if (error) { setErrors((prev) => ({ ...prev, [id]: error })); return; }
      setActed((prev) => ({ ...prev, [id]: "rejected" }));
    });
  }

  const visible = profiles.filter((p) => !acted[p.id]);

  if (visible.length === 0) {
    return (
      <div className="admin-empty-state">
        <CheckCircle2 size={28} />
        <strong>All clear</strong>
        <p>No accounts are currently pending verification.</p>
      </div>
    );
  }

  return (
    <>
    <div className="admin-pending-grid">
      {visible.map((p) => (
        <article key={p.id} className="admin-pending-card admin-pending-card-hover">
          <div className="admin-pending-head">
            <span className="admin-avatar admin-avatar-lg">{p.full_name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{p.full_name}</strong>
              <small>@{p.username ?? "no username"}</small>
            </div>
            <span className="admin-badge admin-badge-amber">pending</span>
          </div>

          <dl className="admin-pending-meta">
            <div><dt>Requesting</dt><dd>{ROLE_LABELS[p.role] ?? p.role}</dd></div>
            <div><dt>Contact</dt><dd>{p.contact_number ?? "—"}</dd></div>
            <div>
              <dt>Registered</dt>
              <dd>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</dd>
            </div>
          </dl>

          {p.idDocumentUrl ? (
            <a href={p.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="admin-id-photo-link">
              <Image
                src={p.idDocumentUrl}
                alt={`Registration photo submitted by ${p.full_name}`}
                width={640}
                height={360}
                unoptimized
                className="admin-id-photo"
              />
              <span>View full size →</span>
            </a>
          ) : (
            <p className="admin-muted">No registration photo on file.</p>
          )}

          {errors[p.id] && <p className="admin-form-error" style={{ marginBottom: 10 }}>{errors[p.id]}</p>}

          <div className="admin-pending-actions">
            <button
              className="admin-btn-approve"
              onClick={() => setConfirmTarget({ id: p.id, fullName: p.full_name, action: "approve" })}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={13} className="admin-spin" /> : <CheckCircle2 size={13} />}
              Approve
            </button>
            <button
              className="admin-btn-reject"
              onClick={() => setConfirmTarget({ id: p.id, fullName: p.full_name, action: "reject" })}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={13} className="admin-spin" /> : <XCircle size={13} />}
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
    <AdminConfirmDialog
      open={confirmTarget !== null}
      title={confirmTarget?.action === "approve" ? "Approve account" : "Reject account"}
      message={
        confirmTarget?.action === "approve"
          ? `Approve ${confirmTarget.fullName}'s account? They will be able to sign in immediately.`
          : `Reject ${confirmTarget?.fullName}'s account application? This cannot be undone.`
      }
      confirmLabel={confirmTarget?.action === "approve" ? "Approve" : "Reject"}
      danger={confirmTarget?.action === "reject"}
      busy={isPending}
      onConfirm={() => {
        if (!confirmTarget) return;
        if (confirmTarget.action === "approve") handleApprove(confirmTarget.id);
        else handleReject(confirmTarget.id);
        setConfirmTarget(null);
      }}
      onCancel={() => setConfirmTarget(null)}
    />
    </>
  );
}
