// Parse/write session cookies. Session cookies are opaque IDs (see db/app-sessions.ts),
// so no HMAC needed — the ID is unguessable and validated against the DB row.

const COOKIE_NAME = "dt_session";

export function readSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export function makeSessionSetCookie(sessionId: string, expiresAtEpochSec: number): string {
  const expires = new Date(expiresAtEpochSec * 1000).toUTCString();
  return `${COOKIE_NAME}=${sessionId}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`;
}

export function makeSessionClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
