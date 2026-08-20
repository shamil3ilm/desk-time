import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { runPoll } from "../ats/poll.js";

export async function apiFetchSubmit(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const result = await runPoll(env.DB, config, user.id, { syncFirst: false });
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
}
