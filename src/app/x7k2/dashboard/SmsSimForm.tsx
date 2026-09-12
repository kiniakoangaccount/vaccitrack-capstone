"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle } from "lucide-react";

interface SmsSimFormProps {
  onSimulated?: () => void;
}

export function SmsSimForm({ onSimulated }: SmsSimFormProps = {}) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [checkAnnotations, setCheckAnnotations] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipient || !message) return;
    setStatus("sending");
    const params = new URLSearchParams();
    params.set("recipient", recipient);
    params.set("message", message);
    params.set("checkAnnotations", checkAnnotations ? "on" : "off");
    try {
      const res = await fetch("/x7k2/dashboard?tab=overview", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (res.ok) {
        setStatus("success");
        setLastResult("SMS simulation recorded in the audit log.");
        setRecipient("");
        setMessage("");
        setCheckAnnotations(false);
        onSimulated?.();
      } else {
        setStatus("error");
        setLastResult("Unable to record the simulation. Try again.");
      }
    } catch {
      setStatus("error");
      setLastResult("Network error while recording the simulation.");
    }
    setTimeout(() => setStatus("idle"), 3500);
  };

  return (
    <form className="sms-sim-form" onSubmit={submit}>
      <div className="sms-sim-rows">
        <div className="sms-sim-row">
          <input name="recipient" type="text" placeholder="Recipient phone number" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
          <label className="sms-sim-row-label"><input name="checkAnnotations" type="checkbox" checked={checkAnnotations} onChange={(e) => setCheckAnnotations(e.target.checked)} /> Include animal notes</label>
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
