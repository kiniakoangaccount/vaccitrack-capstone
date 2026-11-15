"use client";

import { useActionState } from "react";
import Link from "next/link";
import { adminLogin } from "./actions";
import { PawPrint, ShieldCheck } from "lucide-react";

type ActionState = { error: string } | null;

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, formData: FormData) => {
      const result = await adminLogin(formData);
      return result ?? null;
    },
    null
  );

  return (
    <main className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span className="admin-login-icon">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="admin-login-eyebrow">ADMINISTRATOR ACCESS</p>
            <h1 className="admin-login-title">Admin Portal</h1>
          </div>
        </div>

        <div className="admin-login-brand">
          <span className="brand-mark"><PawPrint size={16} /></span>
          <span>VacciTrack</span>
        </div>

        <form action={formAction} className="admin-login-form">
          <label>
            Username
            <input
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="Enter admin username"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter admin password"
            />
          </label>

          {state?.error && (
            <p className="admin-login-error" role="alert">
              {state.error}
            </p>
          )}

          <button className="admin-login-submit" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in as Administrator"}
          </button>
        </form>

        <Link href="/" className="admin-login-back">
          ← Back to VacciTrack
        </Link>
      </div>
    </main>
  );
}
