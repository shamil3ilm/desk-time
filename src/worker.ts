// desk-time — shared multi-tenant work-hours tracker on Cloudflare Workers.
// See docs/DESIGN.md for the full architecture. This file is the HTTP + cron entry point.

export interface Env {
  DB: D1Database;

  // Secrets (set via `wrangler secret put NAME`)
  MASTER_KEY?: string;
  SESSION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;

  // Vars (in wrangler.toml [vars])
  ATS_BASE_URL: string;
  APP_TZ_OFFSET: string;
  DAILY_TARGET_MINUTES: string;
  WORKING_DAYS_PER_WEEK: string;
  MONTHLY_CL_ALLOWANCE: string;
  SESSION_ALERT_MINUTES: string;
  SESSION_MAX_MINUTES: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Simple router. As routes grow, extract to src/routes/*.ts.
    switch (`${request.method} ${url.pathname}`) {
      case "GET /health":
        return json({ ok: true, service: "desk-time", ts: new Date().toISOString() });

      case "GET /":
        return html(landingHtml());

      default:
        return json({ ok: false, error: "not found", path: url.pathname }, 404);
    }
  },

  // Cron Triggers hit this. See [triggers].crons in wrangler.toml.
  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // TODO Phase 3: iterate users, ctx.waitUntil(syncUser(env, id)) per user.
    console.log("cron fired at", new Date().toISOString());
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function landingHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>desk-time</title>
<style>
  body { font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 60px 24px; background: #0e1015; color: #e8ecf1; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #7d8592; }
  code { background: #171a22; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>desk-time</h1>
    <p>Scaffold is live. Sign-up and dashboard land in Phase 2.</p>
    <p><a href="/health" style="color: #60a5fa">/health</a> — service check</p>
  </div>
</body>
</html>`;
}
