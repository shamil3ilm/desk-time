import type { UserRow } from "./types.js";

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, hr_password_encrypted, staff_id, telegram_chat_id, active, created_at, last_login_at
       FROM users WHERE email = ?1 LIMIT 1`,
  ).bind(email).first<UserRow>();
  return row ?? null;
}

export async function findUserById(db: D1Database, id: number): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, hr_password_encrypted, staff_id, telegram_chat_id, active, created_at, last_login_at
       FROM users WHERE id = ?1 LIMIT 1`,
  ).bind(id).first<UserRow>();
  return row ?? null;
}

export async function createUser(
  db: D1Database,
  email: string,
  hrPasswordEncrypted: Uint8Array,
  staffId: number | null,
): Promise<number> {
  const res = await db.prepare(
    `INSERT INTO users (email, hr_password_encrypted, staff_id) VALUES (?1, ?2, ?3)`,
  ).bind(email, hrPasswordEncrypted, staffId).run();
  const id = res.meta.last_row_id;
  if (typeof id !== "number") throw new Error("createUser: no last_row_id returned");
  return id;
}

export async function updateUserPassword(
  db: D1Database,
  userId: number,
  hrPasswordEncrypted: Uint8Array,
): Promise<void> {
  await db.prepare(
    `UPDATE users SET hr_password_encrypted = ?2, active = 1 WHERE id = ?1`,
  ).bind(userId, hrPasswordEncrypted).run();
}

export async function markUserLoggedIn(db: D1Database, userId: number): Promise<void> {
  await db.prepare(
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?1`,
  ).bind(userId).run();
}

export async function listActiveUserIds(db: D1Database): Promise<number[]> {
  const res = await db.prepare(`SELECT id FROM users WHERE active = 1`).all<{ id: number }>();
  return (res.results ?? []).map((r) => r.id);
}
