import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { nextManualSlot, insertManualSession, updateSessionTimes, deleteSession } from "../db/manual-punch.js";
import { getSessionsBetween } from "../db/sessions.js";
import { todayISO } from "../report/dates.js";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * Smart insertion: place the new punch at its chronological position and pick
 * the right action based on the two neighbouring punch events (prev/next).
 *
 *   prev = an IN of an OPEN session  → new time is that session's OUT (close it)
 *   otherwise                        → new time is IN of a NEW open session
 *
 * Overlap with an already-closed session is rejected — the user should
 * provide both times (Case A below) if they mean to insert into a gap
 * with a specific end.
 */
export async function apiPunchAdd(req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const body = await req.json().catch(() => ({})) as { date?: string; from?: string; to?: string; confirm?: boolean };
  const date = body.date ?? todayISO(config.tzOffsetMin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: "Invalid date" }, 400);
  if (!body.from || !/^\d{2}:\d{2}$/.test(body.from)) return json({ ok: false, error: "from HH:MM required" }, 400);
  if (body.to && !/^\d{2}:\d{2}$/.test(body.to)) return json({ ok: false, error: "to must be HH:MM if provided" }, 400);

  const [earlier, later] = body.to && body.from > body.to ? [body.to, body.from] : [body.from, body.to];
  const makeIso = (hhmm: string): string => `${date}T${hhmm}:00${config.tzOffset}`;
  const confirmed = body.confirm === true;

  // Case A: two times → a fresh closed session. Overlap with a closed session
  // needs an explicit confirm from the client to avoid accidental clutter.
  if (later) {
    const punchIn = makeIso(earlier);
    const punchOut = makeIso(later);
    const duration = Math.round((Date.parse(punchOut) - Date.parse(punchIn)) / 60_000);
    if (duration < 0) return json({ ok: false, error: "to before from after sort — internal error" }, 400);
    const conflict = await findClosedSessionOverlap(env.DB, user.id, date, punchIn, punchOut);
    if (conflict && !confirmed) {
      return json({
        ok: false,
        needs_confirmation: true,
        error: `Overlaps closed session ${clockOf(conflict.punch_in)}–${clockOf(conflict.punch_out ?? '')}`,
        conflict: { id: conflict.id, punch_in: conflict.punch_in, punch_out: conflict.punch_out },
      }, 409);
    }
    const slot = await nextManualSlot(env.DB, user.id, date);
    const id = await insertManualSession(env.DB, user.id, slot, date, punchIn, punchOut, duration);
    return json({ ok: true, message: `Added session id=${id}`, data: { id, action: "created" } }, 200);
  }

  // Case B: single time. Build the chronological event stream and decide.
  const providedIso = makeIso(earlier);
  const rows = await getSessionsBetween(env.DB, user.id, date, date);
  type Ev = { time: string; kind: "in" | "out"; sess: typeof rows[number] };
  const events: Ev[] = [];
  for (const r of rows) {
    events.push({ time: r.punch_in, kind: "in", sess: r });
    if (r.punch_out) events.push({ time: r.punch_out, kind: "out", sess: r });
  }
  events.sort((a, b) => a.time.localeCompare(b.time));

  let prev: Ev | null = null, next: Ev | null = null;
  for (const e of events) { if (e.time < providedIso) prev = e; else if (!next) next = e; }

  // Exact-duplicate time on the day → hard reject (no useful semantics for a zero-length punch).
  if (events.some((e) => e.time === providedIso)) {
    return json({ ok: false, error: `Time ${earlier} already exists on this date` }, 409);
  }

  // Falls inside a closed session (prev IN, next OUT of the same closed session).
  // Requires an explicit confirm — otherwise return the conflict details so the
  // client can prompt the user.
  const insideClosed = prev && next && prev.kind === "in" && next.kind === "out"
    && prev.sess.id === next.sess.id && prev.sess.punch_out !== null ? prev.sess : null;
  if (insideClosed && !confirmed) {
    return json({
      ok: false,
      needs_confirmation: true,
      error: `Falls inside closed session ${clockOf(insideClosed.punch_in)}–${clockOf(insideClosed.punch_out ?? '')}`,
      conflict: { id: insideClosed.id, punch_in: insideClosed.punch_in, punch_out: insideClosed.punch_out },
    }, 409);
  }

  // Prev is the IN of an OPEN session → close it in place.
  if (prev && prev.kind === "in" && prev.sess.punch_out === null) {
    const duration = Math.round((Date.parse(providedIso) - Date.parse(prev.sess.punch_in)) / 60_000);
    await updateSessionTimes(env.DB, user.id, prev.sess.id, prev.sess.punch_in, providedIso, duration);
    return json({ ok: true, message: `Closed session id=${prev.sess.id} at ${earlier}`, data: { id: prev.sess.id, action: "closed" } }, 200);
  }

  // Otherwise the provided time starts a new open session (missed IN). This
  // path handles the confirmed "inside a closed session" case too — the
  // resulting row will overlap in the DB by user choice.
  const slot = await nextManualSlot(env.DB, user.id, date);
  const id = await insertManualSession(env.DB, user.id, slot, date, providedIso, null, null);
  return json({ ok: true, message: `Added open session id=${id}`, data: { id, action: "created-open" } }, 200);
}

async function findClosedSessionOverlap(db: D1Database, userId: number, date: string, punchIn: string, punchOut: string) {
  const rows = await getSessionsBetween(db, userId, date, date);
  const a = Date.parse(punchIn), b = Date.parse(punchOut);
  for (const r of rows) {
    if (r.punch_out === null) continue;
    const s = Date.parse(r.punch_in), e = Date.parse(r.punch_out);
    if (a < e && b > s) return r;
  }
  return null;
}
function clockOf(iso: string): string { return iso ? iso.slice(11, 16) : "—"; }

export async function apiPunchDelete(req: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { session_id?: number };
  const id = Number(body.session_id);
  if (!Number.isFinite(id)) return json({ ok: false, error: "session_id required" }, 400);
  const deleted = await deleteSession(env.DB, user.id, id);
  if (!deleted) return json({ ok: false, error: "session not found" }, 404);
  return json({ ok: true, message: `Deleted session id=${id}` }, 200);
}
