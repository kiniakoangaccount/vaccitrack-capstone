"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PawPrint, CheckCircle2 } from "lucide-react";
import { registerViaInvite } from "../../invite-register-action";

export default function InviteRegisterForm({ token, role, roleLabel }: { token: string; role: string; roleLabel: string }) {
  const [form, setForm] = useState({ username: "", fullName: "", email: "", contact: "", password: "" });
  const [idImageFile, setIdImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters long."); return; }
    if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(form.username)) {
      setError("Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    if (!/^09\d{9}$/.test(form.contact)) {
      setError("Enter a valid 11-digit Philippine mobile number starting with 09.");
      return;
    }
    if (!idImageFile) { setError("Upload a photo of a valid ID."); return; }

    const body = new FormData();
    body.set("token", token);
    body.set("email", form.email);
    body.set("password", form.password);
    body.set("fullName", form.fullName);
    body.set("username", form.username);
    body.set("contact", form.contact);
    body.set("idImage", idImageFile);

    const result = await registerViaInvite(body);
    if (result.error) { setError(result.error); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="confirmation">
            <CheckCircle2 size={30} />
            <h1>Registration submitted</h1>
            <p>
              {role === "admin"
                ? "Your administrator application is pending final approval from the super-admin."
                : "Your account is active — you can sign in now."}
            </p>
            <Link className="primary-button" href="/">Back to VacciTrack</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>
        <p className="eyebrow">STAFF INVITATION</p>
        <h1>Join as {roleLabel}</h1>
        <p className="heading-sub">You were invited to create a {roleLabel} account for VacciTrack.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Username
            <input required minLength={3} maxLength={80} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </label>
          <label>Full name
            <input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label>Email (optional)
            <input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Contact number
            <input required inputMode="numeric" pattern="09[0-9]{9}" placeholder="09171234567" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
          </label>
          <label>Valid ID photo
            <input required type="file" accept="image/*" onChange={(e) => setIdImageFile(e.target.files?.[0] ?? null)} />
          </label>
          <label>Password
            <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">Create account</button>
        </form>
      </section>
    </main>
  );
}
