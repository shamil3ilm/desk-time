// Minimal Phase-2 dashboard: shows today's sessions + last poll for the logged-in user.
// Full charts (week/month/pace) come in Phase 2b — port from shamil3ilm/time/src/reports/chart.ts.

import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import type { UserRow } from "../db/types.js";
import { getSessionsBetween, getLastPoll, getLastSync } from "../db/sessions.js";
import { todayISO, fmtHM, fmtClock, fmtUtcAsLocal, liveRunningMinutes } from "../report/dates.js";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function dashboardPage(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const config = getConfig(env);
  const date = todayISO(config.tzOffsetMin);
  const [sessions, lastPoll, lastSync] = await Promise.all([
    getSessionsBetween(env.DB, user.id, date, date),
    getLastPoll(env.DB, user.id),
    getLastSync(env.DB, user.id),
  ]);

  const open = sessions.find((s) => s.punch_out === null);
  const running = liveRunningMinutes(open?.punch_in);
  const closed = sessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const worked = closed + running;
  const target = config.dailyTargetMinutes;
  const remaining = Math.max(0, target - worked);

  const rowsHtml = sessions.length === 0
    ? '<tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No sessions yet today</td></tr>'
    : sessions.map((s, i) => {
        const openRow = s.punch_out === null;
        const live = openRow ? liveRunningMinutes(s.punch_in) : 0;
        const dur = s.duration_minutes !== null ? fmtHM(s.duration_minutes) : `${fmtHM(live)} (open)`;
        return `<tr${openRow ? ' class="open"' : ""}>
          <td>${i + 1}</td>
          <td>${esc(fmtClock(s.punch_in))}</td>
          <td>${esc(s.punch_out ? fmtClock(s.punch_out) : "—")}</td>
          <td>${esc(dur)}</td>
        </tr>`;
      }).join("");

  const footBits = [];
  if (lastPoll) footBits.push(`last fetch ${esc(fmtUtcAsLocal(lastPoll.ran_at, config.tzOffsetMin))} (${esc(lastPoll.status)})`);
  if (lastSync) footBits.push(`last sync ${esc(fmtUtcAsLocal(lastSync.ran_at, config.tzOffsetMin))}`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>desk-time</title>
<meta http-equiv="refresh" content="60" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 36px 24px; background: #0e1015; color: #e8ecf1; }
  .wrap { max-width: 860px; margin: 0 auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
  h1 { font-size: 20px; margin: 0; font-weight: 600; }
  .header-right { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #7d8592; }
  form { display: inline; margin: 0; }
  button {
    background: #1b3a2a; color: #4ade80; border: 1px solid #1f4a35;
    height: 30px; padding: 0 14px; border-radius: 5px; cursor: pointer;
    font: inherit; font-size: 12px; font-weight: 600;
  }
  button.ghost { background: transparent; color: #b7becb; border-color: #262c3b; }
  button:hover { filter: brightness(1.15); }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { background: #171a22; border-radius: 8px; padding: 14px 16px; }
  .kpi .l { color: #6b7385; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi .v { font-size: 22px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .kpi .s { color: #6b7385; font-size: 11px; margin-top: 4px; }
  .card { background: #171a22; border-radius: 8px; padding: 16px; margin-bottom: 14px; }
  .card h2 { font-size: 13px; margin: 0 0 12px; color: #e8ecf1; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #1c2029; font-variant-numeric: tabular-nums; }
  th { color: #6b7385; font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  tr:last-child td { border-bottom: 0; }
  tr.open td { color: #fbbf24; }
  .foot { color: #56607a; font-size: 11px; margin-top: 18px; text-align: right; }
  .muted { color: #6b7385; }
  .phase { background: #1a1f0e; color: #d9f99d; padding: 8px 12px; border-radius: 5px; margin-bottom: 18px; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>desk-time</h1>
    <div class="header-right">
      <form method="post" action="/api/sync"><button type="submit">Sync now</button></form>
      <span>${esc(user.email)}</span>
      <form method="post" action="/logout"><button class="ghost" type="submit">Log out</button></form>
    </div>
  </header>

  <div class="phase">Phase 2 MVP — Today only. Week/Month/Pace charts land in Phase 2b.</div>

  <div class="kpis">
    <div class="kpi"><div class="l">Today</div><div class="v">${esc(fmtHM(worked))}</div><div class="s">of ${esc(fmtHM(target))}${open ? " · in" : ""}</div></div>
    <div class="kpi"><div class="l">Remaining</div><div class="v">${esc(fmtHM(remaining))}</div><div class="s">to daily target</div></div>
    <div class="kpi"><div class="l">Sessions today</div><div class="v">${sessions.length}</div><div class="s">${open ? "1 open" : "all closed"}</div></div>
  </div>

  <div class="card">
    <h2>Today — ${esc(date)}</h2>
    <table><thead><tr><th>#</th><th>In</th><th>Out</th><th>Duration</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  </div>

  <div class="foot">${footBits.join(" · ")}</div>
</div>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
