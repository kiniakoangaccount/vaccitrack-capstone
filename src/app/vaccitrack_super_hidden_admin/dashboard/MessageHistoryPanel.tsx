"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, MessageSquare, RefreshCw } from "lucide-react";
import { fetchSentMessagePage, type SentMessageRow } from "../../message-history-actions";
import SkeletonBlock from "../../Skeleton";

const PAGE_SIZE = 20;

function messageStatusClass(status: SentMessageRow["status"]): string {
  if (status === "sent") return "admin-badge admin-badge-green";
  if (status === "failed") return "admin-badge admin-badge-red";
  return "admin-badge admin-badge-amber";
}

function messageStatusLabel(status: SentMessageRow["status"]): string {
  if (status === "sent") return "Accepted";
  if (status === "failed") return "Failed";
  return "Sending";
}

function MessageHistorySkeleton() {
  return (
    <div className="admin-table-wrap message-history-skeleton" role="status" aria-label="Loading message history">
      <table className="admin-table message-history-table" aria-hidden="true">
        <thead>
          <tr>
            <th>Time</th>
            <th>Channel</th>
            <th>Type</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Sent by</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, index) => (
            <tr key={index}>
              <td><SkeletonBlock className="message-skeleton-time" /></td>
              <td><SkeletonBlock className="message-skeleton-channel" /></td>
              <td><SkeletonBlock className="message-skeleton-type" /></td>
              <td>
                <SkeletonBlock className="message-skeleton-recipient" />
                <SkeletonBlock className="message-skeleton-address" />
              </td>
              <td><SkeletonBlock className="message-skeleton-status" /></td>
              <td><SkeletonBlock className="message-skeleton-sender" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MessageHistoryPanel() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SentMessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchSentMessagePage(page);
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(result.error ?? null);
      } catch {
        if (cancelled) return;
        setError("Could not load sent-message history. Check your connection and retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="admin-panel message-history-panel">
      <div className="admin-panel-head">
        <div>
          <h3>Message delivery history</h3>
          <p>Custom sends and test messages. Provider acceptance is recorded, but message text is not stored.</p>
        </div>
        <button
          className="admin-btn-secondary"
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <MessageHistorySkeleton />
      ) : error ? (
        <div className="admin-not-configured" role="alert">
          <AlertTriangle size={22} />
          <strong>Message history could not be loaded</strong>
          <p>{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="admin-empty-state">
          <MessageSquare size={24} />
          <strong>No sent messages yet</strong>
          <p>Custom sends and test messages will appear here.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table message-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Channel</th>
                  <th>Type</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Sent by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="admin-nowrap">{new Date(row.sent_at ?? row.created_at).toLocaleString("en-PH", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</td>
                    <td>
                      <span className="message-history-channel">
                        <MessageSquare size={14} />
                        SMS
                      </span>
                    </td>
                    <td>{row.message_type === "test" ? "Test" : "Custom"}</td>
                    <td className="message-history-recipient">
                      {row.recipient_name && <strong>{row.recipient_name}</strong>}
                      <span>{row.recipient_address}</span>
                    </td>
                    <td><span className={messageStatusClass(row.status)}>{messageStatusLabel(row.status)}</span></td>
                    <td>{row.sent_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-page-bar">
            <div className="admin-page-info">
              <p className="muted">{total} record{total === 1 ? "" : "s"} total</p>
              <p className="muted">Showing {start}-{end}</p>
            </div>
            <div className="admin-page-controls">
              <button
                className="admin-btn-secondary"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="admin-page-number">Page {page}</span>
              <button
                className="admin-btn-secondary"
                type="button"
                disabled={page * PAGE_SIZE >= total || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
