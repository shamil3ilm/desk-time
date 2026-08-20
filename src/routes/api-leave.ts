import type { Env } from "../worker.js";
import type { UserRow } from "../db/types.js";
import { addLeave, removeLeave, type LeaveType } from "../db/leaves.js";

const VALID_TYPES: LeaveType[] = ["casual", "medical", "festival", "planned", "holiday", "other"];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function apiLeaveAdd(req: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { date?: string; type?: string; reason?: string };
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return json({ ok: false, error: "Invalid date (YYYY-MM-DD)" }, 400);
  const type = (body.type ?? "casual") as LeaveType;
  if (!VALID_TYPES.includes(type)) return json({ ok: false, error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` }, 400);
  await addLeave(env.DB, user.id, body.date, body.reason ?? null, type);
  return json({ ok: true, message: `Marked ${body.date} as ${type} leave` }, 200);
}

export async function apiLeaveRemove(req: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { date?: string };
  if (!body.date) return json({ ok: false, error: "date required" }, 400);
  const removed = await removeLeave(env.DB, user.id, body.date);
  return json({ ok: removed, message: removed ? `Removed leave for ${body.date}` : `No leave for ${body.date}` }, removed ? 200 : 404);
}
