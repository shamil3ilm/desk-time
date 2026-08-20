import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { buildDashboardData } from "../report/chart-data.js";
import { renderDashboardHtml } from "../report/chart-html.js";

export async function dashboardPage(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const data = await buildDashboardData(env.DB, config, user.id, user.email);
  const html = renderDashboardHtml(data);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
