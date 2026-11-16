"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send, Users } from "lucide-react";
import { getEmailRecipientOptions, previewEmailRecipients, sendCustomEmail } from "./email-actions";

type EmailAudience =
  | { mode: "individual"; recipientId: string }
  | { mode: "due-in-7-days" };

type Preview = {
  audience: EmailAudience;
  count: number;
  dueDate?: string;
  fingerprint: string;
  names: string[];
};

type StatusMessage = { kind: "success" | "error"; text: string };

export function EmailComposer() {
  const [recipients, setRecipients] = useState<{ id: string; label: string }[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [mode, setMode] = useState<"individual" | "due-in-7-days">("individual");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getEmailRecipientOptions()
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setLoadError(result.error);
        } else {
          setRecipients(result.recipients);
          setRecipientId(result.recipients[0]?.id ?? "");
        }
        setLoadingRecipients(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Could not load email recipients.");
        setLoadingRecipients(false);
      });
    return () => { cancelled = true; };
  }, []);

  function currentAudience(): EmailAudience | null {
    if (mode === "due-in-7-days") return { mode };
    return recipientId ? { mode, recipientId } : null;
  }

  async function reviewRecipients() {
    const audience = currentAudience();
    if (!audience) {
      setStatus({ kind: "error", text: "Select a client first." });
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setStatus({ kind: "error", text: "Enter both an email subject and message first." });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const result = await previewEmailRecipients(audience);
      if (result.error) {
        setStatus({ kind: "error", text: result.error });
      } else if (result.count === undefined || !result.fingerprint) {
        setStatus({ kind: "error", text: "Could not preview the recipients." });
      } else {
        setPreview({
          audience,
          count: result.count,
          dueDate: result.dueDate,
          fingerprint: result.fingerprint,
          names: result.names ?? [],
        });
      }
    } catch {
      setStatus({ kind: "error", text: "Could not preview the recipients." });
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!preview) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await sendCustomEmail(preview.audience, subject, message, preview.count, preview.fingerprint);
      setPreview(null);
      if (result.sent === 0) {
        setStatus({
          kind: "error",
          text: [result.error ?? `No email was sent; ${result.failed} failed.`, result.warning].filter(Boolean).join(" "),
        });
      } else {
        const summary = `${result.sent} email${result.sent === 1 ? "" : "s"} sent${result.failed ? `; ${result.failed} failed` : ""}.`;
        setStatus({
          kind: result.failed || result.warning ? "error" : "success",
          text: [summary, result.detail, result.warning].filter(Boolean).join(" "),
        });
      }
    } catch {
      setPreview(null);
      setStatus({ kind: "error", text: "Could not send the email. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const changeMode = (nextMode: "individual" | "due-in-7-days") => {
    setMode(nextMode);
    setPreview(null);
    setStatus(null);
  };

  return (
    <div className="sms-composer">
      <div className="sms-composer-fields">
        <label>
          Recipients
          <select
            value={mode}
            onChange={(event) => changeMode(event.target.value as "individual" | "due-in-7-days")}
            disabled={busy}
          >
            <option value="individual">One client</option>
            <option value="due-in-7-days">Clients with vaccinations due in 7 days</option>
          </select>
        </label>

        {mode === "individual" ? (
          <label>
            Client
            <select
              value={recipientId}
              onChange={(event) => {
                setRecipientId(event.target.value);
                setPreview(null);
                setStatus(null);
              }}
              disabled={busy || loadingRecipients || recipients.length === 0}
            >
              {recipients.length === 0 && <option value="">No active clients with a valid email</option>}
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>{recipient.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="sms-audience-note">
            <Users size={16} />
            <span>Targets active clients with vaccinated animals due exactly 7 days from today and a valid email address. Clients are only emailed once, even if multiple animals are due.</span>
          </div>
        )}

        <label>
          Subject
          <input
            type="text"
            maxLength={160}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setPreview(null);
              setStatus(null);
            }}
            placeholder="Write the email subject..."
            disabled={busy}
          />
          <span className="sms-character-count">{subject.length}/160 characters</span>
        </label>

        <label>
          Message
          <textarea
            rows={7}
            maxLength={10000}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreview(null);
              setStatus(null);
            }}
            placeholder="Write the email message..."
            disabled={busy}
          />
          <span className="sms-character-count">{message.length}/10,000 characters</span>
        </label>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}
      {loadingRecipients && <p className="sms-inline-status"><Loader2 size={15} className="admin-spin" /> Loading recipients...</p>}

      {preview && (
        <section className="sms-review" aria-live="polite">
          <strong>Confirm email</strong>
          {preview.count === 0 ? (
            <p>No eligible recipients were found.</p>
          ) : (
            <>
              <p>
                This will send your email to <strong>{preview.count} recipient{preview.count === 1 ? "" : "s"}</strong>
                {preview.dueDate ? ` with vaccinations due on ${preview.dueDate}` : ""}.
              </p>
              {preview.names.length > 0 && (
                <p className="sms-recipient-sample">
                  {preview.names.join(", ")}{preview.count > preview.names.length ? `, and ${preview.count - preview.names.length} more` : ""}
                </p>
              )}
              <p><strong>{subject}</strong></p>
              <blockquote>{message}</blockquote>
            </>
          )}
          <div className="sms-composer-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={busy}>Edit</button>
            {preview.count > 0 && (
              <button className="primary-button" type="button" onClick={() => void sendMessage()} disabled={busy}>
                <Send size={15} /> {busy ? "Sending..." : `Send to ${preview.count}`}
              </button>
            )}
          </div>
        </section>
      )}

      {!preview && (
        <button
          className="primary-button sms-review-button"
          type="button"
          onClick={() => void reviewRecipients()}
          disabled={busy || loadingRecipients || Boolean(loadError) || !subject.trim() || !message.trim() || (mode === "individual" && !recipientId)}
        >
          {busy ? <Loader2 size={15} className="admin-spin" /> : <Mail size={15} />}
          {busy ? "Preparing..." : "Review email recipients"}
        </button>
      )}

      {status && (
        <p className={`sms-result ${status.kind}`} role="status">
          {status.kind === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {status.text}
        </p>
      )}
    </div>
  );
}
