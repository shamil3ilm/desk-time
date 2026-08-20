import type { LeaveRow } from "./types.js";

export type LeaveType = "casual" | "medical" | "festival" | "planned" | "holiday" | "other";

export async function addLeave(
  db: D1Database,
  userId: number,
  date: string,
  reason: string | null,
  type: LeaveType | null,
): Promise<void> {
  await db.prepare(
    `INSERT INTO leaves (user_id, date, reason, type) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id, date) DO UPDATE SET reason = excluded.reason, type = excluded.type`,
  ).bind(userId, date, reason, type).run();
}

export async function removeLeave(db: D1Database, userId: number, date: string): Promise<boolean> {
  const res = await db.prepare(
    `DELETE FROM leaves WHERE user_id = ?1 AND date = ?2`,
  ).bind(userId, date).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function listLeaves(db: D1Database, userId: number, from?: string, to?: string): Promise<LeaveRow[]> {
  if (from && to) {
    const res = await db.prepare(
      `SELECT user_id, date, reason, type, added_at
         FROM leaves WHERE user_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY date`,
    ).bind(userId, from, to).all<LeaveRow>();
    return res.results ?? [];
  }
  const res = await db.prepare(
    `SELECT user_id, date, reason, type, added_at
       FROM leaves WHERE user_id = ?1 ORDER BY date`,
  ).bind(userId).all<LeaveRow>();
  return res.results ?? [];
}

export async function isLeave(db: D1Database, userId: number, date: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS x FROM leaves WHERE user_id = ?1 AND date = ?2 LIMIT 1`,
  ).bind(userId, date).first<{ x: number }>();
  return row !== null;
}
