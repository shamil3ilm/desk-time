// POST /api/day-type — user classifies a short-worked day as 'partial' or 'half'.
// Body: { date: "YYYY-MM-DD", type: "partial" | "half" | null }
// null clears the classification (reverts to auto/default partial behavior).

import type { Env } from "../worker.js";
import type { UserRow } from "../db/types.js";
import { getConfig } from "../config.js";
import { setDayType, type DayType } from "../db/day-types.js";
import { todayISO } from "../report/dates.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function apiDayType(req: Request, env: Env, user: UserRow): Promise<Response> {
  let body: { date?: string; type?: string | null } = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON body" }, 400); }

  const date = body.date;
  if (!date || !ISO_DATE.test(date)) {
    return json({ ok: false, error: "date must be YYYY-MM-DD" }, 400);
  }
  const config = getConfig(env);
  if (date > todayISO(config.tzOffsetMin)) {
    return json({ ok: false, error: "date cannot be in the future" }, 400);
  }

  const rawType = body.type;
  let type: DayType | null;
  if (rawType === null || rawType === undefined || rawType === "") type = null;
  else if (rawType === "partial" || rawType === "half") type = rawType;
  else return json({ ok: false, error: "type must be 'partial', 'half', or null" }, 400);

  await setDayType(env.DB, user.id, date, type, config.dailyTargetMinutes);
  return json({ ok: true, date, type });
}
