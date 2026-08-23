// desk-time — shared multi-tenant work-hours tracker on Cloudflare Workers.
// Phase 2 MVP: signup/login/logout, per-user sync, today-only dashboard.
// See docs/DESIGN.md for the full architecture and phase plan.

import { readSessionIdFromRequest } from "./crypto/cookie.js";
import { findAppSession } from "./db/app-sessions.js";
import { findUserById } from "./db/users.js";
import { listActiveUserIds } from "./db/users.js";
import { runPoll } from "./ats/poll.js";
import { getConfig } from "./config.js";
import type { UserRow } from "./db/types.js";
import { signupPage, signupSubmit } from "./routes/signup.js";
import { loginPage, loginSubmit, logoutSubmit } from "./routes/login.js";
import { dashboardPage } from "./routes/dashboard.js";
import { apiSyncSubmit } from "./routes/api-sync.js";
import { apiFetchSubmit } from "./routes/api-fetch.js";
import { apiLeaveAdd, apiLeaveRemove } from "./routes/api-leave.js";
import { apiPunchAdd } from "./routes/api-punch.js";
import { apiDashboardData } from "./routes/api-dashboard.js";
import { internalSync } from "./routes/internal-sync.js";
import { pollQueueConsumer, type PollMessage } from "./queue-consumer.js";
import { redirect } from "./routes/_html.js";

export interface Env {
  DB: D1Database;
  MASTER_KEY?: string;
  SESSION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  INTERNAL_SYNC_SECRET?: string;
  APP_URL?: string;
  // Cron dispatch mode: "self-fetch" (default, no infra needed) or "queue"
  // (requires POLL_QUEUE binding + Cloudflare Queue provisioned).
  POLL_DISPATCH_MODE?: string;
  // Optional Queue producer binding. Populated only when queue mode is enabled
  // and the [[queues.producers]] block is present in wrangler.toml.
  POLL_QUEUE?: Queue<PollMessage>;
  ATS_BASE_URL: string;
  APP_TZ_OFFSET: string;
  DAILY_TARGET_MINUTES: string;
  WORKING_DAYS_PER_WEEK: string;
  MONTHLY_CL_ALLOWANCE: string;
  SESSION_ALERT_MINUTES: string;
  SESSION_MAX_MINUTES: string;
}

