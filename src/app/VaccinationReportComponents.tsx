import type { ReportData, ReportId } from "./workspace-types";

export function ReportSectionView({ report }: { report: ReportData }) {
  return (
    <section className="report-section">
      <div className="report-section-heading">
        <h3>{report.title}</h3>
        <p>{report.description}</p>
      </div>
      <div className="report-grid">
        {report.metrics.map((metric) => (
          <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>
        ))}
      </div>
      {report.tables.map((table, tableIndex) => (
        <div className="report-table-block" key={`${report.id}-${table.title}`}>
          <h4>{table.title}</h4>
          <div className="table-wrap module-table report-data-table">
            <table>
              <thead><tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${report.id}-${tableIndex}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.rows.length === 0 && <div className="empty-state">{table.emptyMessage}</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ReportExportMenu({
  reports,
  selectedReportIds,
  onSelectedReportIdsChange,
  rangeInvalid,
  onPrint,
}: {
  reports: ReportData[];
  selectedReportIds: ReportId[];
  onSelectedReportIdsChange: (reportIds: ReportId[]) => void;
  rangeInvalid: boolean;
  onPrint: () => void;
}) {
  const selectedReports = reports.filter((report) => selectedReportIds.includes(report.id));
  const exportDisabled = selectedReports.length === 0 || (rangeInvalid && selectedReportIds.includes("vaccinations"));

  function exportReport(format: string) {
    if (!format || exportDisabled) return;
    if (format === "pdf") {
      onPrint();
      return;
    }
    if (format !== "word" && format !== "excel") return;

    const escapeHtml = (valueToEscape: string | number) => String(valueToEscape)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const reportHtml = selectedReports.map((report) => {
      const metrics = report.metrics.map((metric) => `<tr><th>${escapeHtml(metric.label)}</th><td>${escapeHtml(metric.value)}</td></tr>`).join("");
      const tables = report.tables.map((table) => {
        const headers = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
        const rows = table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
        const emptyRow = `<tr><td colspan="${table.headers.length}">${escapeHtml(table.emptyMessage)}</td></tr>`;
        return `<h3>${escapeHtml(table.title)}</h3><table><thead><tr>${headers}</tr></thead><tbody>${rows || emptyRow}</tbody></table>`;
      }).join("");
      return `<section><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p><table><tbody>${metrics}</tbody></table>${tables}</section>`;
    }).join("<hr>");
    const title = selectedReports.length === 1 ? selectedReports[0].title : "Selected VacciTrack reports";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#20352b}h1{font-size:24px}h2{font-size:20px;margin-top:28px}h3{font-size:16px;margin-top:20px}p{color:#53685d}table{border-collapse:collapse;width:100%;margin:12px 0 18px}th,td{border:1px solid #cbd8cf;padding:7px;text-align:left}th{background:#edf4ee}section{page-break-inside:avoid}</style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleDateString())}</p>${reportHtml}</body></html>`;
    const isWord = format === "word";
    const blob = new Blob(["\ufeff", html], { type: isWord ? "application/msword;charset=utf-8" : "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vaccitrack-${selectedReports.map((report) => report.id).join("-")}.${isWord ? "doc" : "xls"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report-export-controls no-print">
      <details className="report-export-picker">
        <summary>Reports to export ({selectedReports.length})</summary>
        <div className="report-export-options">
          <label>
            <input
              type="checkbox"
              checked={selectedReports.length === reports.length}
              onChange={(event) => onSelectedReportIdsChange(event.target.checked ? reports.map((report) => report.id) : [])}
            />
            All reports
          </label>
          {reports.map((report) => (
            <label key={report.id}>
              <input
                type="checkbox"
                checked={selectedReportIds.includes(report.id)}
                onChange={(event) => onSelectedReportIdsChange(
                  event.target.checked
                    ? [...selectedReportIds, report.id]
                    : selectedReportIds.filter((reportId) => reportId !== report.id),
                )}
              />
              {report.title}
            </label>
          ))}
        </div>
      </details>
      <select
        className="secondary-button report-export-select"
        aria-label="Export selected reports as"
        defaultValue=""
        disabled={exportDisabled}
        onChange={(event) => {
          exportReport(event.target.value);
          event.target.value = "";
        }}
      >
        <option value="" disabled>Export as</option>
        <option value="pdf">PDF</option>
        <option value="word">Word (.doc)</option>
        <option value="excel">Excel (.xls)</option>
      </select>
    </div>
  );
}

