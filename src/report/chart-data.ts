// Pure data preparation for the dashboard. All DB access here, no HTML.
// The HTML template consumes the returned `DashboardData` shape.

import type { AppConfig } from "../config.js";
import {
  addDaysISO, dayOfWeekLabel, endOfWeekISO, fmtDateInTz, fmtUtcAsLocal,
  isSunday, liveRunningMinutes, startOfWeekISO, sundaysInMonth,
  todayISO, workingDaysBetween, workingDaysInMonth,
} from "./dates.js";
import { getSessionsBetween, getEarliestWorkDate, getOpenSessionOnDate, getLastPoll, getLastSync } from "../db/sessions.js";
import { listLeaves, isLeave } from "../db/leaves.js";

export interface DayBucket {
  date: string; label: string; hours: number; targetHours: number; isSunday: boolean;
  // true if this is a past weekday with some work but below target (not a leave, not today).
  // Highlighted in the week chart so short days are visible; still counted in daysCompleted.
  isPartial?: boolean;
}
export interface WeekPeriod {
  key: string; label: string; start: string; end: string;
  days: DayBucket[]; total: number; target: number;
}
export interface WeekBucket {
  key: string; label: string; start: string; end: string;
  hours: number; target: number; days: DayBucket[];
}
export interface MonthPeriod {
  key: string; label: string;
  daysInMonth: number; sundays: number; cl: number; workingDays: number; targetHours: number;
  worked: number; balance: number;
  daysCompleted: number; daysElapsed: number; daysBalance: number;
  daysRemainingToTarget: number; workingDaysLeftIncludingToday: number;
  excusedLeaves: number; unexcusedLeaves: number; sundaysWorked: number;
  excusedDates: string[]; unexcusedDates: string[];
  excusedByType: Record<string, string[]>;
  preEmploymentDays: number;
  partialDays: number; partialDates: string[];
  // Hour banking within the month (monthly reset). Positive = surplus, negative = deficit.
  // Formula: total_worked_minutes - (elapsed_workdays - excused_leaves) × dailyTarget
  // Sunday hours count into "worked" with no counterpart in expected (so they add to surplus).
  // Today's hours contribute to worked but not to expected until today itself is elapsed.
  bankedMinutes: number;
  weeks: WeekBucket[];
}
export interface SessionRowLite {
  punch_in: string; punch_out: string | null; duration_minutes: number | null;
}
export interface SessionsIndex {
  available: string[];
  byDate: Record<string, SessionRowLite[]>;
}
export interface DashboardData {
  generatedAt: string;
  today: string;
  todayIsSunday: boolean;
  todayIsLeave: boolean;
  todayNonWorking: boolean;
  todayTargetHours: number;
  closedTodayHours: number;
  totalTodayHours: number;
  todayRemainingMin: number;
  etaEpochMs: number;
  isPunchedIn: boolean;
  openPunchInMs: number | null;
  sessionAlertMin: number;
  sessionMaxMin: number;
  monthDaysCompleted: number;
  monthDaysElapsed: number;
  monthDaysBalance: number;
  weeks: WeekPeriod[];
  months: MonthPeriod[];
  sessions: SessionsIndex;
  lastPoll: { ran_at: string; status: string; synced: boolean } | null;
  lastSync: { ran_at: string; status: string } | null;
  earliestDate: string;
  employmentStart: string;
  userEmail: string;
}

async function bucketDays(
  db: D1Database, userId: number, config: AppConfig,
  from: string, to: string, labelFn: (d: string) => string,
): Promise<DayBucket[]> {
  const sessions = await getSessionsBetween(db, userId, from, to);
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.duration_minutes === null) continue;
    byDay.set(s.work_date, (byDay.get(s.work_date) ?? 0) + s.duration_minutes);
  }
  const out: DayBucket[] = [];
  let d = from;
  while (d <= to) {
    const sun = isSunday(d);
    out.push({
      date: d,
      label: labelFn(d),
      hours: +(((byDay.get(d) ?? 0) / 60).toFixed(2)),
      targetHours: sun ? 0 : +((config.dailyTargetMinutes / 60).toFixed(2)),
      isSunday: sun,
    });
    d = addDaysISO(d, 1);
  }
  return out;
}

