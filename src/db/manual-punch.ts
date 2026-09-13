// Manual sessions use deterministic negative IDs = -((YYYYMMDD * 100) + slot), slot in [1..99].
// Positive IDs come from the ATS. Composite PK (user_id, id) keeps them isolated per user.

export async function nextManualSlot(db: D1Database, userId: number, workDate: string): Promise<number> {
  const [y, m, d] = workDate.split("-").map(Number);
  const base = (y * 10000 + m * 100 + d) * 100; // e.g. 2026081400
  const minAllowed = -(base + 99);
  const maxAllowed = -(base + 1);
  const row = await db.prepare(
    `SELECT MIN(id) AS minId FROM sessions WHERE user_id = ?1 AND id BETWEEN ?2 AND ?3`,
  ).bind(userId, minAllowed, maxAllowed).first<{ minId: number | null }>();
  if (!row || row.minId === null) return 1;
  return (-row.minId) - base + 1;
}

export async function insertManualSession(
  db: D1Database,
  userId: number,
  slot: number,
  workDate: string,
  punchIn: string,
  punchOut: string | null,
  durationMinutes: number | null,
): Promise<number> {
  const [y, m, d] = workDate.split("-").map(Number);
  const id = -((y * 10000 + m * 100 + d) * 100 + slot);
  await db.prepare(
    `INSERT INTO sessions (id, user_id, punch_in, punch_out, duration_minutes, work_date, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
     ON CONFLICT(user_id, id) DO UPDATE SET
       punch_in         = excluded.punch_in,
       punch_out        = excluded.punch_out,
       duration_minutes = excluded.duration_minutes,
       work_date        = excluded.work_date,
       updated_at       = datetime('now')`,
  ).bind(id, userId, punchIn, punchOut, durationMinutes, workDate).run();
  return id;
}

// Close (or re-order) an existing session in place — used when the user adds
// a missed punch that pairs with an already-open session on the same day.
// Any (userId, id) tuple, whether from ATS (positive id) or manual (negative id).
export async function updateSessionTimes(
  db: D1Database,
  userId: number,
  id: number,
  punchIn: string,
  punchOut: string | null,
  durationMinutes: number | null,
): Promise<void> {
  await db.prepare(
    `UPDATE sessions
        SET punch_in = ?3, punch_out = ?4, duration_minutes = ?5, updated_at = datetime('now')
      WHERE user_id = ?1 AND id = ?2`,
  ).bind(userId, id, punchIn, punchOut, durationMinutes).run();
}

// Delete a session by (userId, id). Both positive (ATS) and negative (manual)
// ids are allowed — ATS deletions will silently return on the next poll if
// the source still has that punch, which is the desired behaviour (a delete
// should not un-do a real punch).
export async function deleteSession(db: D1Database, userId: number, id: number): Promise<boolean> {
  const res = await db.prepare(
    `DELETE FROM sessions WHERE user_id = ?1 AND id = ?2`,
  ).bind(userId, id).run();
  return (res.meta?.changes ?? 0) > 0;
}

// Toggle the sessions.excluded flag. Returns the new value, or null if the
// row was not found. The flag survives ATS re-sync because upsertSessions
// doesn't touch this column in its ON CONFLICT clause.
export async function toggleSessionExcluded(
  db: D1Database,
  userId: number,
  id: number,
): Promise<{ excluded: 0 | 1 } | null> {
  const cur = await db.prepare(
    `SELECT excluded FROM sessions WHERE user_id = ?1 AND id = ?2`,
  ).bind(userId, id).first<{ excluded: number | null }>();
  if (!cur) return null;
  const next: 0 | 1 = cur.excluded ? 0 : 1;
  await db.prepare(
    `UPDATE sessions SET excluded = ?3, updated_at = datetime('now') WHERE user_id = ?1 AND id = ?2`,
  ).bind(userId, id, next).run();
  return { excluded: next };
}
