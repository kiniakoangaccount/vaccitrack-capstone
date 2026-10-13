"use client";

import { Loader2, X } from "lucide-react";

export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="admin-modal admin-modal-sm">
        <div className="admin-modal-head">
          <h2>{title}</h2>
          <button className="admin-modal-close" onClick={onCancel} disabled={busy}><X size={18} /></button>
        </div>
        <div className="admin-modal-body">
          <p className="admin-confirm-text">{message}</p>
          {error && <p className="admin-form-error">{error}</p>}
        </div>
        <div className="admin-modal-foot">
          <button className="admin-btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? "admin-btn-danger" : "admin-btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 size={14} className="admin-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
