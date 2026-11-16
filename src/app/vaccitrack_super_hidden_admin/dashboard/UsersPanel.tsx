"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X, Check, Loader2, KeyRound, Copy } from "lucide-react";
import { updateUserRole, updateUserStatus, updateUserReminderPreferences, deleteUser, resetUserPassword, setUserPassword } from "./crud-actions";
import AdminConfirmDialog from "./AdminConfirmDialog";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  status: string;
  contact_number: string | null;
  preferred_language: "en" | "tl" | "hil";
  notify_sms: boolean;
  notify_email: boolean;
  created_at: string;
}

const ROLES = ["admin", "bhw", "client", "viewer"] as const;
const STATUSES = ["active", "disabled", "pending"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "admin-badge-red",
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
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<"set" | "generate">("set");
  const [customPassword, setCustomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLanguage, setEditLanguage] = useState<"en" | "tl" | "hil">("en");
  const [editNotifySms, setEditNotifySms] = useState(true);
  const [editNotifyEmail, setEditNotifyEmail] = useState(true);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  function openReset(p: Profile) {
    setResetTarget(p);
    setResetPassword("");
    setCustomPassword("");
    setConfirmPassword("");
    setPasswordSuccess(false);
    setPasswordMode("set");
    setErrorMsg("");
  }

  function confirmGenerate() {
    if (!resetTarget) return;
    startTransition(async () => {
      const { password, error } = await resetUserPassword(resetTarget.id);
      if (error) { setErrorMsg(error); return; }
      setResetPassword(password ?? "");
    });
  }

  function confirmSetPassword() {
    if (!resetTarget) return;
    if (customPassword.length < 8) { setErrorMsg("Password must be at least 8 characters long."); return; }
    if (customPassword !== confirmPassword) { setErrorMsg("Passwords do not match."); return; }
    setErrorMsg("");
    startTransition(async () => {
      const { error } = await setUserPassword(resetTarget.id, customPassword);
      if (error) { setErrorMsg(error); return; }
      setPasswordSuccess(true);
    });
  }

  function closeReset() {
    setResetTarget(null);
    setResetPassword("");
    setCustomPassword("");
    setConfirmPassword("");
    setPasswordSuccess(false);
    setPasswordMode("set");
    setErrorMsg("");
  }

  function openEdit(p: Profile) {
    setEditTarget(p);
    setEditRole(p.role);
    setEditStatus(p.status);
    setEditLanguage(p.preferred_language ?? "en");
    setEditNotifySms(p.notify_sms ?? true);
    setEditNotifyEmail(p.notify_email ?? true);
    setErrorMsg("");
  }

  function closeEdit() {
    setEditTarget(null);
    setConfirmSaveEdit(false);
    setErrorMsg("");
  }

  function saveEdit() {
    if (!editTarget) return;
    setConfirmSaveEdit(true);
  }

  function performSaveEdit() {
    if (!editTarget) return;
    setConfirmSaveEdit(false);
    setErrorMsg("");
    startTransition(async () => {
      const updates: Array<() => Promise<{ error?: string }>> = [
        () => editRole !== editTarget.role ? updateUserRole(editTarget.id, editRole) : Promise.resolve({}),
        () => editStatus !== editTarget.status ? updateUserStatus(editTarget.id, editStatus) : Promise.resolve({}),
        () => editLanguage !== editTarget.preferred_language
          || editNotifySms !== editTarget.notify_sms
          || editNotifyEmail !== editTarget.notify_email
          ? updateUserReminderPreferences(editTarget.id, {
            preferredLanguage: editLanguage,
            notifySms: editNotifySms,
            notifyEmail: editNotifyEmail,
          })
          : Promise.resolve({}),
      ];
      for (const update of updates) {
        const { error } = await update();
        if (error) { setErrorMsg(error); return; }
      }
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
                    <button className="admin-action-btn admin-action-edit" onClick={() => openEdit(p)} title="Edit account and reminder preferences">
                      <Pencil size={13} />
                    </button>
                    <button className="admin-action-btn admin-action-edit" onClick={() => openReset(p)} title="Change password">
                      <KeyRound size={13} />
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
              <label className="admin-form-label">
                Reminder language
                <select className="admin-form-select" value={editLanguage} onChange={(e) => setEditLanguage(e.target.value as "en" | "tl" | "hil")}>
                  <option value="en">English</option>
                  <option value="tl">Tagalog</option>
                  <option value="hil">Hiligaynon</option>
                </select>
              </label>
              <label className="admin-form-label admin-check-label">
                Automatic SMS reminders
                <input type="checkbox" checked={editNotifySms} onChange={(e) => setEditNotifySms(e.target.checked)} />
              </label>
              <label className="admin-form-label admin-check-label">
                Automatic email reminders
                <input type="checkbox" checked={editNotifyEmail} onChange={(e) => setEditNotifyEmail(e.target.checked)} />
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

      <AdminConfirmDialog
        open={confirmSaveEdit && editTarget !== null}
        title="Save account changes"
        message={editTarget ? `Save changes to ${editTarget.full_name}'s account, including reminder preferences? Role: ${editRole}, status: ${editStatus}.` : ""}
        confirmLabel="Save changes"
        busy={isPending}
        onConfirm={performSaveEdit}
        onCancel={() => setConfirmSaveEdit(false)}
      />

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
      {/* ── Change password ── */}
      {resetTarget && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeReset()}>
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-head">
              <h2>Change password</h2>
              <button className="admin-modal-close" onClick={closeReset}><X size={18} /></button>
            </div>
            <div className="admin-modal-body">
              {!resetPassword && !passwordSuccess && (
                <div className="admin-row-actions">
                  <button type="button" className={passwordMode === "set" ? "admin-btn-primary" : "admin-btn-secondary"} onClick={() => { setPasswordMode("set"); setErrorMsg(""); }}>Set password</button>
                  <button type="button" className={passwordMode === "generate" ? "admin-btn-primary" : "admin-btn-secondary"} onClick={() => { setPasswordMode("generate"); setErrorMsg(""); }}>Generate random</button>
                </div>
              )}

              {passwordSuccess ? (
                <p className="admin-confirm-text">Password updated for <strong>{resetTarget.full_name}</strong>. Share it with them directly — it will not be shown again here.</p>
              ) : resetPassword ? (
                <>
                  <p className="admin-confirm-text">Share this password with <strong>{resetTarget.full_name}</strong> now — it will not be shown again.</p>
                  <div className="admin-generated-password">
                    <code>{resetPassword}</code>
                    <button type="button" className="admin-action-btn" title="Copy" onClick={() => navigator.clipboard?.writeText(resetPassword)}><Copy size={13} /></button>
                  </div>
                </>
              ) : passwordMode === "set" ? (
                <>
                  <p className="admin-confirm-text">Set a specific new password for <strong>{resetTarget.full_name}</strong>. Their current password stops working immediately.</p>
                  <label className="admin-form-label">New password
                    <input className="admin-form-select" type="password" minLength={8} autoComplete="new-password" value={customPassword} onChange={(e) => setCustomPassword(e.target.value)} placeholder="At least 8 characters" />
                  </label>
                  <label className="admin-form-label">Confirm password
                    <input className="admin-form-select" type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-type the password" />
                  </label>
                </>
              ) : (
                <p className="admin-confirm-text">
                  Generate a new random password for <strong>{resetTarget.full_name}</strong>. Their current password stops working immediately — share the new one with them directly, then have them change it from their account settings.
                </p>
              )}
              {errorMsg && <p className="admin-form-error">{errorMsg}</p>}
            </div>
            <div className="admin-modal-foot">
              <button className="admin-btn-secondary" onClick={closeReset} disabled={isPending}>{resetPassword || passwordSuccess ? "Done" : "Cancel"}</button>
              {!resetPassword && !passwordSuccess && passwordMode === "set" && (
                <button className="admin-btn-primary" onClick={confirmSetPassword} disabled={isPending || !customPassword || !confirmPassword}>
                  {isPending ? <Loader2 size={14} className="admin-spin" /> : <KeyRound size={14} />}
                  Set password
                </button>
              )}
              {!resetPassword && !passwordSuccess && passwordMode === "generate" && (
                <button className="admin-btn-primary" onClick={confirmGenerate} disabled={isPending}>
                  {isPending ? <Loader2 size={14} className="admin-spin" /> : <KeyRound size={14} />}
                  Generate new password
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
