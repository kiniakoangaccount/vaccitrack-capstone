"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { updateProfile, updatePassword } from "./profile-actions";
import { ShieldCheck, Bell, Eye, EyeOff, User, Mail, Phone, Key, CheckCircle2, AlertCircle } from "lucide-react";

export default function ProfilePage() {
  const supabase = createClient();
            <section className="account-section">
              <p className="eyebrow">CONTACT DETAILS</p>
              <h2>Personal information</h2>
              <p className="heading-sub">This information is visible to barangay staff when they contact you about your animals.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                setSaving(true);
                const result = await updateProfile({
                  fullName: (e.currentTarget as HTMLFormElement).fullName.value.trim(),
                  email: (e.currentTarget as HTMLFormElement).email.value.trim(),
                  contact: (e.currentTarget as HTMLFormElement).contact.value.trim(),
                });
                setSaving(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your contact details were updated.");
              }}>
                <label>Full name
                  <input className="account-input" name="fullName" defaultValue="VacciTrack user" required />
                </label>
                <label>Email address
                  <input className="account-input" type="email" name="email" defaultValue="user@example.com" required />
                </label>
                <label>Contact number
                  <input className="account-input" name="contact" defaultValue="+639171234567" inputMode="numeric" pattern="[0-9+]{7,15}" required />
                </label>
                <div className="account-actions">
                  <button className="primary-button" type="submit" disabled={saving}><User size={15} /> Save changes</button>
                  <button className="secondary-button" type="reset" disabled={saving}>Cancel</button>
                </div>
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">SECURITY</p>
              <h2>Change password</h2>
              <p className="heading-sub">You must enter your current password to set a new one.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (newPassword !== confirmPassword) { setError("The new password does not match the confirmation."); return; }
                if (newPassword.length < 8) { setError("Your new password must be at least 8 characters long."); return; }
                setSaving(true);
                const result = await updatePassword({
                  currentPassword,
                  newPassword,
                });
                setSaving(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your password was changed. You will need to sign in again.");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}>
                <label>Current password
                  <div style={{ position: "relative" }}>
                    <input className="account-input" type={showNewPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" />
                    <button type="button" className="icon-button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} onClick={() => setShowNewPassword((v) => !v)} aria-label="Toggle password visibility"><Eye size={14} /></button>
                  </div>
                </label>
                <label>New password
                  <div style={{ position: "relative" }}>
                    <input className="account-input" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="New password (8 or more characters)" />
                    <button type="button" className="icon-button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} onClick={() => setShowNewPassword((v) => !v)} aria-label="Toggle password visibility"><Key size={14} /></button>
                  </div>
                </label>
                <label>Confirm new password
                  <div style={{ position: "relative" }}>
                    <input className="account-input" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
                    <button type="button" className="icon-button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} onClick={() => setShowConfirmPassword((v) => !v)} aria-label="Toggle password visibility"><Key size={14} /></button>
                  </div>
                </label>
                <div className="account-actions">
                  <button className="primary-button" type="submit" disabled={saving || !currentPassword || !newPassword || !confirmPassword}><Key size={15} /> Update password</button>
                  <button className="secondary-button" type="reset" disabled={saving}>Cancel</button>
                </div>
                <p className="account-help">When your password changes, any active sessions are signed out for security.</p>
              </form>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania <ChevronDown size={15} /></div>
        <div className={`data-mode ${supabase ? "live" : "demo"}`}><span /> {supabase ? "Connected to Supabase" : "Demo mode"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <a href="/" className="nav-item"><User size={17} /> My account</a>
          <a href="/settings" className="nav-item"><Bell size={17} /> Account settings</a>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">UP</span><span><strong>VacciTrack user</strong><small>Demo account</small></span><EyeOff size={15} /></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="crumb">Account <span>/</span> Profile</div><div className="top-actions"><button className="icon-button" aria-label="Back" onClick={() => window.history.back()}><Eye size={18} /></button></div></header>

        <div className="page-content">
          <div className="page-heading">
            <p className="eyebrow">MY ACCOUNT</p>
            <h1>Profile and security</h1>
            <p className="heading-sub">Update your contact details and password.</p>
          </div>

          {error && <div className="notice danger"><AlertCircle size={18} /><span>{error}</span></div>}
          {success && <div className="notice"><CheckCircle2 size={18} /><span>{success}</span></div>}

          <div className="account-page">