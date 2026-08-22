// Returns the same DashboardData shape that renderDashboardHtml consumes,
// so the client can refresh sections in place after a mutation (sync / punch / leave)
// instead of a full page reload. Keeps the widget bag lightweight.

import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { buildDashboardData } from "../report/chart-data.js";

export async function apiDashboardData(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const data = await buildDashboardData(env.DB, config, user.id, user.email);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
