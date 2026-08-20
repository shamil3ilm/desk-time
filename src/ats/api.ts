// Thin fetch wrappers for the ATS. Each takes the token explicitly (no ambient auth cache).
// Ported from shamil3ilm/time/src/api.ts + refactored: no global config, all params explicit.

export interface Session {
  id: number;
  punch_in: string;
  punch_out: string | null;
  duration_minutes: number | null;
}

export interface MyTodayResponse {
  status: string;
  current_session: Session | null;
  sessions_today: Session[];
  total_today_minutes: number;
  target_minutes: number;
  break_minutes: number;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  filters: { start_date: string; end_date: string };
}

export interface SyncStatusResponse {
  status: string;
  message?: string;
}

// 401 sentinel — caller re-authenticates and retries.
export class UnauthorizedError extends Error {
  constructor(msg = "unauthorized") { super(msg); this.name = "UnauthorizedError"; }
}

async function call<T>(baseUrl: string, token: string, pathAndQuery: string, method: "GET" | "POST"): Promise<T> {
  const res = await fetch(`${baseUrl}${pathAndQuery}`, {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${method} ${pathAndQuery} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function fetchMyToday(baseUrl: string, token: string): Promise<MyTodayResponse> {
  return call<MyTodayResponse>(baseUrl, token, "/api/attendance/my-today", "GET");
}

export function triggerSync(baseUrl: string, token: string, startDate: string, endDate: string): Promise<SyncResponse> {
  const q = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
  return call<SyncResponse>(baseUrl, token, `/api/attendance/my-sync?${q}`, "POST");
}

export function fetchSyncStatus(baseUrl: string, token: string, date: string): Promise<SyncStatusResponse> {
  return call<SyncStatusResponse>(baseUrl, token, `/api/attendance/my-sync-status?date=${date}`, "GET");
}

// Poll /my-sync-status until idle or timeout. Returns actual wait time in ms.
export async function waitForSyncIdle(
  baseUrl: string,
  token: string,
  date: string,
  opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<number> {
  const interval = opts.pollIntervalMs ?? 500;
  const timeout = opts.timeoutMs ?? 8000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const s = await fetchSyncStatus(baseUrl, token, date);
      if (/idle/i.test(s.status)) return Date.now() - start;
    } catch { /* transient — retry */ }
    await new Promise((r) => setTimeout(r, interval));
  }
  return Date.now() - start;
}
