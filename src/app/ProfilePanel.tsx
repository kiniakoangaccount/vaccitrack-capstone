"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, UserRound } from "lucide-react";
import { updateProfile, updatePassword } from "./profile-actions";

interface ProfilePanelProps {
  userId: string;
  fullName: string;
  email: string;
  contact: string;
  role: string;
  username: string;
}

export default function ProfilePanel({ userId, fullName, email, contact, role, username }: ProfilePanelProps) {
  const [name, setName] = useState(fullName);
  const [contactNumber, setContactNumber] = useState(contact);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveProfile() {
    setError("");
    setIsSaving(true);
    if (!/^09\d{9}$/.test(contactNumber)) {
      setError("Enter a valid 11-digit Philippine mobile number starting with 09.");
      setIsSaving(false);
      return;
    }
    const { error: err } = await updateProfile(userId, { fullName: name.trim(), contact: contactNumber });
    if (err) {
      setError(err);
      setIsSaving(false);
      return;
    }
    setProfileSaved(true);
    setIsSaving(false);
    window.setTimeout(() => setProfileSaved(false), 3000);
  }

  async function savePassword() {
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setIsSaving(true);
    const { error: err } = await updatePassword(userId, newPassword);
    if (err) {
      setError(err);
      setIsSaving(false);
      return;
    }
    setPasswordSaved(true);
    setNewPassword("");
    setConfirmPassword("");
    setIsSaving(false);
    window.setTimeout(() => setPasswordSaved(false), 3000);
  }

  return (
    <div className="module-content">
      <div className="module-intro">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h2>My profile</h2>
          <p>Update your personal information and password.</p>
        </div>
        <span className="module-chip"><UserRound size={14} /> {role}</span>
      </div>

      <div className="profile-grid">
        <div className="profile-section">
          <h3>Personal information</h3>
          <div className="profile-fields">
            <label>Full name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </label>
            <label>Email
              <input value={email} disabled />
            </label>
            <label>Username
              <input value={username} disabled />
            </label>
            <label>Contact number
              <input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="09171234567"
              />
            </label>
          </div>
          {profileSaved && <p className="module-muted"><CheckCircle2 size={15} /> Profile updated successfully.</p>}
          <button className="primary-button" onClick={saveProfile} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </div>

        <div className="profile-section">
          <h3>Change password</h3>
          <div className="profile-fields">
            <label>New password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            </label>
            <label>Confirm new password
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            </label>
          </div>
          {passwordSaved && <p className="module-muted"><CheckCircle2 size={15} /> Password updated successfully.</p>}
          <button className="primary-button" onClick={savePassword} disabled={isSaving}>
            <KeyRound size={15} /> {isSaving ? "Updating..." : "Update password"}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}