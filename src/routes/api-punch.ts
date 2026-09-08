import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { nextManualSlot, insertManualSession, updateSessionTimes } from "../db/manual-punch.js";
import { getOpenSessionOnDate } from "../db/sessions.js";
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
  const makeIso = (hhmm: string): string => `${date}T${hhmm}:00${config.tzOffset}`;

  // Case A: two times → always a fresh closed session (user is filling a gap).
  if (later) {
    const punchIn = makeIso(earlier);
    const punchOut = makeIso(later);
    const duration = Math.round((Date.parse(punchOut) - Date.parse(punchIn)) / 60_000);
    if (duration < 0) return json({ ok: false, error: "to before from after sort — internal error" }, 400);
    const slot = await nextManualSlot(env.DB, user.id, date);
    const id = await insertManualSession(env.DB, user.id, slot, date, punchIn, punchOut, duration);
    return json({ ok: true, message: `Added session id=${id}`, data: { id, action: "created" } }, 200);
  }

  // Case B: single time. If there's an already-open session on this date whose
  // punch_in is BEFORE the provided time, close it in place with (existing.in,
  // provided.time) — sorted. This avoids a stray "open" session appearing when
  // the user only forgot the punch-out. If provided time is BEFORE the open
  // session's punch_in, treat it as a genuinely new open session (user is
  // filling in a missed morning punch).
  const providedIso = makeIso(earlier);
  const open = await getOpenSessionOnDate(env.DB, user.id, date);
  if (open && Date.parse(providedIso) > Date.parse(open.punch_in)) {
    const duration = Math.round((Date.parse(providedIso) - Date.parse(open.punch_in)) / 60_000);
    await updateSessionTimes(env.DB, user.id, open.id, open.punch_in, providedIso, duration);
    return json({ ok: true, message: `Closed session id=${open.id} at ${earlier}`, data: { id: open.id, action: "closed" } }, 200);
  }

  const slot = await nextManualSlot(env.DB, user.id, date);
  const id = await insertManualSession(env.DB, user.id, slot, date, providedIso, null, null);
  return json({ ok: true, message: `Added open session id=${id}`, data: { id, action: "created-open" } }, 200);
}
