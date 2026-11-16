"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { sendSuperAdminTestEmail } from "../../email-actions";

const DEFAULT_TEST_MESSAGE = "This is a test email. If you read this, that means it succeed.";
const TEST_SUBJECT = "VacciTrack test email";

type TestPreview = { recipient: string; message: string };
type ResultMessage = { kind: "success" | "error"; text: string };

export default function EmailTestForm() {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState(DEFAULT_TEST_MESSAGE);
  const [preview, setPreview] = useState<TestPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);

  function reviewTest() {
    const email = recipient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResult({ kind: "error", text: "Enter a valid email address." });
      return;
    }
    if (!message.trim()) {
      setResult({ kind: "error", text: "Enter the test message." });
      return;
    }
    setResult(null);
    setPreview({ recipient: email, message: message.trim() });
  }

  async function sendTest() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await sendSuperAdminTestEmail(preview.recipient, preview.message);
      setPreview(null);
      if (response.error) {
        setResult({
          kind: "error",
          text: [response.error, response.warning].filter(Boolean).join(" "),
        });
      } else {
        setResult({
          kind: response.warning ? "error" : "success",
          text: ["Test email accepted by Google SMTP.", response.warning].filter(Boolean).join(" "),
        });
      }
    } catch {
      setPreview(null);
      setResult({ kind: "error", text: "Could not send the test email. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sms-test-panel">
      <div>
        <p className="eyebrow">SUPER-ADMIN ONLY</p>
        <h2>Test Email</h2>
        <p>Send one test email through Google SMTP to an address you control.</p>
      </div>

      <div className="sms-composer-fields">
        <label>
          Test email address
          <input
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@example.com"
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              setPreview(null);
              setResult(null);
            }}
            disabled={busy}
          />
        </label>
        <label>
          Subject
          <input type="text" value={TEST_SUBJECT} readOnly />
        </label>
        <label>
          Test message
          <textarea
            rows={4}
            maxLength={10000}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreview(null);
              setResult(null);
            }}
            disabled={busy}
          />
          <span className="sms-character-count">{message.length}/10,000 characters</span>
        </label>
      </div>

      {preview ? (
        <div className="sms-review" aria-live="polite">
          <strong>Confirm test email</strong>
          <p>Send a test email to <strong>{preview.recipient}</strong>?</p>
          <p><strong>{TEST_SUBJECT}</strong></p>
          <blockquote>{preview.message}</blockquote>
          <div className="sms-composer-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={busy}>Edit</button>
            <button className="primary-button" type="button" onClick={() => void sendTest()} disabled={busy}>
              <Send size={15} /> {busy ? "Sending..." : "Send test email"}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="secondary-button sms-review-button"
          type="button"
          onClick={reviewTest}
          disabled={busy || !recipient.trim() || !message.trim()}
        >
          <Mail size={15} /> Review test email
        </button>
      )}

      {result && (
        <p className={`sms-result ${result.kind}`} role="status">
          {result.kind === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {result.text}
        </p>
      )}
    </section>
  );
}
