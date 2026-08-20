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
