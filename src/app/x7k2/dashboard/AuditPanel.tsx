"use client";

import { useState } from "react";
import { fetchAuditLogPage } from "../audit-actions";
import { ShieldCheck, ChevronLeft, ChevronRight, Filter, ScanLine, Trash2, Pencil, Bell, CheckCircle2, AlertCircle } from "lucide-react";

interface AuditRow {
  id: number;
  user_id: string | null;
  action: string | null;
  table_name: string | null;
  record_id: number | null;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  "INSERT": "Create",
  "UPDATE": "Update",
  "DELETE": "Delete",
  "SMS_SENT": "SMS sent",
  "SMS_ATTEMPT": "SMS attempt",
};

const actionStyles: Record<string, string> = {
  "INSERT": "audit-create",
  "UPDATE": "audit-update",
  "DELETE": "audit-delete",
  "SMS_SENT": "audit-sms",
  "SMS_ATTEMPT": "audit-sms",
};

export default function AuditPanel() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: "", tableName: "", userId: "", startDate: "", endDate: "" });

  const load = async () => {
    setLoading(true);
    const result = await fetchAuditLogPage({ page, limit, ...filters });
    setRows(result.rows);
    setTotal(result.total);
    setLoading(false);
  };

  return null;
}

export function AuditFilters({ filters, onChange }: { filters: { action?: string; tableName?: string; userId?: string; startDate?: string; endDate?: string }; onChange: (next: { action?: string; tableName?: string; userId?: string; startDate?: string; endDate?: string }) => void }) {
  return (
    <div className="admin-filter-bar">
      <div className="admin-filter-group">
        <label>Action filter
          <select value={filters.action ?? ""} onChange={(e) => onChange({ ...filters, action: e.target.value || undefined })}>
            <option value="">All actions</option>
            <option value="INSERT">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="SMS_SENT">SMS sent</option>
            <option value="SMS_ATTEMPT">SMS attempt</option>
          </select>
        </label>
      </div>
      <div className="admin-filter-group">
        <label>Table filter
          <select value={filters.tableName ?? ""} onChange={(e) => onChange({ ...filters, tableName: e.target.value || undefined })}>
            <option value="">All tables</option>
            <option value="users">users</option>
            <option value="profiles">profiles</option>
            <option value="animals">animals</option>
            <option value="puroks">puroks</option>
            <option value="breeds">breeds</option>
            <option value="vaccines">vaccines</option>
            <option value="feedback">feedback</option>
          </select>
        </label>
      </div>
      <div className="admin-filter-group">
        <label>Date from
          <input type="date" value={filters.startDate ?? ""} onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })} />
        </label>
      </div>
      <div className="admin-filter-group">
        <label>Date to
          <input type="date" value={filters.endDate ?? ""} onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })} />
        </label>
      </div>
    </div>
  );
}

export function AuditPageControls({ total, page, limit, onPrev, onNext }: { total: number; page: number; limit: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="admin-page-bar">
      <div className="admin-page-info">
        <p className="muted">{total} record{total !== 1 ? "s" : ""} total</p>
        <p className="muted">Showing {Math.min(limit, total - (page - 1) * limit)} of {total}</p>
      </div>
      <div className="admin-page-controls">
        <button className="admin-btn-secondary" disabled={page <= 1} onClick={onPrev}><ChevronLeft size={14} /> Previous</button>
        <span className="admin-page-number">Page {page}</span>
        <button className="admin-btn-secondary" disabled={page * limit >= total} onClick={onNext}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function AuditEmpty({ message }: { message?: string }) {
  return (
    <div className="admin-empty"><ScanLine size={24} /><span>{message ?? "No audit records match the current filters."}</span></div>
  );
}

export function AuditPanel() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: "", tableName: "", userId: "", startDate: "", endDate: "" });

  const load = async () => {
    setLoading(true);
    const result = await fetchAuditLogPage({ page, limit, ...filters });
    setRows(result.rows);
    setTotal(result.total);
    setLoading(false);
  };

  return (
    <div className="admin-panel audit-panel">
      <div className="admin-panel-head">
        <div>
          <h3>System audit log</h3>
          <p>Every create, update, delete, and SMS action recorded against the database.</p>
        </div>
        <div className="admin-panel-actions">
          <button className="admin-btn-secondary" onClick={() => setFilters({ action: "", tableName: "", userId: "", startDate: "", endDate: "" })}><Filter size={13} /> Clear filters</button>
        </div>
      </div>

      <AuditFilters filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="admin-empty"><div className="admin-spinner" /><span>Loading audit log…</span></div>
      ) : rows.length === 0 ? (
        <AuditEmpty />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Record</th>
                  <th>User</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="audit-time">{new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className={`status ${actionStyles[r.action ?? ""] ?? ""}`}><i />{actionLabels[r.action ?? ""] ?? r.action}</span></td>
                    <td>{r.table_name ?? "—"}</td>
                    <td>{r.record_id ?? "—"}</td>
                    <td>{r.user_id ?? "System"}</td>
                    <td className="audit-notes">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AuditPageControls total={total} page={page} limit={limit} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        </>
      )}
    </div>
  );
}

