"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { updateProfile, updateNotificationPreferences, requestAccountOtp, changeUsernameWithOtp, changePasswordWithOtp, type ReminderLanguage } from "@/app/_features/profile/profile-actions";
import { ShieldCheck, Bell, EyeOff, User, Key, CheckCircle2, AlertCircle, Menu, X, ArrowLeft } from "lucide-react";
import WorkspaceLoadingScreen from "@/app/_components/shared/WorkspaceLoadingScreen";

function initials(fullName: string) {
  return fullName.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "VT";
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState({ fullName: "", contact: "", username: "" });
  const [reminderPreferences, setReminderPreferences] = useState({
    preferredLanguage: "en" as ReminderLanguage,
    notifySms: true,
  });
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const [usernameCodeSent, setUsernameCodeSent] = useState(false);
  const [usernameCode, setUsernameCode] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(async (result: { data: { user: SupabaseUser | null } }) => {
      const user = result.data.user;
      if (!user) { router.replace("/signin"); return; }
      const { data, error: profileError } = await supabase.from("profiles")
        .select("full_name, contact_number, username, preferred_language, notify_sms")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) setError(`Could not load your profile: ${profileError.message}`);
      setProfile({ fullName: data?.full_name ?? "", contact: data?.contact_number ?? "", username: data?.username ?? "" });
      setReminderPreferences({
        preferredLanguage: data?.preferred_language === "tl" || data?.preferred_language === "hil" ? data.preferred_language : "en",
        notifySms: data?.notify_sms ?? true,
      });
      setCheckingAuth(false);
    });
  }, [supabase, router]);

  async function sendCode(purpose: "username_change" | "password_change") {
    setError("");
    setSuccess("");
    const result = await requestAccountOtp(purpose);
    if (result.error) { setError(result.error); return false; }
    setSuccess("A verification code was sent via SMS.");
    return true;
  }

  if (checkingAuth) {
    return <WorkspaceLoadingScreen title="Checking your session" description="Loading your profile and security settings." />;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span>VacciTrack</span></div>
        <div className="workspace"><span className="workspace-dot" /> Barangay Estefania</div>
        <div className={`data-mode ${supabase ? "live" : "demo"}`}><span /> {supabase ? "Connected to Supabase" : "Demo mode"}</div>
        <button className="sidebar-close" aria-label="Close navigation" onClick={() => setShowMobileNav(false)}><X size={18} /></button>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <Link href="/" className="nav-item"><User size={17} /> My account</Link>
          <Link href="/settings" className="nav-item"><Bell size={17} /> Account settings</Link>
        </nav>
        <div className="sidebar-footer"><div className="user-row"><span className="avatar">{initials(profile.fullName)}</span><span><strong>{profile.fullName || "VacciTrack user"}</strong><small>{profile.username ? `@${profile.username}` : "No username set"}</small></span><EyeOff size={15} /></div></div>
      </aside>
      {showMobileNav && <div className="sidebar-backdrop" onClick={() => setShowMobileNav(false)} />}

      <section className="content-area">
        <header className="topbar"><div className="topbar-left"><button className="icon-button" aria-label="Back" onClick={() => window.history.back()}><ArrowLeft size={18} /></button><button className="icon-button mobile-nav-toggle" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button><div className="crumb">Account <span>/</span> Profile</div></div></header>

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

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                setSaving(true);
                const result = await updateProfile({
                  fullName: (e.currentTarget as HTMLFormElement).fullName.value.trim(),
                  contact: (e.currentTarget as HTMLFormElement).contact.value.trim(),
                });
                setSaving(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your contact details were updated.");
              }}>
                <label>Full name
                  <input className="account-input" name="fullName" defaultValue={profile.fullName} required />
                </label>
                <label>Contact number
                  <input className="account-input" name="contact" defaultValue={profile.contact} inputMode="numeric" pattern="[0-9+]{7,15}" required />
                </label>
                <div className="account-actions">
                  <button className="primary-button" type="submit" disabled={saving} data-loading={saving ? "true" : undefined} aria-busy={saving}><User size={15} /> Save changes</button>
                  <button className="secondary-button" type="reset" disabled={saving}>Cancel</button>
                </div>
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">AUTOMATIC REMINDERS</p>
              <h2>Reminder preferences</h2>
              <p className="heading-sub">Choose which automatic vaccination reminders you receive and their language. These settings do not affect messages sent directly by staff.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                setPreferencesSaving(true);
                const result = await updateNotificationPreferences(reminderPreferences);
                setPreferencesSaving(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your reminder preferences were updated.");
              }}>
                <label>Reminder language
                  <select
                    className="account-input"
                    value={reminderPreferences.preferredLanguage}
                    onChange={(e) => setReminderPreferences((current) => ({ ...current, preferredLanguage: e.target.value as ReminderLanguage }))}
                  >
                    <option value="en">English</option>
                    <option value="tl">Tagalog</option>
                    <option value="hil">Hiligaynon</option>
                  </select>
                </label>
                <label className="account-check-row">
                  <input
                    type="checkbox"
                    checked={reminderPreferences.notifySms}
                    onChange={(e) => setReminderPreferences((current) => ({ ...current, notifySms: e.target.checked }))}
                  />
                  <span>Receive automatic SMS reminders</span>
                </label>
                <p className="account-help">SMS reminders require a valid mobile number.</p>
                <div className="account-actions">
                  <button className="primary-button" type="submit" disabled={preferencesSaving} data-loading={preferencesSaving ? "true" : undefined} aria-busy={preferencesSaving}>
                    <Bell size={15} /> Save reminder preferences
                  </button>
                </div>
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">SECURITY</p>
              <h2>Change username</h2>
              <p className="heading-sub">Current username: <strong>@{profile.username || "none set"}</strong>. Verify with a code sent to your phone.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (!newUsername.trim()) { setError("Enter a new username."); return; }
                setUsernameBusy(true);
                const result = await changeUsernameWithOtp(newUsername.trim(), usernameCode.trim());
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
                {!usernameCodeSent ? (
                  <div className="account-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={usernameBusy}
                      onClick={async () => { setUsernameBusy(true); const ok = await sendCode("username_change"); setUsernameBusy(false); if (ok) setUsernameCodeSent(true); }}
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
                      <button className="primary-button" type="submit" disabled={usernameBusy || usernameCode.length !== 6} data-loading={usernameBusy ? "true" : undefined} aria-busy={usernameBusy}><Key size={15} /> Confirm change</button>
                      <button className="secondary-button" type="button" disabled={usernameBusy} onClick={() => sendCode("username_change")}>Resend code</button>
                    </div>
                  </>
                )}
              </form>
            </section>

            <section className="account-section">
              <p className="eyebrow">SECURITY</p>
              <h2>Change password</h2>
              <p className="heading-sub">Verify with a code sent to your phone — no need to remember your current password.</p>

              <form className="account-form" onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSuccess("");
                if (newPassword !== confirmPassword) { setError("The new password does not match the confirmation."); return; }
                if (newPassword.length < 8) { setError("Your new password must be at least 8 characters long."); return; }
                setPasswordBusy(true);
                const result = await changePasswordWithOtp(newPassword, passwordCode.trim());
                setPasswordBusy(false);
                if (result.error) { setError(result.error); return; }
                setSuccess("Your password was changed.");
                setPasswordCodeSent(false);
                setPasswordCode("");
                setNewPassword("");
                setConfirmPassword("");
              }}>
                {!passwordCodeSent ? (
                  <div className="account-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={passwordBusy}
                      onClick={async () => { setPasswordBusy(true); const ok = await sendCode("password_change"); setPasswordBusy(false); if (ok) setPasswordCodeSent(true); }}
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
                      <button className="primary-button" type="submit" disabled={passwordBusy || passwordCode.length !== 6 || !newPassword || !confirmPassword} data-loading={passwordBusy ? "true" : undefined} aria-busy={passwordBusy}><Key size={15} /> Update password</button>
                      <button className="secondary-button" type="button" disabled={passwordBusy} onClick={() => sendCode("password_change")}>Resend code</button>
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
