"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send, Users } from "lucide-react";
import { getSmsRecipientOptions, previewSmsRecipients, sendCustomSms } from "@/app/_features/messaging/sms-actions";
import SkeletonBlock from "@/app/_components/shared/Skeleton";

type SmsAudience =
  | { mode: "individual"; recipientId: string }
  | { mode: "due-in-7-days" };

type Preview = {
  audience: SmsAudience;
  count: number;
  dueDate?: string;
  fingerprint: string;
  names: string[];
};

type StatusMessage = { kind: "success" | "error"; text: string };

export function SmsComposer() {
  const [recipients, setRecipients] = useState<{ id: string; label: string }[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [mode, setMode] = useState<"individual" | "due-in-7-days">("individual");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSmsRecipientOptions()
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
        setLoadError("Could not load SMS recipients.");
        setLoadingRecipients(false);
      });
    return () => { cancelled = true; };
  }, []);

  function currentAudience(): SmsAudience | null {
    if (mode === "due-in-7-days") return { mode };
    return recipientId ? { mode, recipientId } : null;
  }

  async function reviewRecipients() {
    const audience = currentAudience();
    if (!audience) {
      setStatus({ kind: "error", text: "Select a client first." });
      return;
    }
    if (!message.trim()) {
      setStatus({ kind: "error", text: "Enter the SMS message first." });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const result = await previewSmsRecipients(audience);
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
      const result = await sendCustomSms(preview.audience, message, preview.count, preview.fingerprint);
      setPreview(null);
      if (result.sent === 0) {
        setStatus({
          kind: "error",
          text: [result.error ?? `No SMS was sent; ${result.failed} failed.`, result.warning].filter(Boolean).join(" "),
        });
      } else {
        const summary = `${result.sent} SMS sent${result.failed ? `; ${result.failed} failed` : ""}.`;
        setStatus({
          kind: result.failed || result.warning ? "error" : "success",
          text: [summary, result.detail, result.warning].filter(Boolean).join(" "),
        });
      }
    } catch {
      setPreview(null);
      setStatus({ kind: "error", text: "Could not send the SMS. Check your connection and try again." });
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
            {loadingRecipients ? (
              <span className="sms-recipient-skeleton" role="status" aria-label="Loading SMS recipients">
                <SkeletonBlock className="sms-recipient-skeleton-select" />
              </span>
            ) : (
              <select
                value={recipientId}
                onChange={(event) => {
                  setRecipientId(event.target.value);
                  setPreview(null);
                  setStatus(null);
                }}
                disabled={busy || recipients.length === 0}
              >
                {recipients.length === 0 && <option value="">No active clients with valid numbers</option>}
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>{recipient.label}</option>
                ))}
              </select>
            )}
          </label>
        ) : (
          <div className="sms-audience-note">
            <Users size={16} />
            <span>Targets active clients with vaccinated animals due exactly 7 days from today and a valid mobile number. This is a separate custom message; the scheduled reminder may also be sent.</span>
          </div>
        )}

        <label>
          Message
          <textarea
            rows={5}
            maxLength={320}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreview(null);
              setStatus(null);
            }}
            placeholder="Write the SMS message to send..."
            disabled={busy}
          />
          <span className="sms-character-count">{message.length}/320 characters</span>
        </label>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}

      {preview && (
        <section className="sms-review" aria-live="polite">
          <strong>Confirm SMS</strong>
          {preview.count === 0 ? (
            <p>No eligible recipients were found.</p>
          ) : (
            <>
              <p>
                This will send your message to <strong>{preview.count} recipient{preview.count === 1 ? "" : "s"}</strong>
                {preview.dueDate ? ` with vaccinations due on ${preview.dueDate}` : ""}.
              </p>
              {preview.names.length > 0 && (
                <p className="sms-recipient-sample">
                  {preview.names.join(", ")}{preview.count > preview.names.length ? `, and ${preview.count - preview.names.length} more` : ""}
                </p>
              )}
              <blockquote>{message}</blockquote>
            </>
          )}
          <div className="sms-composer-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={busy}>Edit</button>
            {preview.count > 0 && (
              <button className="primary-button" type="button" onClick={() => void sendMessage()} disabled={busy} data-loading={busy ? "true" : undefined} aria-busy={busy}>
                <Send size={15} /> {busy ? "Sending..." : `Send to ${preview.count}`}
              </button>
            )}
          </div>
        </section>
      )}

      {!preview && (
        <button
          className="primary-button sms-review-button" aria-busy={busy}
          type="button"
          onClick={() => void reviewRecipients()}
          disabled={busy || loadingRecipients || Boolean(loadError) || !message.trim() || (mode === "individual" && !recipientId)}
        >
          {busy ? <Loader2 size={15} className="admin-spin" /> : <Users size={15} />}
          {busy ? "Preparing..." : "Review recipients"}
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