function addLiveRunningToBucket(days: DayBucket[], today: string, runningHours: number): void {
  if (runningHours === 0) return;
  const b = days.find((d) => d.date === today);
  if (b) b.hours = +(b.hours + runningHours).toFixed(2);
}

function monthKey(iso: string): string { return iso.slice(0, 7); }
function monthsBetween(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
function addMonthsKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
function firstOfMonth(key: string): string { return `${key}-01`; }
function lastOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1] + " " + y;
}

async function buildWeeks(
  db: D1Database, userId: number, config: AppConfig,
  today: string, runningHours: number, earliestDate: string,
): Promise<WeekPeriod[]> {
  const firstWeekStart = startOfWeekISO(earliestDate);
  const currentWeekStart = startOfWeekISO(today);
  const weeksBack = Math.max(0, Math.round((Date.parse(currentWeekStart) - Date.parse(firstWeekStart)) / (7 * 86_400_000)));
  const weeks: WeekPeriod[] = [];
  for (let i = weeksBack; i >= 0; i--) {
    const anchor = addDaysISO(today, -7 * i);
    const start = startOfWeekISO(anchor);
    const end = endOfWeekISO(anchor);
    const days = await bucketDays(db, userId, config, start, end, (d) => dayOfWeekLabel(d));
    if (today >= start && today <= end) addLiveRunningToBucket(days, today, runningHours);
    const total = +days.reduce((s, d) => s + d.hours, 0).toFixed(2);
    const target = +days.reduce((s, d) => s + d.targetHours, 0).toFixed(2);
    weeks.push({ key: start, label: `${start} → ${end}`, start, end, days, total, target });
  }
  return weeks;
}

async function weeksInMonth(
  db: D1Database, userId: number, config: AppConfig,
  key: string, today: string, runningHours: number,
): Promise<WeekBucket[]> {
  const mStart = firstOfMonth(key);
  const mEnd = lastOfMonth(key);
  const buckets: WeekBucket[] = [];
  let cursor = startOfWeekISO(mStart);
  while (cursor <= mEnd) {
    const wEnd = endOfWeekISO(cursor);
    const clippedStart = cursor < mStart ? mStart : cursor;
    const clippedEnd = wEnd > mEnd ? mEnd : wEnd;
    const days = await bucketDays(db, userId, config, clippedStart, clippedEnd, (d) => dayOfWeekLabel(d) + " " + d.slice(8));
    if (today >= clippedStart && today <= clippedEnd) addLiveRunningToBucket(days, today, runningHours);
    const hours = +days.reduce((s, d) => s + d.hours, 0).toFixed(2);
    const target = +days.reduce((s, d) => s + d.targetHours, 0).toFixed(2);
    const label = `${clippedStart.slice(5)}–${clippedEnd.slice(5)}`;
    buckets.push({ key: cursor, label, start: clippedStart, end: clippedEnd, hours, target, days });
    cursor = addDaysISO(cursor, 7);
  }
  return buckets;
}

