import type { SessionRow, PollLogRow } from "./types.js";
import type { Session, MyTodayResponse } from "../ats/api.js";

function workDateFromPunchIn(punchIn: string): string {
  return punchIn.slice(0, 10);
}

export async function upsertSessions(db: D1Database, userId: number, sessions: Session[]): Promise<number> {
  if (sessions.length === 0) return 0;
  const stmts = sessions.map((s) =>
    db.prepare(
      `INSERT INTO sessions (id, user_id, punch_in, punch_out, duration_minutes, work_date, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT(user_id, id) DO UPDATE SET
         punch_in         = excluded.punch_in,
         punch_out        = excluded.punch_out,
         duration_minutes = excluded.duration_minutes,
         work_date        = excluded.work_date,
         updated_at       = datetime('now')`,
    ).bind(s.id, userId, s.punch_in, s.punch_out, s.duration_minutes, workDateFromPunchIn(s.punch_in)),
  );
  await db.batch(stmts);
  return sessions.length;
}

export async function upsertDailyMeta(
  db: D1Database,
  userId: number,
  workDate: string,
  targetMinutes: number,
  breakMinutes: number,
): Promise<void> {
  await db.prepare(
    `INSERT INTO daily_meta (user_id, work_date, target_minutes, break_minutes, updated_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))
     ON CONFLICT(user_id, work_date) DO UPDATE SET
       target_minutes = excluded.target_minutes,
       break_minutes  = excluded.break_minutes,
       updated_at     = datetime('now')`,
  ).bind(userId, workDate, targetMinutes, breakMinutes).run();
}

export async function persistToday(db: D1Database, userId: number, payload: MyTodayResponse, workDate: string): Promise<number> {
  const count = await upsertSessions(db, userId, payload.sessions_today);
  await upsertDailyMeta(db, userId, workDate, payload.target_minutes, payload.break_minutes);
  return count;
}

export async function recordPoll(
  db: D1Database,
  userId: number,
  status: "ok" | "error",
  sessions: number | null,
  error: string | null,
  synced: boolean,
): Promise<void> {
  await db.prepare(
    `INSERT INTO poll_log (user_id, status, sessions, error, synced) VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(userId, status, sessions, error, synced ? 1 : 0).run();
}

export async function getLastPoll(db: D1Database, userId: number): Promise<PollLogRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, ran_at, status, sessions, error, synced
       FROM poll_log WHERE user_id = ?1 ORDER BY id DESC LIMIT 1`,
  ).bind(userId).first<PollLogRow>();
  return row ?? null;
}

export async function getLastSync(db: D1Database, userId: number): Promise<PollLogRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, ran_at, status, sessions, error, synced
       FROM poll_log WHERE user_id = ?1 AND synced = 1 ORDER BY id DESC LIMIT 1`,
  ).bind(userId).first<PollLogRow>();
  return row ?? null;
}

export async function getOpenSessionOnDate(db: D1Database, userId: number, workDate: string): Promise<SessionRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, punch_in, punch_out, duration_minutes, work_date, updated_at
       FROM sessions
       WHERE user_id = ?1 AND work_date = ?2 AND punch_out IS NULL
       ORDER BY punch_in DESC LIMIT 1`,
  ).bind(userId, workDate).first<SessionRow>();
  return row ?? null;
}

export async function getSessionsBetween(
  db: D1Database,
  userId: number,
  from: string,
  to: string,
): Promise<SessionRow[]> {
  const res = await db.prepare(
    `SELECT id, user_id, punch_in, punch_out, duration_minutes, work_date, updated_at
       FROM sessions
       WHERE user_id = ?1 AND work_date >= ?2 AND work_date <= ?3
       ORDER BY punch_in ASC`,
  ).bind(userId, from, to).all<SessionRow>();
  return res.results ?? [];
}

export async function getEarliestWorkDate(db: D1Database, userId: number): Promise<string | null> {
  const row = await db.prepare(
    `SELECT MIN(work_date) AS d FROM sessions WHERE user_id = ?1`,
  ).bind(userId).first<{ d: string | null }>();
  return row?.d ?? null;
}
