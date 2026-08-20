import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { runPoll } from "../ats/poll.js";
import { redirect } from "./_html.js";

export async function apiSyncSubmit(req: Request, env: Env, user: UserRow): Promise<Response> {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const config = getConfig(env);
  const result = await runPoll(env.DB, config, user.id, { syncFirst: true, forceSync: force });
  // Form-submit target → redirect back to the dashboard so the browser gets fresh HTML.
  // API-only callers can POST with an Accept: application/json header for JSON.
  const wantsJson = /application\/json/.test(req.headers.get("accept") ?? "");
  if (wantsJson) {
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  }
  return redirect("/");
}