async function buildMonths(
  db: D1Database, userId: number, config: AppConfig,
  today: string, runningHours: number, earliestDate: string, employmentStart: string,
): Promise<MonthPeriod[]> {
  const currentKey = monthKey(today);
  const earliestKey = monthKey(earliestDate);
  const monthsBack = Math.max(0, monthsBetween(earliestKey, currentKey));
  const dailyTargetMin = config.dailyTargetMinutes;
  const months: MonthPeriod[] = [];
  for (let i = monthsBack; i >= 0; i--) {
    const key = addMonthsKey(currentKey, -i);
    const [y, m] = key.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const sundays = sundaysInMonth(key);
    const cl = config.monthlyCasualLeaves;
    const workingDays = workingDaysInMonth(key, cl);
    const targetHours = +(workingDays * (dailyTargetMin / 60)).toFixed(2);

    const weeks = await weeksInMonth(db, userId, config, key, today, runningHours);
    const worked = +weeks.reduce((s, w) => s + w.hours, 0).toFixed(2);
    const balance = +(worked - targetHours).toFixed(2);

    const start = firstOfMonth(key);
    const end = lastOfMonth(key);
    const cursorEnd = today < end ? today : end;
    const isCurrent = key === currentKey;
    const yesterday = addDaysISO(today, -1);

    const dayHoursByDate = new Map<string, number>();
    for (const w of weeks) for (const db2 of w.days) dayHoursByDate.set(db2.date, db2.hours);
    const manualLeavesList = await listLeaves(db, userId, start, end);
    const manualLeaves = new Set(manualLeavesList.map((l) => l.date));
    const leaveTypeByDate = new Map(manualLeavesList.map((l) => [l.date, l.type ?? "leave"]));

    const effectiveStart = start < employmentStart ? employmentStart : start;

    let daysCompleted = 0;
    let partialDays = 0;
    let excusedLeaves = 0;
    let unexcusedLeaves = 0;
    let sundaysWorked = 0;
    let preEmploymentDays = 0;
    let totalWorkedMin = 0; // for hours-banking calc
    const partialDates: string[] = [];
    const excusedDates: string[] = [];
    const unexcusedDates: string[] = [];
    let d = start;
    while (d <= cursorEnd) {
      const workedMin = Math.round((dayHoursByDate.get(d) ?? 0) * 60);
      const beforeEmployment = d < employmentStart;
      const isTodayD = d === today;
      if (!beforeEmployment) totalWorkedMin += workedMin; // includes Sundays + today live
      if (beforeEmployment) {
        if (!isSunday(d)) preEmploymentDays++;
      } else if (isSunday(d)) {
        if (workedMin > 0 && !isTodayD) sundaysWorked++;
      } else if (workedMin >= dailyTargetMin) {
        daysCompleted++;
      } else if (!isTodayD) {
        // Past weekday under target.
        // - manual leave → excused (compensates, doesn't count as completed)
        // - some work (partial) → count as completed AND flag for highlighting
        // - zero work, no leave → unexcused miss (misses one day of pace)
        if (manualLeaves.has(d)) {
          excusedLeaves++;
          excusedDates.push(d);
        } else if (workedMin > 0) {
          daysCompleted++;
          partialDays++;
          partialDates.push(d);
        } else {
          unexcusedLeaves++;
          unexcusedDates.push(d);
        }
      }
      d = addDaysISO(d, 1);
    }

    // Flag partial days on the week-level buckets so the chart can render them
    // in a distinct color without recomputing the classification.
    const partialSet = new Set(partialDates);
    for (const w of weeks) for (const db2 of w.days) if (partialSet.has(db2.date)) db2.isPartial = true;

    const daysElapsed = isCurrent
      ? workingDaysBetween(effectiveStart, yesterday < effectiveStart ? effectiveStart : yesterday)
      : Math.max(0, workingDays - preEmploymentDays);

    const daysBalance = (daysCompleted + sundaysWorked) - daysElapsed;
    const daysRemainingToTarget = Math.max(0, workingDays - preEmploymentDays - daysCompleted);
    const workingDaysLeftIncludingToday = isCurrent ? workingDaysBetween(today, end) : 0;

    // Hour banking: what you owe or have banked, monthly reset.
    // Expected = elapsed weekdays minus excused leaves (excused don't require hours).
    // Today itself isn't in expected — it's still in progress, its target isn't due yet.
    // Actual = every minute worked from employment start to today (Sundays count as bonus).
    const expectedMin = Math.max(0, (daysElapsed - excusedLeaves)) * dailyTargetMin;
    const bankedMinutes = totalWorkedMin - expectedMin;

    const excusedByType: Record<string, string[]> = {};
    for (const d2 of excusedDates) {
      const t = leaveTypeByDate.get(d2) ?? "leave";
      (excusedByType[t] ||= []).push(d2);
    }

    months.push({
      key, label: monthLabel(key), daysInMonth, sundays, cl, workingDays, targetHours,
      worked, balance, daysCompleted, daysElapsed, daysBalance,
      daysRemainingToTarget, workingDaysLeftIncludingToday,
      excusedLeaves, unexcusedLeaves, sundaysWorked, excusedDates, unexcusedDates,
      excusedByType, preEmploymentDays,
      partialDays, partialDates,
      bankedMinutes,
      weeks,
    });
  }
  return months;
}

