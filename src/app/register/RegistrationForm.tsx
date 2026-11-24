"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, PawPrint, X } from "lucide-react";
import ProfilePhotoInput from "../ProfilePhotoInput";
import { registerUser } from "../register-action";

export default function RegistrationForm() {
  const [form, setForm] = useState({ username: "", fullName: "", contact: "", password: "" });
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!profilePhoto) {
      setError("Choose a photo of yourself or use your camera.");
      return;
    }
    if (!acceptedTerms) {
      setError("You must agree to the Terms and Conditions to register.");
      return;
    }

    const body = new FormData();
    body.set("password", form.password);
    body.set("fullName", form.fullName);
    body.set("username", form.username);
    body.set("contact", form.contact);
    body.set("profilePhoto", profilePhoto);

    setIsSubmitting(true);
    try {
      const result = await registerUser(body);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="confirmation">
            <CheckCircle2 size={30} />
            <h1>Registration submitted</h1>
            <p>Your account is pending administrator approval. You can sign in once an administrator activates it.</p>
            <Link className="primary-button" href="/signin">Back to sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-register">
        <Link className="auth-back" href="/">Back to VacciTrack</Link>
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>
        <p className="eyebrow">CIVILIAN ACCOUNT REQUEST</p>
        <h1>Create your account</h1>
        <p className="heading-sub">Create a pet-owner account to manage your animals and vaccination records.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Username
            <input required minLength={3} maxLength={80} autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>Full name
            <input required maxLength={120} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </label>
          <label>Contact number
            <input required inputMode="numeric" pattern="09[0-9]{9}" autoComplete="tel" placeholder="09171234567" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value.replace(/\D/g, "").slice(0, 11) })} />
          </label>
          <ProfilePhotoInput value={profilePhoto} onChange={setProfilePhoto} />
          <label>Password
            <div className="password-field">
              <input required minLength={8} type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <p className="terms-intro">Please review our <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>Terms and Conditions</button> before registering.</p>
          <label className="terms-check">
            <input required type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span className="terms-check-copy">I have read and agree to <span className="terms-agreement-phrase">the <button type="button" className="terms-link" onClick={(event) => { event.stopPropagation(); setShowTerms(true); }}>Terms and Conditions</button></span>.</span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit for verification"}
          </button>
          {isSubmitting && <p className="signup-status" role="status" aria-live="polite">Creating your account and uploading your photo. Please wait.</p>}
        </form>
        <p className="auth-switch-row">Already have an account? <Link className="auth-inline-link" href="/signin">Sign in</Link></p>
      </section>
      {showTerms && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowTerms(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
            <div className="modal-heading">
              <div><p className="eyebrow">PLEASE READ</p><h2 id="terms-title">Terms and Conditions</h2></div>
              <button type="button" className="icon-button" aria-label="Close Terms and Conditions" onClick={() => setShowTerms(false)}><X size={18} /></button>
            </div>
            <div className="terms-modal-body">
              <p>By registering, you confirm the information, contact number, and photo you submit are accurate, current, and belong to you. You are responsible for keeping your password confidential and for activity under your account.</p>
              <p>This account is for registering your own animals and tracking their vaccination records. Civilian accounts are approved manually: your account stays pending, and may be rejected or later suspended, until an administrator reviews your photo and finds the submitted information accurate.</p>
              <p>Data you provide, including owner, contact, animal, and location details, is used only for barangay animal health record-keeping, vaccination scheduling and outreach, and stray/pound tracking, and may be reviewed by BHW and administrator staff. Account actions may be logged for security and audit purposes.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
