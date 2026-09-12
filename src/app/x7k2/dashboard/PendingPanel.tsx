"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { approveUser, rejectUser } from "./crud-actions";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  status: string;
  contact_number: string | null;
  id_document_reference: string | null;
  created_at: string;
}

export default function PendingPanel({ profiles }: { profiles: Profile[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acted, setActed] = useState<Record<string, "approved" | "rejected">>({});
  const [isPending, startTransition] = useTransition();

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
            <div><dt>Contact</dt><dd>{p.contact_number ?? "—"}</dd></div>
            <div><dt>ID reference</dt><dd>{p.id_document_reference ?? "—"}</dd></div>
            <div>
              <dt>Registered</dt>
              <dd>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</dd>
            </div>
          </dl>

          {errors[p.id] && <p className="admin-form-error" style={{ marginBottom: 10 }}>{errors[p.id]}</p>}

          <div className="admin-pending-actions">
            <button
              className="admin-btn-approve"
              onClick={() => handleApprove(p.id)}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={13} className="admin-spin" /> : <CheckCircle2 size={13} />}
              Approve
            </button>
            <button
              className="admin-btn-reject"
              onClick={() => handleReject(p.id)}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={13} className="admin-spin" /> : <XCircle size={13} />}
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