async function buildSessionsIndex(db: D1Database, userId: number, today: string, earliestDate: string): Promise<SessionsIndex> {
  const rows = await getSessionsBetween(db, userId, earliestDate, today);
  const byDate: Record<string, SessionRowLite[]> = {};
  for (const r of rows) {
    (byDate[r.work_date] ||= []).push({
      punch_in: r.punch_in, punch_out: r.punch_out, duration_minutes: r.duration_minutes,
    });
  }
  const available = Object.keys(byDate).sort();
  if (!byDate[today]) available.push(today);
  return { available, byDate };
}

export async function buildDashboardData(
  db: D1Database, config: AppConfig, userId: number, userEmail: string,
  employmentStartOverride?: string,
): Promise<DashboardData> {
  const today = todayISO(config.tzOffsetMin);
  const earliestDate = (await getEarliestWorkDate(db, userId)) ?? today;
  const employmentStart = employmentStartOverride ?? earliestDate;

  const open = await getOpenSessionOnDate(db, userId, today);
  const runningNow = liveRunningMinutes(open?.punch_in);
  const runningHours = +(runningNow / 60).toFixed(2);

  const todaySessions = await getSessionsBetween(db, userId, today, today);
  const closedToday = todaySessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const totalToday = closedToday + runningNow;

  const [nonSundayIsLeave] = await Promise.all([isLeave(db, userId, today)]);
  const nonWorkingDay = isSunday(today) || nonSundayIsLeave;
  const anyWorkToday = totalToday > 0 || !!open;
  const todayTarget = (nonWorkingDay && !anyWorkToday) ? 0 : config.dailyTargetMinutes;
  const todayRemaining = Math.max(0, todayTarget - totalToday);
  const etaEpochMs = open
    ? Date.parse(open.punch_in) + Math.max(0, todayTarget - closedToday) * 60_000
    : Date.now() + todayRemaining * 60_000;

  const [weeks, months, sessionsIndex, lastPollRow, lastSyncRow] = await Promise.all([
    buildWeeks(db, userId, config, today, runningHours, earliestDate),
    buildMonths(db, userId, config, today, runningHours, earliestDate, employmentStart),
    buildSessionsIndex(db, userId, today, earliestDate),
    getLastPoll(db, userId),
    getLastSync(db, userId),
  ]);
  const currentMonth = months[months.length - 1];

  const lastPoll = lastPollRow
    ? { ran_at: fmtUtcAsLocal(lastPollRow.ran_at, config.tzOffsetMin), status: lastPollRow.status, synced: lastPollRow.synced === 1 }
    : null;
  const lastSync = lastSyncRow
    ? { ran_at: fmtUtcAsLocal(lastSyncRow.ran_at, config.tzOffsetMin), status: lastSyncRow.status }
    : null;

  return {
    generatedAt: fmtDateInTz(new Date(), config.tzOffsetMin),
    today,
    todayIsSunday: isSunday(today),
    todayIsLeave: nonSundayIsLeave,
    todayNonWorking: nonWorkingDay,
    todayTargetHours: +(todayTarget / 60).toFixed(2),
    closedTodayHours: +(closedToday / 60).toFixed(2),
    totalTodayHours: +(totalToday / 60).toFixed(2),
    todayRemainingMin: todayRemaining,
    etaEpochMs,
    isPunchedIn: !!open,
    openPunchInMs: open ? Date.parse(open.punch_in) : null,
    sessionAlertMin: config.sessionAlertMinutes,
    sessionMaxMin: config.sessionMaxMinutes,
    monthDaysCompleted: currentMonth.daysCompleted,
    monthDaysElapsed: currentMonth.daysElapsed,
    monthDaysBalance: currentMonth.daysBalance,
    weeks,
    months,
    sessions: sessionsIndex,
    lastPoll,
    lastSync,
    earliestDate,
    employmentStart,
    userEmail,
  };
}
