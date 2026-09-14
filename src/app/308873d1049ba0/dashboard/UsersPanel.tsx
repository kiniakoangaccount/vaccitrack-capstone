"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { updateUserRole, updateUserStatus, deleteUser } from "./crud-actions";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
  created_at: string;
}

const ROLES = ["admin", "veterinarian", "bhw", "client", "viewer"] as const;
const STATUSES = ["active", "disabled", "pending"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "admin-badge-red",
  veterinarian: "admin-badge-purple",
  bhw: "admin-badge-blue",
  client: "admin-badge-green",
  viewer: "admin-badge-gray",
};
const STATUS_COLORS: Record<string, string> = {
  active: "admin-badge-green",
  pending: "admin-badge-amber",
  disabled: "admin-badge-gray",
};

export default function UsersPanel({ profiles }: { profiles: Profile[] }) {
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  function openEdit(p: Profile) {
    setEditTarget(p);
    setEditRole(p.role);
    setEditStatus(p.status);
    setErrorMsg("");
  }

  function closeEdit() {
    setEditTarget(null);
    setErrorMsg("");
  }

  function saveEdit() {
    if (!editTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const [r1, r2] = await Promise.all([
        editRole !== editTarget.role ? updateUserRole(editTarget.id, editRole) : Promise.resolve({}),
        editStatus !== editTarget.status ? updateUserStatus(editTarget.id, editStatus) : Promise.resolve({}),
      ]);
      const err = (r1 as { error?: string }).error ?? (r2 as { error?: string }).error;
      if (err) { setErrorMsg(err); return; }
      closeEdit();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const { error } = await deleteUser(deleteTarget.id);
      if (error) { setErrorMsg(error); return; }
      setDeleteTarget(null);
    });
  }

  return (
    <>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && (
              <tr><td colSpan={7} className="admin-table-empty">No user accounts found.</td></tr>
            )}
            {profiles.map((p) => (
              <tr key={p.id} className="admin-table-row">
                <td><strong>{p.full_name}</strong></td>
                <td className="admin-muted">@{p.username ?? "—"}</td>
                <td><span className={`admin-badge ${ROLE_COLORS[p.role] ?? "admin-badge-gray"}`}>{p.role}</span></td>
                <td><span className={`admin-badge ${STATUS_COLORS[p.status] ?? "admin-badge-gray"}`}>{p.status}</span></td>
                <td className="admin-muted">{p.contact_number ?? "—"}</td>
                <td className="admin-muted admin-nowrap">
                  {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button className="admin-action-btn admin-action-edit" onClick={() => openEdit(p)} title="Edit role / status">
                      <Pencil size={13} />
                    </button>
                    <button className="admin-action-btn admin-action-delete" onClick={() => { setDeleteTarget(p); setErrorMsg(""); }} title="Delete account">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ── */}
      {editTarget && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeEdit()}>
          <div className="admin-modal">
            <div className="admin-modal-head">
              <div>
                <p className="eyebrow">EDIT ACCOUNT</p>
                <h2>{editTarget.full_name}</h2>
              </div>
              <button className="admin-modal-close" onClick={closeEdit}><X size={18} /></button>
            </div>

            <div className="admin-modal-body">
              <label className="admin-form-label">
                Role
                <select className="admin-form-select" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="admin-form-label">
                Status
                <select className="admin-form-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {errorMsg && <p className="admin-form-error">{errorMsg}</p>}
            </div>

            <div className="admin-modal-foot">
              <button className="admin-btn-secondary" onClick={closeEdit} disabled={isPending}>Cancel</button>
              <button className="admin-btn-primary" onClick={saveEdit} disabled={isPending}>
                {isPending ? <Loader2 size={14} className="admin-spin" /> : <Check size={14} />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-head">
              <h2>Delete account?</h2>
              <button className="admin-modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            </div>
            <div className="admin-modal-body">
              <p className="admin-confirm-text">
                This will permanently delete <strong>{deleteTarget.full_name}</strong> and all their data. This cannot be undone.
              </p>
              {errorMsg && <p className="admin-form-error">{errorMsg}</p>}
            </div>
            <div className="admin-modal-foot">
              <button className="admin-btn-secondary" onClick={() => setDeleteTarget(null)} disabled={isPending}>Cancel</button>
              <button className="admin-btn-danger" onClick={confirmDelete} disabled={isPending}>
                {isPending ? <Loader2 size={14} className="admin-spin" /> : <Trash2 size={14} />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