// Resolve the logged-in user from the session cookie. Returns null if no valid session.
async function resolveUser(req: Request, env: Env): Promise<UserRow | null> {
  const sid = readSessionIdFromRequest(req);
  if (!sid) return null;
  const session = await findAppSession(env.DB, sid);
  if (!session) return null;
  return findUserById(env.DB, session.user_id);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Shared fan-out — called by scheduled() (Cloudflare cron) and by /internal/trigger-all
// (external cron like GitHub Actions). Same logic either way. Returns dispatched count.
async function fanOutToAllUsers(env: Env, ctx: ExecutionContext, source: string): Promise<{ users: number; mode: string }> {
  const t0 = Date.now();
  const userIds = await listActiveUserIds(env.DB);
  const mode = (env.POLL_DISPATCH_MODE || "self-fetch").toLowerCase();
  console.log(`fan-out start (source=${source}) — ${userIds.length} active users, mode=${mode}`);

  if (mode === "queue" && env.POLL_QUEUE) {
    if (userIds.length === 0) return { users: 0, mode };
    const triggeredAt = new Date().toISOString();
    await env.POLL_QUEUE.sendBatch(
      userIds.map((id) => ({ body: { user_id: id, triggered_at: triggeredAt, trigger: "cron" as const } })),
    );
    console.log(`fan-out queue enqueue took ${Date.now() - t0}ms`);
    return { users: userIds.length, mode };
  }
  if (mode === "queue" && !env.POLL_QUEUE) {
    console.warn("POLL_DISPATCH_MODE=queue but POLL_QUEUE binding is missing; falling back to self-fetch");
  }

  const secret = env.INTERNAL_SYNC_SECRET;
  const appUrl = env.APP_URL;
  if (!secret || !appUrl) {
    console.warn("INTERNAL_SYNC_SECRET or APP_URL not set — falling back to in-process poll (limited to ~7 users)");
    const config = getConfig(env);
    for (const userId of userIds) {
      ctx.waitUntil(
        runPoll(env.DB, config, userId, { syncFirst: true }).catch((err) =>
          console.error(`in-process syncUser ${userId} failed:`, err instanceof Error ? err.message : String(err)),
        ),
      );
    }
    return { users: userIds.length, mode: "in-process" };
  }
  for (const userId of userIds) {
    ctx.waitUntil(
      fetch(`${appUrl.replace(/\/$/, "")}/internal/sync-user`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-secret": secret },
        body: JSON.stringify({ user_id: userId }),
      }).catch((err) =>
        console.error(`fan-out to user ${userId} failed:`, err instanceof Error ? err.message : String(err)),
      ),
    );
  }
  console.log(`fan-out self-fetch dispatch took ${Date.now() - t0}ms`);
  return { users: userIds.length, mode: "self-fetch" };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;

    try {
      // Unauthenticated routes ────────────────────────────────────
      switch (key) {
        case "GET /health":
          return json({ ok: true, service: "desk-time", ts: new Date().toISOString() });
        case "GET /signup":
          return signupPage();
        case "POST /signup":
          return signupSubmit(request, env);
        case "GET /login":
          return loginPage();
        case "POST /login":
          return loginSubmit(request, env);
        case "POST /logout":
          return logoutSubmit(request, env);
        case "POST /internal/sync-user":
          // Auth via X-Internal-Secret header; called by scheduled() fan-out.
          return internalSync(request, env);
        case "POST /internal/trigger-all": {
          // External-cron fan-out (GitHub Actions, uptime pingers). Runs runPoll
          // in-process for every active user and awaits — the response body then
          // reports per-user outcome so the caller has full visibility.
          //
          // In-process (not self-fetch) because self-fetch to our own workers.dev
          // URL from an HTTP handler was silently no-op'ing (each user completed
          // in <1s with no poll_log entry). In-process shares the invocation's
          // 50-subrequest budget: ~7 subreqs per runPoll → good up to ~7 users.
          // Beyond that: switch POLL_DISPATCH_MODE to "queue".
          const secret = env.INTERNAL_SYNC_SECRET;
          if (!secret) return json({ ok: false, error: "INTERNAL_SYNC_SECRET not set" }, 500);
          if (request.headers.get("x-internal-secret") !== secret) {
            return json({ ok: false, error: "unauthorized" }, 401);
          }
          const t0 = Date.now();
          const userIds = await listActiveUserIds(env.DB);
          console.log(`trigger-all (http) — ${userIds.length} users, in-process`);
          const config = getConfig(env);
          const results = await Promise.all(userIds.map(async (userId) => {
            try {
              const r = await runPoll(env.DB, config, userId, { syncFirst: true });
              return { user_id: userId, ok: r.ok, message: r.message, sessions: r.sessions, synced: r.synced };
            } catch (err) {
              return { user_id: userId, ok: false, error: err instanceof Error ? err.message : String(err) };
            }
          }));
          return json({ ok: true, mode: "in-process", users: userIds.length, elapsed_ms: Date.now() - t0, results });
        }
      }

      // Authenticated routes ──────────────────────────────────────
      const user = await resolveUser(request, env);
      if (!user) return redirect("/login");

      switch (key) {
        case "GET /":
          return dashboardPage(request, env, user);
        case "POST /api/sync":
          return apiSyncSubmit(request, env, user);
        case "POST /api/fetch":
          return apiFetchSubmit(request, env, user);
        case "POST /api/leave/add":
          return apiLeaveAdd(request, env, user);
        case "POST /api/leave/remove":
          return apiLeaveRemove(request, env, user);
        case "POST /api/punch/add":
          return apiPunchAdd(request, env, user);
        case "GET /api/dashboard-data":
          return apiDashboardData(request, env, user);
      }

      return json({ ok: false, error: "not found", path: url.pathname }, 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("fetch handler error:", msg, err instanceof Error ? err.stack : "");
      return json({ ok: false, error: "internal error" }, 500);
    }
  },

  // Cron Triggers — fan out per user via the shared helper above.
  // If Cloudflare cron is unreliable, /internal/trigger-all provides the same
  // behavior for an external cron (GitHub Actions) to call.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await fanOutToAllUsers(env, ctx, "cron");
  },

  // Queue consumer — invoked by Cloudflare when queue mode is enabled and messages arrive.
  // No-op / never invoked if [[queues.consumers]] isn't configured in wrangler.toml.
  async queue(batch: MessageBatch<PollMessage>, env: Env): Promise<void> {
    await pollQueueConsumer(batch, env);
  },
};
