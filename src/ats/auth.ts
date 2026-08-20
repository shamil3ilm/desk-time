// ATS login + JWT cache in D1.tokens.
// The ATS returns the JWT in a Set-Cookie header (not the response body — verified experimentally
// against api.hr.zilmoney.com). We scan headers for a JWT-shaped string and cache it per user.

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const REFRESH_SKEW_SEC = 300; // refresh if within 5 min of expiry

interface CachedToken {
  token: string;
  expires_at: number; // unix sec — matches D1 column name
}

function findJwtInHeaders(res: Response): string | null {
  for (const header of ["authorization", "set-cookie"] as const) {
    const v = res.headers.get(header);
    if (v) {
      const m = JWT_RE.exec(v);
      if (m) return m[0];
    }
  }
  return null;
}

function findJwtInBody(data: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (typeof data === "string") {
    return JWT_RE.test(data) && data.split(".").length === 3 ? data : null;
  }
  if (data && typeof data === "object") {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const found = findJwtInBody(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function decodeExp(jwt: string): number {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const payload = JSON.parse(atob(b64 + "=".repeat((4 - b64.length % 4) % 4)));
  if (typeof payload.exp !== "number") throw new Error("JWT missing exp");
  return payload.exp;
}

export interface LoginResult {
  token: string;
  expiresAt: number;
  staffId: number | null;
}

// Perform ATS login and return the JWT + expiry. Does NOT cache — caller decides.
export async function atsLogin(baseUrl: string, email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ATS login failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => ({}));
  const token = findJwtInBody(data) ?? findJwtInHeaders(res);
  if (!token) throw new Error("ATS login response contained no JWT");
  const expiresAt = decodeExp(token);
  const staffId = extractStaffId(token);
  return { token, expiresAt, staffId };
}

function extractStaffId(jwt: string): number | null {
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - b64.length % 4) % 4)));
    return typeof payload.staff_id === "number" ? payload.staff_id : null;
  } catch {
    return null;
  }
}

export async function getCachedToken(db: D1Database, userId: number): Promise<CachedToken | null> {
  const row = await db.prepare(
    `SELECT token, expires_at FROM tokens WHERE user_id = ?1 LIMIT 1`,
  ).bind(userId).first<CachedToken>();
  if (!row) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (row.expires_at - nowSec <= REFRESH_SKEW_SEC) return null;
  return row;
}

export async function saveCachedToken(db: D1Database, userId: number, token: string, expiresAt: number): Promise<void> {
  await db.prepare(
    `INSERT INTO tokens (user_id, token, expires_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at`,
  ).bind(userId, token, expiresAt).run();
}

export async function invalidateCachedToken(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`DELETE FROM tokens WHERE user_id = ?1`).bind(userId).run();
}
