// `new Date().toISOString().slice(0, 10)` gives *UTC* today, not the
// browser's local calendar day. In the Philippines (UTC+8) those two dates
// disagree for roughly the first 8 hours of every local day — e.g. at 3am
// PHT, UTC is still on yesterday's date — which can make a `max={today}`
// date input reject the user's actual, real "today". This reads the date
// from the browser's local clock instead.
export function todayLocalIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addMonthsToDateIso(dateIso: string, months: number): string {
  const [year, month, day] = dateIso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day || !Number.isFinite(months)) return dateIso;
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = targetMonth.getUTCFullYear();
  const targetMonthIndex = targetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

// Server-side equivalent: Vercel functions run in UTC regardless of where
// the request came from, so "today" there has to be pinned explicitly to
// the barangay's own timezone rather than the server's.
export function getManilaDateIso(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}
