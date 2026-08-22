// Per-user poll orchestrator. Called from:
//   - /api/sync route (user-triggered)
//   - scheduled() cron handler (fan-out per active user via ctx.waitUntil)

import type { AppConfig } from "../config.js";
import { atsLogin, getCachedToken, saveCachedToken, invalidateCachedToken } from "./auth.js";
import { fetchMyToday, triggerSync, UnauthorizedError, type MyTodayResponse } from "./api.js";
import { findUserById } from "../db/users.js";
import { persistToday, recordPoll, getLastSync } from "../db/sessions.js";
import { decryptToString } from "../crypto/encrypt.js";
import { todayISO, liveRunningMinutes } from "../report/dates.js";

const MIN_SYNC_GAP_MS = 45 * 60_000; // 45 min between /my-sync per user, unless forceSync

export interface PollOptions {
  syncFirst?: boolean;
  skipIfIdle?: boolean;
  forceSync?: boolean;
}

export interface PollResult {
  ok: boolean;
  message: string;
  sessions?: number;
  workedMinutes?: number;
  runningMinutes?: number;
  status?: string;
  synced: boolean;
  skipped?: string;
}

async function getFreshToken(db: D1Database, config: AppConfig, userId: number): Promise<string> {
  const cached = await getCachedToken(db, userId);
  if (cached) return cached.token;
  const user = await findUserById(db, userId);
  if (!user) throw new Error(`user ${userId} not found`);
  const password = await decryptToString(user.hr_password_encrypted, config.masterKey);
  const login = await atsLogin(config.atsBaseUrl, user.email, password);
  await saveCachedToken(db, userId, login.token, login.expiresAt);
  return login.token;
}

function minutesSinceLastSync(row: { ran_at: string } | null): number | null {
  if (!row) return null;
  const t = Date.parse(row.ran_at.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 60_000;
}

// After POST /my-sync, the ATS runs the pull for a few seconds before /my-today reflects
// the fresh state. On the local tool we polled /my-sync-status to time this precisely;
// on Cloudflare Workers, doing that eats ~16 subrequests against the free-tier 50-per-invocation
// limit and starves the rest of the poll. A blind 3s sleep is enough for the ATS in practice
// and costs zero subrequests.
const SYNC_SETTLE_MS = 3000;

export async function runPoll(
  db: D1Database,
  config: AppConfig,
  userId: number,
  options: PollOptions = {},
): Promise<PollResult> {
  let syncFirst = options.syncFirst ?? true;
  const skipIfIdle = options.skipIfIdle ?? false;
  const forceSync = options.forceSync ?? false;
  const date = todayISO(config.tzOffsetMin);

  // Skip API entirely if the DB has no open session for today. Alerts-only path.
  if (skipIfIdle && !syncFirst) {
    const { getOpenSessionOnDate } = await import("../db/sessions.js");
    const open = await getOpenSessionOnDate(db, userId, date);
    if (!open) return { ok: true, message: "skipped — no open session", synced: false, skipped: "no open session" };
  }

  // Downgrade sync to fetch-only if a recent sync just happened.
  if (syncFirst && !forceSync) {
    const gap = minutesSinceLastSync(await getLastSync(db, userId));
    if (gap !== null && gap * 60_000 < MIN_SYNC_GAP_MS) {
      syncFirst = false;
    }
  }

  try {
    // Auth once per poll — every ATS call reuses this token, refreshed only on 401.
    // This cuts D1 reads from 3× (one per withRetryOn401 call) to 1×.
    let token = await getFreshToken(db, config, userId);
    const call = async <T>(fn: (t: string) => Promise<T>): Promise<T> => {
      try { return await fn(token); }
      catch (err) {
        if (err instanceof UnauthorizedError) {
          await invalidateCachedToken(db, userId);
          token = await getFreshToken(db, config, userId);
          return fn(token);
        }
        throw err;
      }
    };

    if (syncFirst) {
      try {
        await call((t) => triggerSync(config.atsBaseUrl, t, date, date));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // "already in progress" from another concurrent sync — just wait for it too
        if (!/already in progress/i.test(msg)) throw err;
      }
      // Blind wait for the ATS to settle. No status polling — saves ~16 subrequests.
      await new Promise((r) => setTimeout(r, SYNC_SETTLE_MS));
    }

    const today: MyTodayResponse = await call((t) => fetchMyToday(config.atsBaseUrl, t));
    const count = await persistToday(db, userId, today, date);
    await recordPoll(db, userId, "ok", count, null, syncFirst);

    const running = liveRunningMinutes(today.current_session?.punch_in);
    const workedLive = today.total_today_minutes + running;
    return {
      ok: true,
      message: syncFirst ? "sync + fetch complete" : "fetch complete (no sync)",
      sessions: count,
      workedMinutes: workedLive,
      runningMinutes: running,
      status: today.status,
      synced: syncFirst,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordPoll(db, userId, "error", null, msg, syncFirst).catch(() => {});
    return { ok: false, message: msg, synced: syncFirst };
  }
}
