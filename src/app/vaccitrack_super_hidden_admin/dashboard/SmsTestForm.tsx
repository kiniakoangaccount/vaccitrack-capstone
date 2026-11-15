"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { sendSuperAdminTestSms } from "../../sms-actions";

type TestPreview = { recipient: string; message: string };
type ResultMessage = { kind: "success" | "error"; text: string };

export default function SmsTestForm() {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<TestPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);

  function reviewTest() {
    const compact = recipient.trim().replace(/[\s()-]/g, "");
    if (!/^09\d{9}$/.test(compact) && !/^\+639\d{9}$/.test(compact)) {
      setResult({ kind: "error", text: "Enter a Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)." });
      return;
    }
    if (!message.trim()) {
      setResult({ kind: "error", text: "Enter the test message." });
      return;
    }
    setResult(null);
    setPreview({ recipient: compact, message: message.trim() });
  }

  async function sendTest() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await sendSuperAdminTestSms(preview.recipient, preview.message);
      setPreview(null);
      if (response.error) {
        setResult({
          kind: "error",
          text: [response.error, response.warning].filter(Boolean).join(" "),
        });
      } else {
        setResult({
          kind: response.warning ? "error" : "success",
          text: [`Test SMS accepted by Semaphore${response.messageId ? ` (ID ${response.messageId})` : ""}.`, response.warning].filter(Boolean).join(" "),
        });
      }
    } catch {
      setPreview(null);
      setResult({ kind: "error", text: "Could not send the test SMS. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sms-test-panel">
      <div>
        <p className="eyebrow">SUPER-ADMIN ONLY</p>
        <h2>Test SMS</h2>
        <p>Send one customizable test message to a number you control. This sends a real SMS and may use account credit.</p>
      </div>

      <div className="sms-composer-fields">
        <label>
          Test phone number
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="09171234567"
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
          Test message
          <textarea
            rows={4}
            maxLength={320}
            placeholder="Write the test message..."
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreview(null);
              setResult(null);
            }}
            disabled={busy}
          />
          <span className="sms-character-count">{message.length}/320 characters</span>
        </label>
      </div>

      {preview ? (
        <div className="sms-review" aria-live="polite">
          <strong>Confirm test SMS</strong>
          <p>Send this test to <strong>{preview.recipient}</strong>?</p>
          <blockquote>{preview.message}</blockquote>
          <div className="sms-composer-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={busy}>Edit</button>
            <button className="primary-button" type="button" onClick={() => void sendTest()} disabled={busy}>
              <Send size={15} /> {busy ? "Sending..." : "Send test SMS"}
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
          <Send size={15} /> Review test SMS
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
