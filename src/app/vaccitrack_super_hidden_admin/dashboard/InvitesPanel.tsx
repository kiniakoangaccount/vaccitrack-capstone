"use client";

import { useState, useTransition } from "react";
import { UserPlus, Copy, Trash2, Loader2 } from "lucide-react";
import { createStaffInvite, revokeStaffInvite, type StaffInvite } from "./crud-actions";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { copyTextToClipboard } from "./clipboard";

const ROLE_LABELS: Record<string, string> = {
  bhw: "Barangay Health Worker",
  admin: "Administrator",
};

export default function InvitesPanel({ invites }: { invites: StaffInvite[] }) {
  const [role, setRole] = useState<"bhw" | "admin">("bhw");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null);

  function generate() {
    setErrorMsg("");
    setGeneratedLink("");
    setCopyStatus("");
    startTransition(async () => {
      const { token, error } = await createStaffInvite(role);
      if (error || !token) { setErrorMsg(error ?? "Could not create the invite link."); return; }
      setGeneratedLink(`${window.location.origin}/invite/${token}`);
    });
  }

  function revoke(id: number) {
    startTransition(async () => {
      await revokeStaffInvite(id);
    });
  }

  async function copyInviteLink() {
    try {
      await copyTextToClipboard(generatedLink);
      setCopyStatus("Invite link copied.");
    } catch {
      setCopyStatus("Could not copy the invite link. Select and copy it manually.");
    }
  }

  return (
    <>
      <div className="admin-info-card" style={{ marginBottom: 20 }}>
        <div className="admin-info-head"><UserPlus size={16} /><span>Generate an invite link</span></div>
        <p className="admin-muted">BHW invites activate the account immediately once someone registers through the link. Administrator invites still land in Pending verification for your final approval.</p>
        <div className="admin-row-actions" style={{ marginTop: 10, gap: 10 }}>
          <select className="admin-form-select" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="bhw">Barangay Health Worker</option>
            <option value="admin">Administrator</option>
          </select>
          <button className="admin-btn-primary" onClick={() => setConfirmGenerate(true)} disabled={isPending}>
            {isPending ? <Loader2 size={14} className="admin-spin" /> : <UserPlus size={14} />}
            Generate link
          </button>
        </div>
        {generatedLink && (
          <div className="admin-generated-password" style={{ marginTop: 12 }}>
            <code>{generatedLink}</code>
            <button type="button" className="admin-action-btn" title="Copy invite link" aria-label="Copy invite link" onClick={() => void copyInviteLink()}><Copy size={13} /></button>
          </div>
          {copyStatus && <p className="admin-muted" role="status" aria-live="polite">{copyStatus}</p>}
        )}
        {errorMsg && <p className="admin-form-error">{errorMsg}</p>}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Role</th><th>Status</th><th>Expires</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr><td colSpan={5} className="admin-table-empty">No invites generated yet.</td></tr>
            )}
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const status = inv.used_at ? "used" : expired ? "expired" : "active";
              const statusColor = status === "used" ? "admin-badge-green" : status === "expired" ? "admin-badge-gray" : "admin-badge-amber";
              return (
                <tr key={inv.id} className="admin-table-row">
                  <td><span className="admin-badge admin-badge-blue">{ROLE_LABELS[inv.role] ?? inv.role}</span></td>
                  <td><span className={`admin-badge ${statusColor}`}>{status}</span></td>
                  <td className="admin-muted admin-nowrap">{new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                  <td className="admin-muted admin-nowrap">{new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                  <td>
                    {status === "active" && (
                      <button className="admin-action-btn admin-action-delete" onClick={() => setRevokeTarget(inv.id)} title="Revoke" disabled={isPending}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AdminConfirmDialog
        open={confirmGenerate}
        title="Generate invite link"
        message={`Generate a new ${ROLE_LABELS[role]} invite link?`}
        confirmLabel="Generate"
        busy={isPending}
        onConfirm={() => { setConfirmGenerate(false); generate(); }}
        onCancel={() => setConfirmGenerate(false)}
      />
      <AdminConfirmDialog
        open={revokeTarget !== null}
        title="Revoke invite link"
        message="Revoke this invite link? Anyone holding it will no longer be able to use it."
        confirmLabel="Revoke"
        danger
        busy={isPending}
        onConfirm={() => { if (revokeTarget !== null) revoke(revokeTarget); setRevokeTarget(null); }}
        onCancel={() => setRevokeTarget(null)}
      />
    </>
  );
}
