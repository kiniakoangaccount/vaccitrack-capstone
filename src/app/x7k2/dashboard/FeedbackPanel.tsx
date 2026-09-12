"use client";

import { useState, useTransition } from "react";
import { Trash2, RefreshCw, Loader2, MessageSquare } from "lucide-react";
import { updateFeedbackStatus, deleteFeedback } from "./crud-actions";

interface FeedbackRow {
  id: number;
  name: string | null;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

const STATUS_CYCLE: Record<string, "New" | "Reviewed" | "Resolved"> = {
  New: "Reviewed",
  Reviewed: "Resolved",
  Resolved: "New",
};

const STATUS_COLORS: Record<string, string> = {
  New: "admin-badge-blue",
  Reviewed: "admin-badge-amber",
  Resolved: "admin-badge-green",
};

export default function FeedbackPanel({ rows }: { rows: FeedbackRow[] }) {
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [localStatus, setLocalStatus] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  function getStatus(row: FeedbackRow) {
    return localStatus[row.id] ?? row.status;
  }

  function cycleStatus(row: FeedbackRow) {
    const next = STATUS_CYCLE[getStatus(row)] ?? "New";
    setLocalStatus((prev) => ({ ...prev, [row.id]: next }));
    startTransition(async () => {
      const { error } = await updateFeedbackStatus(row.id, next);
      if (error) {
        setErrors((prev) => ({ ...prev, [row.id]: error }));
        // revert on error
        setLocalStatus((prev) => ({ ...prev, [row.id]: getStatus(row) }));
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const { error } = await deleteFeedback(id);
      if (error) { setErrors((prev) => ({ ...prev, [id]: error })); return; }
      setDeleted((prev) => new Set(prev).add(id));
    });
  }

  const visible = rows.filter((r) => !deleted.has(r.id));

  if (visible.length === 0) {
    return (
      <div className="admin-empty-state">
        <MessageSquare size={28} />
        <strong>No feedback yet</strong>
        <p>Submissions from users will appear here.</p>
      </div>
    );
  }

  return (
    <div className="admin-feedback-list">
      {visible.map((f) => {
        const status = getStatus(f);
        return (
          <article key={f.id} className="admin-feedback-card admin-feedback-card-hover">
            <div className="admin-feedback-head">
              <span className="admin-feedback-category">{f.category}</span>
              <button
                className={`admin-badge admin-badge-btn ${STATUS_COLORS[status] ?? "admin-badge-gray"}`}
                onClick={() => cycleStatus(f)}
                disabled={isPending}
                title="Click to advance status"
              >
                {isPending ? <Loader2 size={10} className="admin-spin" /> : <RefreshCw size={10} />}
                {status}
              </button>
              <span className="admin-muted admin-feedback-date">
                {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
              </span>
              <button
                className="admin-feedback-delete"
                onClick={() => handleDelete(f.id)}
                disabled={isPending}
                title="Delete feedback"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {f.name && <p className="admin-feedback-from">From: <strong>{f.name}</strong></p>}
            <p className="admin-feedback-msg">{f.message}</p>
            {errors[f.id] && <p className="admin-form-error" style={{ marginTop: 8 }}>{errors[f.id]}</p>}
          </article>
        );
      })}
    </div>
  );
}
