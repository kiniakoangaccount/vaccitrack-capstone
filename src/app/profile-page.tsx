"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { updateProfile, getAccountChannels, requestAccountOtp, changeUsernameWithOtp, changePasswordWithOtp } from "./profile-actions";
import { ShieldCheck, Bell, Eye, EyeOff, User, Key, CheckCircle2, AlertCircle } from "lucide-react";

type Channel = "email" | "sms";

export default function ProfilePage() {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState({ fullName: "", email: "", contact: "", username: "" });
  const [channels, setChannels] = useState({ hasEmail: false, hasSms: false });

  const [usernameChannel, setUsernameChannel] = useState<Channel>("sms");
  const [usernameCodeSent, setUsernameCodeSent] = useState(false);
  const [usernameCode, setUsernameCode] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [passwordChannel, setPasswordChannel] = useState<Channel>("sms");
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(async (result: { data: { user: SupabaseUser | null } }) => {
      const user = result.data.user;
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, contact_number, username").eq("id", user.id).maybeSingle();
      setProfile({ fullName: data?.full_name ?? "", email: user.email ?? "", contact: data?.contact_number ?? "", username: data?.username ?? "" });
    });
    void getAccountChannels().then((result) => {
      setChannels({ hasEmail: result.hasEmail, hasSms: result.hasSms });
      const defaultChannel: Channel = result.hasSms ? "sms" : "email";
      setUsernameChannel(defaultChannel);
      setPasswordChannel(defaultChannel);
    });
  }, [supabase]);

  async function sendCode(purpose: "username_change" | "password_change", channel: Channel) {
    setError("");
    setSuccess("");
    const result = await requestAccountOtp(purpose, channel);
    if (result.error) { setError(result.error); return false; }
    setSuccess(`A verification code was sent via ${channel === "email" ? "email" : "SMS"}.`);
    return true;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania</div>
        <div className={`data-mode ${supabase ? "live" : "demo"}`}><span /> {supabase ? "Connected to Supabase" : "Demo mode"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <Link href="/" className="nav-item"><User size={17} /> My account</Link>
          <Link href="/settings" className="nav-item"><Bell size={17} /> Account settings</Link>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">UP</span><span><strong>VacciTrack user</strong><small>Demo account</small></span><EyeOff size={15} /></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="crumb">Account <span>/</span> Profile</div><div className="top-actions"><button className="icon-button" aria-label="Back" onClick={() => window.history.back()}><Eye size={18} /></button></div></header>

        <div className="page-content">
          <div className="page-heading">
            <p className="eyebrow">MY ACCOUNT</p>
            <h1>Profile and security</h1>
            <p className="heading-sub">Update your contact details, username, and password.</p>
          </div>

          {error && <div className="notice danger"><AlertCircle size={18} /><span>{error}</span></div>}
          {success && <div className="notice"><CheckCircle2 size={18} /><span>{success}</span></div>}

          <div className="account-page">
            <section className="account-section">
              <p className="eyebrow">CONTACT DETAILS</p>
              <h2>Personal information</h2>
              <p className="heading-sub">This information is visible to barangay staff when they contact you about your animals.</p>

              <form className="account-form" key={profile.email || "profile"} onSubmit={async (e) => {
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
                  <input className="account-input" name="fullName" defaultValue={profile.fullName} required />
                </label>
                <label>Email address {!channels.hasEmail && "(none on file)"}
                  <input className="account-input" type="email" name="email" placeholder="you@example.com" defaultValue={channels.hasEmail ? profile.email : ""} />
                </label>
                <label>Contact number
                  <input className="account-input" name="contact" defaultValue={profile.contact} inputMode="numeric" pattern="[0-9+]{7,15}" required />
                </label>
                <div className="account-actions">
                  <button className="primary-button" type="submit" disabled={saving}><User size={15} /> Save changes</button>
                  <button className="secondary-button" type="reset" disabled={saving}>Cancel</button>
                </div>
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">SECURITY</p>
              <h2>Change username</h2>
              <p className="heading-sub">Current username: <strong>@{profile.username || "none set"}</strong>. Verify with a code sent to your email or phone.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (!newUsername.trim()) { setError("Enter a new username."); return; }
                setUsernameBusy(true);
                const result = await changeUsernameWithOtp(newUsername.trim(), usernameChannel, usernameCode.trim());
                setUsernameBusy(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your username was updated.");
                setProfile((p) => ({ ...p, username: newUsername.trim() }));
                setUsernameCodeSent(false);
                setUsernameCode("");
                setNewUsername("");
              }}>
                <label>New username
                  <input className="account-input" minLength={3} maxLength={80} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required placeholder="new_username" />
                </label>
                <ChannelPicker channels={channels} value={usernameChannel} onChange={setUsernameChannel} disabled={usernameCodeSent} />
                {!usernameCodeSent ? (
                  <div className="account-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={usernameBusy || (usernameChannel === "email" ? !channels.hasEmail : !channels.hasSms)}
                      onClick={async () => { setUsernameBusy(true); const ok = await sendCode("username_change", usernameChannel); setUsernameBusy(false); if (ok) setUsernameCodeSent(true); }}
                    >
                      Send verification code
                    </button>
                  </div>
                ) : (
                  <>
                    <label>Verification code
                      <input className="account-input" inputMode="numeric" maxLength={6} value={usernameCode} onChange={(e) => setUsernameCode(e.target.value.replace(/\D/g, ""))} required placeholder="6-digit code" />
                    </label>
                    <div className="account-actions">
                      <button className="primary-button" type="submit" disabled={usernameBusy || usernameCode.length !== 6}><Key size={15} /> Confirm change</button>
                      <button className="secondary-button" type="button" disabled={usernameBusy} onClick={() => sendCode("username_change", usernameChannel)}>Resend code</button>
                    </div>
                  </>
                )}
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">SECURITY</p>
              <h2>Change password</h2>
              <p className="heading-sub">Verify with a code sent to your email or phone — no need to remember your current password.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (newPassword !== confirmPassword) { setError("The new password does not match the confirmation."); return; }
                if (newPassword.length < 8) { setError("Your new password must be at least 8 characters long."); return; }
                setPasswordBusy(true);
                const result = await changePasswordWithOtp(newPassword, passwordChannel, passwordCode.trim());
                setPasswordBusy(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your password was changed.");
                setPasswordCodeSent(false);
                setPasswordCode("");
                setNewPassword("");
                setConfirmPassword("");
              }}>
                <ChannelPicker channels={channels} value={passwordChannel} onChange={setPasswordChannel} disabled={passwordCodeSent} />
                {!passwordCodeSent ? (
                  <div className="account-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={passwordBusy || (passwordChannel === "email" ? !channels.hasEmail : !channels.hasSms)}
                      onClick={async () => { setPasswordBusy(true); const ok = await sendCode("password_change", passwordChannel); setPasswordBusy(false); if (ok) setPasswordCodeSent(true); }}
                    >
                      Send verification code
                    </button>
                  </div>
                ) : (
                  <>
                    <label>Verification code
                      <input className="account-input" inputMode="numeric" maxLength={6} value={passwordCode} onChange={(e) => setPasswordCode(e.target.value.replace(/\D/g, ""))} required placeholder="6-digit code" />
                    </label>
                    <label>New password
                      <input className="account-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="New password (8 or more characters)" />
                    </label>
                    <label>Confirm new password
                      <input className="account-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
                    </label>
                    <div className="account-actions">
                      <button className="primary-button" type="submit" disabled={passwordBusy || passwordCode.length !== 6 || !newPassword || !confirmPassword}><Key size={15} /> Update password</button>
                      <button className="secondary-button" type="button" disabled={passwordBusy} onClick={() => sendCode("password_change", passwordChannel)}>Resend code</button>
                    </div>
                  </>
                )}
              </form>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChannelPicker({ channels, value, onChange, disabled }: { channels: { hasEmail: boolean; hasSms: boolean }; value: Channel; onChange: (c: Channel) => void; disabled: boolean }) {
  return (
    <label>Send code via
      <select className="account-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Channel)}>
        {channels.hasSms && <option value="sms">SMS</option>}
        {channels.hasEmail && <option value="email">Email</option>}
        {!channels.hasSms && !channels.hasEmail && <option value="sms">No verified contact on file</option>}
      </select>
    </label>
  );
}
