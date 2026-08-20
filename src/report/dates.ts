// Date/time helpers. Ported from shamil3ilm/time/src/dates.ts.
// Workers-adjusted: TZ offset is a parameter (no dotenv), so every helper is pure.
// Callers typically resolve `offsetMin` once per request from env.APP_TZ_OFFSET.

export function parseOffset(offset: string): number {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!m) throw new Error(`Invalid TZ offset: ${offset}`);
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

export function todayISO(offsetMin: number): string {
  const localMs = Date.now() + offsetMin * 60_000;
  const d = new Date(localMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function startOfWeekISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow; // Monday start
  return addDaysISO(iso, diff);
}

export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6);
}

export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function fmtHM(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
}

export function fmtClock(iso: string): string {
  return iso.slice(11, 16);
}

export function liveRunningMinutes(punchInIso: string | null | undefined): number {
  if (!punchInIso) return 0;
  return Math.max(0, Math.round((Date.now() - Date.parse(punchInIso)) / 60_000));
}

export function fmtClockLocalFromEpoch(epochMs: number, offsetMin: number): string {
  const t = new Date(epochMs + offsetMin * 60_000);
  const hh = t.getUTCHours().toString().padStart(2, "0");
  const mm = t.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// D1 datetime('now') returns UTC as "YYYY-MM-DD HH:MM:SS" (no zone marker).
// Convert to configured TZ for display: "YYYY-MM-DD HH:MM".
export function fmtUtcAsLocal(sqliteUtc: string, offsetMin: number): string {
  const iso = sqliteUtc.replace(" ", "T") + "Z";
  const utcMs = Date.parse(iso);
  if (Number.isNaN(utcMs)) return sqliteUtc;
  return fmtDateInTz(new Date(utcMs), offsetMin);
}

export function fmtDateInTz(date: Date, offsetMin: number): string {
  const t = new Date(date.getTime() + offsetMin * 60_000);
  const y = t.getUTCFullYear();
  const mo = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${hh}:${mm}`;
}

export function dayOfWeekLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
}

export function isSunday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function sundaysInMonth(yyyyMm: string): number {
  const [y, m] = yyyyMm.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) count++;
  }
  return count;
}

// (days in month) − (sundays) − (casual leave allowance)
export function workingDaysInMonth(yyyyMm: string, casualLeaves: number): number {
  const [y, m] = yyyyMm.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(0, daysInMonth - sundaysInMonth(yyyyMm) - casualLeaves);
}

// Count non-Sunday days between two ISO dates (inclusive).
export function workingDaysBetween(from: string, to: string): number {
  if (from > to) return 0;
  let count = 0;
  let d = from;
  while (d <= to) {
    if (!isSunday(d)) count++;
    d = addDaysISO(d, 1);
  }
  return count;
}
