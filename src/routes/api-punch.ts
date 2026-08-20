import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { nextManualSlot, insertManualSession } from "../db/manual-punch.js";
import { todayISO } from "../report/dates.js";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function apiPunchAdd(req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const body = await req.json().catch(() => ({})) as { date?: string; from?: string; to?: string };
  const date = body.date ?? todayISO(config.tzOffsetMin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: "Invalid date" }, 400);
  if (!body.from || !/^\d{2}:\d{2}$/.test(body.from)) return json({ ok: false, error: "from HH:MM required" }, 400);
  if (body.to && !/^\d{2}:\d{2}$/.test(body.to)) return json({ ok: false, error: "to must be HH:MM if provided" }, 400);
  const [earlier, later] = body.to && body.from > body.to ? [body.to, body.from] : [body.from, body.to];
  const punchIn = `${date}T${earlier}:00${config.tzOffset}`;
  let punchOut: string | null = null;
  let duration: number | null = null;
  if (later) {
    punchOut = `${date}T${later}:00${config.tzOffset}`;
    duration = Math.round((Date.parse(punchOut) - Date.parse(punchIn)) / 60_000);
    if (duration < 0) return json({ ok: false, error: "to before from after sort — internal error" }, 400);
  }
  const slot = await nextManualSlot(env.DB, user.id, date);
  const id = await insertManualSession(env.DB, user.id, slot, date, punchIn, punchOut, duration);
  return json({ ok: true, message: `Added session id=${id}`, data: { id } }, 200);
}
