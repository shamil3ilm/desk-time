// Internal fan-out target used by scheduled() to give each user's poll its own
// Worker invocation (and thus its own 50-subrequest budget on the free tier).
// Protected by a shared secret so it can't be triggered externally.

import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import { runPoll } from "../ats/poll.js";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function internalSync(req: Request, env: Env): Promise<Response> {
  const secret = env.INTERNAL_SYNC_SECRET;
  if (!secret) return json({ ok: false, error: "INTERNAL_SYNC_SECRET not set on the Worker" }, 500);
  if (req.headers.get("x-internal-secret") !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const body = await req.json().catch(() => ({})) as { user_id?: number };
  const userId = Number(body.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return json({ ok: false, error: "user_id (positive integer) required" }, 400);
  }
  const config = getConfig(env);
  const result = await runPoll(env.DB, config, userId, { syncFirst: true });
  return json(result, result.ok ? 200 : 500);
}
