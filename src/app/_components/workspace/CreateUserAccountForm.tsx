"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import type { ManagedAccountInput } from "@/lib/managed-account";

type AccountCreator = (input: ManagedAccountInput) => Promise<{ error?: string; userId?: string; username?: string }>;

export default function CreateUserAccountForm({ createAccount }: { createAccount: AccountCreator }) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagedAccountInput["role"]>("client");
  const [status, setStatus] = useState<ManagedAccountInput["status"]>("active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, pending]);

  function closeModal() {
    if (pending) return;
    setIsOpen(false);
    setError("");
    setSuccess("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await createAccount({ username, fullName, contact, password, role, status });
      if (result.error) { setError(result.error); return; }
      setSuccess(`Account created for @${result.username}. Share the username and password directly with the account holder.`);
      setUsername("");
      setFullName("");
      setContact("");
      setPassword("");
      setRole("client");
      setStatus("active");
    });
  }

  return (
    <>
      <button type="button" className="primary-button create-account-trigger" onClick={() => { setError(""); setSuccess(""); setIsOpen(true); }}><UserPlus size={16} /> Create user account</button>
      {isOpen && <div className="modal-backdrop create-account-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
        <section className="modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
          <div className="modal-heading"><div><p className="eyebrow">USER MANAGEMENT</p><h2 id="create-account-title">Create user account</h2><p className="heading-sub">Set up login credentials, role, and account status.</p></div><button type="button" className="icon-button" aria-label="Close account creation" onClick={closeModal} disabled={pending}><X size={18} /></button></div>
          <form className="create-account-form" onSubmit={submit}>
            <label>Username<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
            <label>Full name<input required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>Contact number<input required inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} placeholder="09171234567" value={contact} onChange={(event) => setContact(event.target.value.replace(/\D/g, "").slice(0, 11))} /></label>
            <label>Temporary password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value as ManagedAccountInput["role"])}><option value="client">Client / pet owner</option><option value="bhw">BHW</option><option value="viewer">Viewer</option><option value="admin">Administrator</option></select></label>
            <label>Account status<select value={status} onChange={(event) => setStatus(event.target.value as ManagedAccountInput["status"])}><option value="active">Active</option><option value="pending">Pending approval</option><option value="disabled">Disabled</option></select></label>
            <p className="create-account-note">Administrator accounts have full access to staff tools. Passwords are not sent by email or SMS.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="create-account-success" role="status" aria-live="polite">{success}</p>}
            <button className="primary-button" type="submit" disabled={pending} data-loading={pending ? "true" : undefined} aria-busy={pending}>{pending ? "Creating account…" : "Create account"}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
