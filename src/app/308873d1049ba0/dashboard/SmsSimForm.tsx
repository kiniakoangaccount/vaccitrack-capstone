"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { simulateSmsAlert } from "../../audit-actions";

interface SmsSimFormProps {
  onSimulated?: () => void;
}

export function SmsSimForm({ onSimulated }: SmsSimFormProps = {}) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipient || !message) return;
    setStatus("sending");
    const { error } = await simulateSmsAlert(null, recipient, message);
    if (!error) {
      setStatus("success");
      setLastResult("SMS simulation recorded in the audit log.");
      setRecipient("");
      setMessage("");
      onSimulated?.();
    } else {
      setStatus("error");
      setLastResult(error);
    }
    setTimeout(() => setStatus("idle"), 3500);
  };

  return (
    <form className="sms-sim-form" onSubmit={submit}>
      <div className="sms-sim-rows">
        <div className="sms-sim-row">
          <input name="recipient" type="text" placeholder="Recipient phone number" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
        </div>
        <div className="sms-sim-row">
          <input name="message" type="text" placeholder="Alert message" value={message} onChange={(e) => setMessage(e.target.value)} required />
        </div>
      </div>
      <div className="sms-sim-actions">
        <button className="primary-button" type="submit" disabled={status === "sending" || !recipient || !message}><Send size={13} /> {status === "sending" ? "Sending…" : "Simulate SMS alert"}</button>
        <span className={`sms-sim-status ${status}`}>{status === "success" ? <><CheckCircle2 size={13} /> {lastResult}</> : status === "error" ? <><AlertTriangle size={13} /> {lastResult}</> : "Simulation writes an audit entry."}</span>
      </div>
    </form>
  );
}
