// Per-day 'partial' vs 'half' classification for short-worked days.
// Stored as an extra column on daily_meta.
//
// - getDayType     : one lookup
// - listDayTypesIn : range lookup, returned as Map keyed by work_date
// - setDayType     : upsert; passing null clears the classification (reverts to auto)

export type DayType = "partial" | "half";

export async function getDayType(
  db: D1Database,
  userId: number,
  workDate: string,
): Promise<DayType | null> {
  const row = await db.prepare(
    `SELECT day_type FROM daily_meta WHERE user_id = ?1 AND work_date = ?2`,
  ).bind(userId, workDate).first<{ day_type: string | null }>();
  const t = row?.day_type ?? null;
  return t === "partial" || t === "half" ? t : null;
}

export async function listDayTypesInRange(
  db: D1Database,
  userId: number,
  from: string,
  to: string,
): Promise<Map<string, DayType>> {
  const res = await db.prepare(
    `SELECT work_date, day_type FROM daily_meta
       WHERE user_id = ?1 AND work_date >= ?2 AND work_date <= ?3 AND day_type IS NOT NULL`,
  ).bind(userId, from, to).all<{ work_date: string; day_type: string }>();
  const map = new Map<string, DayType>();
  for (const r of res.results ?? []) {
    if (r.day_type === "partial" || r.day_type === "half") map.set(r.work_date, r.day_type);
  }
  return map;
}

export async function setDayType(
  db: D1Database,
  userId: number,
  workDate: string,
  type: DayType | null,
  defaultTargetMinutes: number,
): Promise<void> {
  // daily_meta.target_minutes is NOT NULL — on first insert for a date we must
  // supply the default target. Subsequent updates leave target_minutes alone.
  await db.prepare(
    `INSERT INTO daily_meta (user_id, work_date, target_minutes, day_type, updated_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))
     ON CONFLICT(user_id, work_date) DO UPDATE SET
       day_type   = excluded.day_type,
       updated_at = datetime('now')`,
  ).bind(userId, workDate, defaultTargetMinutes, type).run();
}
