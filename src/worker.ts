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
import { internalSync } from "./routes/internal-sync.js";
import { redirect } from "./routes/_html.js";

export interface Env {
  DB: D1Database;
  MASTER_KEY?: string;
  SESSION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  INTERNAL_SYNC_SECRET?: string;
  APP_URL?: string;
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

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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
      }

      return json({ ok: false, error: "not found", path: url.pathname }, 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("fetch handler error:", msg, err instanceof Error ? err.stack : "");
      return json({ ok: false, error: "internal error" }, 500);
    }
  },

  // Cron Triggers — fan out to /internal/sync-user per user via self-fetch.
  // Each self-fetch triggers a NEW Worker invocation with its own 50-subrequest budget,
  // so one user's poll can't starve the others. Scales cleanly to ~48 users on free tier.
  // For >48 users, migrate to Cloudflare Queues.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const userIds = await listActiveUserIds(env.DB);
    console.log(`cron fired — ${userIds.length} active users`);

    const secret = env.INTERNAL_SYNC_SECRET;
    const appUrl = env.APP_URL;

    if (!secret || !appUrl) {
      // Fallback for pre-configured deployments: run in-process (subrequest-limited to ~7 users).
      console.warn("INTERNAL_SYNC_SECRET or APP_URL not set — falling back to in-process poll (limited to ~7 users)");
      const config = getConfig(env);
      for (const userId of userIds) {
        ctx.waitUntil(
          runPoll(env.DB, config, userId, { syncFirst: true }).catch((err) =>
            console.error(`cron in-process syncUser ${userId} failed:`, err instanceof Error ? err.message : String(err)),
          ),
        );
      }
      return;
    }

    for (const userId of userIds) {
      ctx.waitUntil(
        fetch(`${appUrl.replace(/\/$/, "")}/internal/sync-user`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-secret": secret,
          },
          body: JSON.stringify({ user_id: userId }),
        }).catch((err) =>
          console.error(`cron fan-out to user ${userId} failed:`, err instanceof Error ? err.message : String(err)),
        ),
      );
    }
  },
};
