// Browser session cookies (opaque tokens stored in D1).
// The cookie value is the row id (random 32-byte hex); expiry enforced server-side.

import type { AppSessionRow } from "./types.js";

const SESSION_TTL_DAYS = 30;

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAppSession(db: D1Database, userId: number): Promise<{ id: string; expiresAt: number }> {
  const id = randomHex(32);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 86400;
  await db.prepare(
    `INSERT INTO app_sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)`,
  ).bind(id, userId, expiresAt).run();
  return { id, expiresAt };
}

export async function findAppSession(db: D1Database, id: string): Promise<AppSessionRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, expires_at, created_at FROM app_sessions WHERE id = ?1 LIMIT 1`,
  ).bind(id).first<AppSessionRow>();
  if (!row) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (row.expires_at < nowSec) {
    // expired — clean up lazily
    await deleteAppSession(db, id);
    return null;
  }
  return row;
}

export async function deleteAppSession(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM app_sessions WHERE id = ?1`).bind(id).run();
}

export async function pruneExpiredAppSessions(db: D1Database): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await db.prepare(`DELETE FROM app_sessions WHERE expires_at < ?1`).bind(nowSec).run();
}
