// Full dashboard HTML — ported from shamil3ilm/time/src/reports/chart.ts.
// Server-mode only (no file:// fallback), so every button hits real API endpoints.

import type { DashboardData } from "./chart-data.js";

export function renderDashboardHtml(data: DashboardData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>desk-time — Work hours</title>
<meta http-equiv="refresh" content="600" />
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 36px 24px 48px; background: #0e1015; color: #e8ecf1; }
  .wrap { max-width: 860px; margin: 0 auto; }
  header { margin-bottom: 22px; }
  header .title-row { display: flex; align-items: center; justify-content: space-between; }
  header .header-right { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 22px; margin: 0; font-weight: 600; letter-spacing: -0.01em; }
  header .sub { color: #6b7385; font-size: 13px; margin-top: 2px; }
  .sync-btn { background-color: #1b3a2a; color: #4ade80; border: 1px solid #1f4a35; height: 30px; padding: 0 14px; border-radius: 5px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
  .sync-btn:hover:not(:disabled) { background-color: #235241; border-color: #2f6b53; color: #86efac; }
  .sync-btn.copied { background-color: #2b3b1f; color: #d9f99d; border-color: #3f5730; }
  .sync-btn.ghost { background-color: transparent; color: #b7becb; border-color: #262c3b; }
  .sync-btn.ghost:hover:not(:disabled) { background-color: #1f2431; color: #e8ecf1; border-color: #3a4358; }
  .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .muted { color: #6b7385; font-size: 12px; }
  b { font-weight: 600; }

  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
  .kpi { background: #171a22; border-radius: 8px; padding: 16px 18px; }
  .kpi .l { color: #6b7385; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi .v { font-size: 22px; font-weight: 600; margin-top: 6px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .kpi .s { color: #6b7385; font-size: 11px; margin-top: 4px; }
  .kpi.pos .v { color: #4ade80; }
  .kpi.neg .v { color: #f87171; }

  .alert { border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
  .alert.warn { background: #241a08; color: #fbbf24; }
  .alert.crit { background: #2a0e10; color: #fca5a5; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

  .card { background: #171a22; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px; }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; gap: 12px; flex-wrap: wrap; }
  .card-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .card h2 { font-size: 13px; color: #e8ecf1; margin: 0; font-weight: 600; letter-spacing: -0.005em; }
  .card-sub { color: #6b7385; font-size: 12px; font-variant-numeric: tabular-nums; }
  .nav { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #b7becb; }
  .nav button, .nav select, .nav input { background-color: #0e1015; border: 1px solid #262c3b; color: #e8ecf1; height: 26px; border-radius: 5px; cursor: pointer; font: inherit; padding: 0 8px; outline: none; }
  .nav button { width: 26px; padding: 0; line-height: 1; color: #b7becb; }
  .nav button:hover:not(:disabled), .nav select:hover, .nav input:hover { border-color: #3a4358; color: #e8ecf1; }
  .nav select:focus, .nav input:focus { border-color: #3a4358; }
  .nav button:disabled { opacity: 0.3; cursor: default; }
  .nav .today-btn { padding: 0 10px; color: #6b7385; width: auto; background-color: transparent; border-color: transparent; }
  .nav .today-btn:hover:not(:disabled) { color: #e8ecf1; border-color: #262c3b; }
  .nav input[type=date] { color-scheme: dark; }
  .nav select { appearance: none; padding-right: 26px; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='%23b7becb'><path d='M0 0l5 6 5-6z'/></svg>"); background-repeat: no-repeat; background-position: right 8px center; background-size: 8px; }
  .nav select option { background: #171a22; color: #e8ecf1; }

  .summary { color: #b7becb; font-size: 12px; margin: 8px 0 12px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
  .summary b { color: #e8ecf1; font-variant-numeric: tabular-nums; }
  .summary .pos b { color: #4ade80; }
  .summary .neg b { color: #f87171; }
  .summary .sep { color: #3a4056; }
  .leave-line { color: #6b7385; font-size: 11px; margin: -4px 0 12px; }
  .leave-line b { color: #b7becb; }
  .leave-line .comp { color: #4ade80; }
  .leave-line .partial { color: #fb923c; }
  .leave-line .partial b { color: #fb923c; }

  .cwrap { position: relative; height: 200px; margin-top: 4px; }
  .cwrap.clickable canvas { cursor: pointer; }
  .back-link { color: #6b7385; font-size: 12px; margin-top: 10px; cursor: pointer; background: none; border: 0; padding: 0; }
  .back-link:hover { color: #e8ecf1; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #1c2029; font-variant-numeric: tabular-nums; }
  th { color: #6b7385; font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  tr:last-child td { border-bottom: 0; }
  tr.open td { color: #fbbf24; }
  th:first-child, td:first-child { padding-left: 0; color: #6b7385; }

  .foot { color: #4b5568; font-size: 11px; margin-top: 22px; text-align: right; }
  .foot a { color: #6b7385; text-decoration: none; margin-left: 12px; }
  .foot a:hover { color: #b7becb; }

  .leave-form { margin-top: 14px; border-top: 1px solid #1c2029; padding-top: 12px; }
  .leave-form summary {
    display: inline-flex; align-items: center; gap: 6px;
    color: #b7becb; font-size: 12px; font-weight: 500;
    padding: 6px 12px; border: 1px solid #262c3b; border-radius: 5px;
    cursor: pointer; user-select: none; list-style: none;
  }
  .leave-form summary::-webkit-details-marker { display: none; }
  .leave-form summary::before { content: "+"; color: #6b7385; font-weight: 400; font-size: 14px; line-height: 1; }
  .leave-form summary:hover { border-color: #3a4358; color: #e8ecf1; background: #1f2431; }
  .leave-form[open] summary { color: #e8ecf1; border-color: #3a4358; }
  .leave-form[open] summary::before { content: "−"; }
  .lf-body { margin-top: 10px; }
  .lf-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; }
  .lf-row label { color: #6b7385; font-size: 11px; }
  .lf-row input, .lf-row select { background-color: #0e1015; color: #e8ecf1; border: 1px solid #262c3b; height: 28px; padding: 0 10px; border-radius: 5px; font: inherit; outline: none; }
  .lf-row input:hover, .lf-row select:hover, .lf-row input:focus, .lf-row select:focus { border-color: #3a4358; }
  .lf-row input[type=text] { flex: 1; min-width: 140px; }
  .lf-row input[type=date], .lf-row input[type=time] { color-scheme: dark; }
  .lf-row select { appearance: none; padding-right: 26px; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='%23b7becb'><path d='M0 0l5 6 5-6z'/></svg>"); background-repeat: no-repeat; background-position: right 8px center; background-size: 8px; }
  .lf-row select option { background: #171a22; color: #e8ecf1; }
  .lf-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .lf-btn { background: #262c3b; color: #e8ecf1; border: 0; height: 28px; padding: 0 12px; border-radius: 5px; cursor: pointer; font: inherit; font-size: 12px; }
  .lf-btn:hover { background: #333a4d; }
  .lf-btn.ghost { background: transparent; border: 1px solid #262c3b; color: #b7becb; }
  .lf-btn.ghost:hover { background: #1f2431; color: #e8ecf1; }

  @media (max-width: 720px) { .kpis { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="title-row">
      <h1>Work hours</h1>
      <div class="header-right">
        <button id="refreshNow" class="sync-btn ghost" title="Fetch current data (no sync)">Refresh</button>
        <button id="syncNow" class="sync-btn" title="Trigger ATS sync + fetch">Sync now</button>
        <div class="muted" id="todayStamp"></div>
      </div>
    </div>
    <div class="sub" id="todaySub"></div>
  </header>

  <div id="alert" class="alert" hidden></div>

  <div class="kpis" id="kpis"></div>

  <div class="card">
    <div class="card-head">
      <div class="card-title"><h2>Sessions</h2><span class="card-sub" id="sLabel"></span></div>
      <div class="nav">
        <button id="dPrev" aria-label="Previous day">‹</button>
        <input type="date" id="dPicker" />
        <button id="dNext" aria-label="Next day">›</button>
        <button class="today-btn" id="dToday">Today</button>
      </div>
    </div>
    <div class="summary" id="sSummary"></div>
    <table id="sTable"><thead><tr><th>#</th><th>In</th><th>Out</th><th>Duration</th></tr></thead><tbody></tbody></table>

    <details class="leave-form">
      <summary>Missed a punch? Add it manually</summary>
      <div class="lf-body">
        <div class="lf-row">
          <label>Date</label>
          <input type="date" id="pfDate" />
          <label>Time 1</label>
          <input type="time" id="pfT1" step="60" />
          <label>Time 2</label>
          <input type="time" id="pfT2" step="60" placeholder="optional" />
        </div>
        <div class="lf-actions">
          <button id="pfSave" class="lf-btn">Save punch</button>
          <span class="muted" id="pfMsg"></span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:6px">Order doesn't matter — earlier time becomes the in, later becomes the out. Leave Time 2 blank for an open session.</div>
      </div>
    </details>
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title"><h2>Week</h2><span class="card-sub" id="wLabel"></span></div>
      <div class="nav">
        <button id="wPrev" aria-label="Previous week">‹</button>
        <button id="wNext" aria-label="Next week">›</button>
        <button class="today-btn" id="wToday">This week</button>
      </div>
    </div>
    <div class="summary" id="wSummary"></div>
    <div class="cwrap clickable"><canvas id="weekChart"></canvas></div>
    <div class="muted" style="font-size:11px;text-align:center;margin-top:6px">Click a day to view its sessions ↑</div>
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title"><h2>Month</h2><span class="card-sub" id="mLabel"></span></div>
      <div class="nav">
        <select id="mSelect"></select>
        <button class="today-btn" id="mToday">This month</button>
      </div>
    </div>
    <div class="summary" id="mSummary"></div>
    <div class="leave-line" id="mLeaves"></div>
    <div id="monthMain">
      <div class="cwrap clickable"><canvas id="monthChart"></canvas></div>
      <div class="muted" style="font-size:11px;text-align:center;margin-top:6px">Click a week to drill in</div>
    </div>
    <div id="monthDrill" hidden>
      <div class="summary" id="drillSummary"></div>
      <div class="cwrap clickable"><canvas id="drillChart"></canvas></div>
      <button class="back-link" id="drillBack">‹ back to month view</button>
    </div>

    <details class="leave-form">
      <summary>Add / remove a leave</summary>
      <div class="lf-body">
        <div class="lf-row">
          <label>Date</label>
          <input type="date" id="lfDate" />
          <label>Type</label>
          <select id="lfType">
            <option value="casual">casual</option>
            <option value="medical" selected>medical</option>
            <option value="festival">festival</option>
            <option value="planned">planned</option>
            <option value="holiday">holiday</option>
            <option value="other">other</option>
          </select>
          <label>Reason</label>
          <input type="text" id="lfReason" placeholder="optional" />
        </div>
        <div class="lf-actions">
          <button id="lfSaveAdd" class="lf-btn">Save leave</button>
          <button id="lfSaveRemove" class="lf-btn ghost">Remove leave</button>
          <span class="muted" id="lfMsg"></span>
        </div>
      </div>
    </details>
  </div>

  <div class="foot" id="foot"><span id="footInfo"></span> <a href="/logout" onclick="event.preventDefault(); fetch('/logout',{method:'POST'}).then(()=>location.href='/login')">log out (${escapeHtml(data.userEmail)})</a></div>
</div>

<script>
const D = ${JSON.stringify(data)};
async function callApi(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.json().catch(() => ({ ok: false, error: "invalid JSON" }));
}
function fmtHours(h) { const s = h<0?"-":""; const a = Math.abs(h); const hh = Math.floor(a); const mm = Math.round((a-hh)*60); return s+hh+"h "+String(mm).padStart(2,"0")+"m"; }
function fmtHM(m) { return fmtHours(m/60); }
function fmtSigned(h) { return (h>=0?"+":"")+fmtHours(h); }
function clock(iso) { return iso ? iso.slice(11,16) : "—"; }
function liveRunningMin() { return D.openPunchInMs ? Math.max(0, Math.round((Date.now()-D.openPunchInMs)/60000)) : 0; }
function liveTodayHours() { return +(D.closedTodayHours + liveRunningMin()/60).toFixed(2); }

const grid = "rgba(255,255,255,0.04)";
const tick = "#4a5262";
const yHours = { beginAtZero: true, grid: { color: grid }, ticks: { color: tick, callback: (v) => v+"h" } };
const xAxis = { ticks: { color: tick }, grid: { display: false } };

const dowFull = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const dowShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function niceDate(iso) { const d = new Date(iso+"T00:00:00"); return dowShort[d.getDay()]+", "+monShort[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
function niceDateFull(iso) { const d = new Date(iso+"T00:00:00"); return dowFull[d.getDay()]+", "+monShort[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
document.getElementById("todayStamp").textContent = niceDate(D.today);
const subEl = document.getElementById("todaySub");
if (D.todayNonWorking) {
  const kind = D.todayIsSunday ? "Sunday" : "Leave day";
  subEl.textContent = kind + " — no required target. Any hours worked are bonus and count toward the month.";
}

function renderKpis() {
  const running = liveRunningMin();
  const totalLive = liveTodayHours();
  const bonusTag = D.todayNonWorking && (totalLive > 0 || D.isPunchedIn) ? " · bonus" : "";
  const todaySub = D.todayTargetHours === 0
    ? (D.todayIsSunday ? "Sunday — no target" : "Leave day — no target")
    : D.isPunchedIn ? "of " + fmtHours(D.todayTargetHours) + " · running " + fmtHM(running) + bonusTag
    : "of " + fmtHours(D.todayTargetHours) + bonusTag;
  const eta = D.todayTargetHours === 0 ? { v: "—", s: "no target today" }
    : (totalLive * 60 >= D.todayTargetHours * 60) ? { v: "met", tone: "pos", s: "target reached" }
    : (() => { const e = new Date(D.etaEpochMs); return { v: String(e.getHours()).padStart(2,"0") + ":" + String(e.getMinutes()).padStart(2,"0"), s: (D.isPunchedIn ? "if working" : "if resume now") + (D.todayNonWorking ? " (bonus)" : "") }; })();
  const bal = D.monthDaysBalance;
  const paceLabel = bal > 0 ? bal+" day"+(bal===1?"":"s")+" ahead" : bal < 0 ? Math.abs(bal)+" day"+(bal===-1?"":"s")+" behind" : "on track";
  const paceVal = bal > 0 ? "+"+bal+"d" : bal < 0 ? bal+"d" : "0d";
  const kpis = [
    { l: "Today", v: fmtHours(totalLive), s: todaySub },
    { l: "Target ETA", v: eta.v, s: eta.s, tone: eta.tone || "" },
    { l: "Pace", v: paceVal, s: paceLabel, tone: bal > 0 ? "pos" : bal < 0 ? "neg" : "" },
  ];
  document.getElementById("kpis").innerHTML = kpis.map(k => '<div class="kpi '+(k.tone||"")+'"><div class="l">'+k.l+'</div><div class="v">'+k.v+'</div><div class="s">'+k.s+'</div></div>').join("");
}

function renderAlert() {
  const el = document.getElementById("alert");
  if (!D.isPunchedIn) { el.hidden = true; return; }
  const m = liveRunningMin();
  if (m >= D.sessionMaxMin) {
    el.hidden = false; el.className = "alert crit";
    el.innerHTML = "Session <b>"+fmtHM(m)+"</b> — over "+fmtHM(D.sessionMaxMin)+" cap. Punch out now.";
  } else if (m >= D.sessionAlertMin) {
    el.hidden = false; el.className = "alert warn";
    el.innerHTML = "Session <b>"+fmtHM(m)+"</b> — approaching "+fmtHM(D.sessionMaxMin)+" cap.";
  } else { el.hidden = true; }
}

// Sync/Refresh buttons
async function runButton(btn, doingLabel, endpoint) {
  const original = btn.textContent; btn.disabled = true; btn.textContent = doingLabel;
  try {
    const r = await callApi(endpoint, null);
    if (r.ok) { btn.textContent = "✓ Done — reloading"; btn.classList.add("copied"); setTimeout(() => location.reload(), 700); }
    else { btn.textContent = "Failed — " + (r.error || "unknown"); setTimeout(() => { btn.textContent = original; btn.disabled = false; btn.classList.remove("copied"); }, 3000); }
  } catch (err) { btn.textContent = "Failed — " + err.message; setTimeout(() => { btn.textContent = original; btn.disabled = false; btn.classList.remove("copied"); }, 3000); }
}
document.getElementById("syncNow").onclick = () => runButton(document.getElementById("syncNow"), "Syncing…", "/api/sync?force=1");
document.getElementById("refreshNow").onclick = () => runButton(document.getElementById("refreshNow"), "Refreshing…", "/api/fetch");

// Week card
let weekIdx = D.weeks.length - 1;
let weekChart;
function renderWeek() {
  const w = D.weeks[weekIdx];
  document.getElementById("wLabel").textContent = monShort[+w.start.slice(5,7)-1]+" "+ +w.start.slice(8,10)+" – "+monShort[+w.end.slice(5,7)-1]+" "+ +w.end.slice(8,10)+", "+w.end.slice(0,4);
  document.getElementById("wPrev").disabled = weekIdx === 0;
  document.getElementById("wNext").disabled = weekIdx === D.weeks.length - 1;
  document.getElementById("wToday").disabled = weekIdx === D.weeks.length - 1;
  const bal = w.total - w.target;
  document.getElementById("wSummary").innerHTML =
    '<span>Worked <b>'+fmtHours(w.total)+'</b></span><span class="sep">·</span>'+
    '<span>Target <b>'+fmtHours(w.target)+'</b></span><span class="sep">·</span>'+
    '<span class="'+(bal>=0?"pos":"neg")+'">Balance <b>'+fmtSigned(bal)+'</b></span>';
  const cfg = {
    type: "bar",
    data: {
      labels: w.days.map(d => d.label),
      datasets: [
        { label: "Worked", data: w.days.map(d => d.hours), backgroundColor: w.days.map(d => d.date === D.today ? "#fbbf24" : d.isSunday ? "#2f3547" : d.isPartial ? "#fb923c" : "#60a5fa"), borderRadius: 4, barPercentage: 0.68 },
        { label: "Target", data: w.days.map(d => d.targetHours), type: "line", borderColor: "#3a4056", borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 180 },
      scales: { y: { ...yHours, suggestedMax: 10, ticks: { ...yHours.ticks, stepSize: 2 } }, x: xAxis },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => niceDateFull(w.days[items[0].dataIndex].date), label: (c) => c.dataset.label+": "+fmtHours(c.parsed.y), afterBody: (items) => sessionsTooltipLines(w.days[items[0].dataIndex].date) } } },
      onClick: (evt) => { const points = weekChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true); if (points.length) jumpSessionsTo(w.days[points[0].index].date); },
    },
  };
  if (weekChart) { weekChart.data = cfg.data; weekChart.options = cfg.options; weekChart.update(); }
  else weekChart = new Chart(document.getElementById("weekChart"), cfg);
}
function sessionsTooltipLines(date) {
  const rows = D.sessions.byDate[date];
  if (!rows || rows.length === 0) return ["", "No sessions"];
  const isToday = date === D.today;
  const lines = ["", "Sessions:"];
  for (const s of rows) {
    const inT = s.punch_in.slice(11, 16);
    const outT = s.punch_out ? s.punch_out.slice(11, 16) : "—";
    const openLive = s.punch_out === null && isToday ? liveRunningMin() : null;
    const dur = s.duration_minutes !== null ? fmtHM(s.duration_minutes) : openLive !== null ? fmtHM(openLive)+" (open)" : "(open)";
    lines.push("  "+inT+" → "+outT+"   "+dur);
  }
  return lines;
}
function jumpSessionsTo(date) {
  if (date > D.today || date < D.earliestDate) return;
  dPicker.value = date;
  renderSessions();
  document.getElementById("sLabel").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Month card
let monthChart, drillChart;
const mSelect = document.getElementById("mSelect");
D.months.slice().reverse().forEach((m) => { const opt = document.createElement("option"); opt.value = m.key; opt.textContent = m.label; mSelect.appendChild(opt); });
mSelect.value = D.months[D.months.length - 1].key;
function currentMonth() { return D.months.find(m => m.key === mSelect.value); }
function renderMonth() {
  const m = currentMonth();
  document.getElementById("mToday").disabled = mSelect.value === D.months[D.months.length - 1].key;
  document.getElementById("mLabel").textContent = m.label;
  const bal = m.daysBalance;
  const paceStr = bal > 0 ? bal+"d ahead" : bal < 0 ? Math.abs(bal)+"d behind" : "on track";
  // Hours banked/owed within the month (opt-in via toggle; preference stored in localStorage).
  const bankMin = m.bankedMinutes;
  const showHours = localStorage.getItem("dt.showHoursBank") === "1";
  const hoursBankStr = !showHours || bankMin === 0 ? ""
    : bankMin > 0 ? '<span class="sep">·</span><span class="pos">Hours <b>+'+fmtHM(bankMin)+'</b> banked</span>'
    : '<span class="sep">·</span><span class="neg">Hours <b>-'+fmtHM(-bankMin)+'</b> owed</span>';
  const toggleStr = '<span class="sep">·</span><a href="#" id="mHoursToggle" class="muted" style="text-decoration:none;cursor:pointer">'+(showHours ? "hide hours" : "show hours")+'</a>';
  document.getElementById("mSummary").innerHTML =
    '<span>Required <b>'+m.workingDays+'d</b></span><span class="sep">·</span>'+
    '<span>Completed <b>'+m.daysCompleted+'d</b>'+(m.workingDaysLeftIncludingToday > 0 ? ' of <b>'+m.daysElapsed+'d</b> elapsed' : '')+'</span><span class="sep">·</span>'+
    '<span class="'+(bal>=0?"pos":"neg")+'">Pace <b>'+paceStr+'</b></span>'+
    hoursBankStr +
    (m.workingDaysLeftIncludingToday > 0 ? '<span class="sep">·</span><span class="muted">'+m.workingDaysLeftIncludingToday+'d left</span>' : '')+
    '<span class="sep">·</span><span class="muted">'+fmtHours(m.worked)+' worked</span>'+
    toggleStr;
  document.getElementById("mHoursToggle").onclick = (e) => {
    e.preventDefault();
    localStorage.setItem("dt.showHoursBank", showHours ? "0" : "1");
    renderMonth();
  };

  const leaveEl = document.getElementById("mLeaves");
  const any = m.excusedLeaves + m.unexcusedLeaves + m.sundaysWorked + m.preEmploymentDays;
  if (any === 0) { leaveEl.textContent = ""; leaveEl.hidden = true; }
  else {
    leaveEl.hidden = false;
    const parts = [];
    if (m.preEmploymentDays > 0) parts.push('<span class="muted">Pre-employment: <b>'+m.preEmploymentDays+'d</b></span>');
    if (m.excusedLeaves > 0) {
      const typeParts = Object.entries(m.excusedByType).map(([t, dates]) => t+' <b>'+dates.length+'</b> <span class="muted">('+dates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", ")+')</span>');
      parts.push('<span class="comp">Excused: '+typeParts.join(', ')+'</span>');
    }
    if (m.partialDays > 0) {
      const dates = m.partialDates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", ");
      parts.push('<span class="partial">Partial days: <b>'+m.partialDays+'</b> <span class="muted">('+dates+')</span></span>');
    }
    if (m.unexcusedLeaves > 0) {
      const dates = m.unexcusedDates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", ");
      parts.push('Missed days: <b>'+m.unexcusedLeaves+'</b> <span class="muted">('+dates+')</span>');
    }
    if (m.sundaysWorked > 0) parts.push('<span class="comp">Sundays worked: <b>'+m.sundaysWorked+'</b></span>');
    leaveEl.innerHTML = parts.join(' <span class="sep">·</span> ');
  }

  const yMax = Math.max(50, Math.ceil(m.weeks.reduce((mx, w) => Math.max(mx, w.hours, w.target), 0) / 10) * 10);
  const cfg = {
    type: "bar",
    data: {
      labels: m.weeks.map(w => w.label),
      datasets: [
        { label: "Worked", data: m.weeks.map(w => w.hours), backgroundColor: "#60a5fa", borderRadius: 4, barPercentage: 0.68 },
        { label: "Target", data: m.weeks.map(w => w.target), type: "line", borderColor: "#3a4056", borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 180 },
      scales: { y: { ...yHours, suggestedMax: yMax, ticks: { ...yHours.ticks, stepSize: yMax > 40 ? 10 : 5 } }, x: xAxis },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.dataset.label+": "+fmtHours(c.parsed.y) } } },
      onClick: (evt) => { const points = monthChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true); if (points.length) drillIntoWeek(m.weeks[points[0].index]); },
    },
  };
  if (monthChart) { monthChart.data = cfg.data; monthChart.options = cfg.options; monthChart.update(); }
  else monthChart = new Chart(document.getElementById("monthChart"), cfg);
  document.getElementById("monthMain").hidden = false;
  document.getElementById("monthDrill").hidden = true;
}
function drillIntoWeek(wb) {
  document.getElementById("monthMain").hidden = true;
  document.getElementById("monthDrill").hidden = false;
  const bal = wb.hours - wb.target;
  document.getElementById("drillSummary").innerHTML =
    '<span><b>Week of '+monShort[+wb.start.slice(5,7)-1]+" "+ +wb.start.slice(8)+'</b></span><span class="sep">·</span>'+
    '<span>Worked <b>'+fmtHours(wb.hours)+'</b></span><span class="sep">·</span>'+
    '<span>Target <b>'+fmtHours(wb.target)+'</b></span><span class="sep">·</span>'+
    '<span class="'+(bal>=0?"pos":"neg")+'">Balance <b>'+fmtSigned(bal)+'</b></span>';
  const cfg = {
    type: "bar",
    data: {
      labels: wb.days.map(d => d.label),
      datasets: [
        { label: "Worked", data: wb.days.map(d => d.hours), backgroundColor: wb.days.map(d => d.date === D.today ? "#fbbf24" : d.isSunday ? "#2f3547" : "#60a5fa"), borderRadius: 4, barPercentage: 0.68 },
        { label: "Target", data: wb.days.map(d => d.targetHours), type: "line", borderColor: "#3a4056", borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 180 },
      scales: { y: { ...yHours, suggestedMax: 10, ticks: { ...yHours.ticks, stepSize: 2 } }, x: xAxis },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => niceDateFull(wb.days[items[0].dataIndex].date), label: (c) => c.dataset.label+": "+fmtHours(c.parsed.y), afterBody: (items) => sessionsTooltipLines(wb.days[items[0].dataIndex].date) } } },
      onClick: (evt) => { const points = drillChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true); if (points.length) jumpSessionsTo(wb.days[points[0].index].date); },
    },
  };
  if (drillChart) { drillChart.data = cfg.data; drillChart.options = cfg.options; drillChart.update(); }
  else drillChart = new Chart(document.getElementById("drillChart"), cfg);
}

// Sessions
const dPicker = document.getElementById("dPicker");
dPicker.value = D.today; dPicker.min = D.earliestDate; dPicker.max = D.today;
function renderSessions() {
  const date = dPicker.value;
  const rows = (D.sessions.byDate[date] || []).slice();
  const dayIsSun = new Date(date+"T00:00:00").getDay() === 0;
  const isToday = date === D.today;
  document.getElementById("dToday").disabled = isToday;
  document.getElementById("sLabel").textContent = niceDateFull(date);

  let total = 0;
  const tbody = document.querySelector("#sTable tbody");
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No sessions</td></tr>';
  } else {
    tbody.innerHTML = rows.map((s, i) => {
      const openRow = s.punch_out === null && isToday;
      const live = openRow ? liveRunningMin() : 0;
      const dur = s.duration_minutes !== null ? s.duration_minutes : live;
      total += dur;
      const durLabel = s.duration_minutes !== null ? fmtHM(dur) : fmtHM(live)+' <span class="muted">(open)</span>';
      return '<tr'+(openRow?' class="open"':'')+'><td>'+(i+1)+'</td><td>'+clock(s.punch_in)+'</td><td>'+clock(s.punch_out)+'</td><td>'+durLabel+'</td></tr>';
    }).join("");
  }
  const target = dayIsSun ? 0 : (D.todayTargetHours * 60);
  const bal = total - target;
  const parts = [
    '<span><b>'+rows.length+'</b> session'+(rows.length===1?'':'s')+'</span>',
    '<span class="sep">·</span>',
    '<span>Worked <b>'+fmtHM(total)+'</b></span>',
  ];
  if (dayIsSun) parts.push('<span class="sep">·</span>', '<span class="muted">Sunday · no target</span>');
  else parts.push('<span class="sep">·</span>', '<span>Target <b>'+fmtHM(target)+'</b></span>', '<span class="sep">·</span>', '<span class="'+(bal>=0?"pos":"neg")+'">Balance <b>'+(bal>=0?"+":"")+fmtHM(bal)+'</b></span>');
  document.getElementById("sSummary").innerHTML = parts.join("");
}

// Nav wiring
document.getElementById("wPrev").onclick = () => { if (weekIdx > 0) { weekIdx--; renderWeek(); } };
document.getElementById("wNext").onclick = () => { if (weekIdx < D.weeks.length - 1) { weekIdx++; renderWeek(); } };
document.getElementById("wToday").onclick = () => { weekIdx = D.weeks.length - 1; renderWeek(); };
mSelect.onchange = renderMonth;
document.getElementById("mToday").onclick = () => { mSelect.value = D.months[D.months.length - 1].key; renderMonth(); };
document.getElementById("drillBack").onclick = () => { document.getElementById("monthDrill").hidden = true; document.getElementById("monthMain").hidden = false; };
function shiftDay(days) {
  const d = new Date(dPicker.value+"T00:00:00"); d.setDate(d.getDate()+days);
  const iso = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  if (iso > D.today || iso < D.earliestDate) return;
  dPicker.value = iso; renderSessions();
}
document.getElementById("dPrev").onclick = () => shiftDay(-1);
document.getElementById("dNext").onclick = () => shiftDay(1);
document.getElementById("dToday").onclick = () => { dPicker.value = D.today; renderSessions(); };
dPicker.onchange = renderSessions;

// Leave form
const lfDate = document.getElementById("lfDate");
const lfType = document.getElementById("lfType");
const lfReason = document.getElementById("lfReason");
const lfMsg = document.getElementById("lfMsg");
lfDate.value = D.today; lfDate.min = D.earliestDate;
document.getElementById("lfSaveAdd").onclick = async () => {
  const r = await callApi("/api/leave/add", { date: lfDate.value, type: lfType.value, reason: lfReason.value.trim() || undefined });
  lfMsg.textContent = r.ok ? "✓ saved — reloading" : "failed: "+r.error;
  if (r.ok) setTimeout(() => location.reload(), 700);
  else setTimeout(() => lfMsg.textContent = "", 2500);
};
document.getElementById("lfSaveRemove").onclick = async () => {
  const r = await callApi("/api/leave/remove", { date: lfDate.value });
  lfMsg.textContent = r.ok ? "✓ removed — reloading" : "failed: "+r.error;
  if (r.ok) setTimeout(() => location.reload(), 700);
  else setTimeout(() => lfMsg.textContent = "", 2500);
};

// Punch form
const pfDate = document.getElementById("pfDate");
const pfT1 = document.getElementById("pfT1");
const pfT2 = document.getElementById("pfT2");
const pfMsg = document.getElementById("pfMsg");
pfDate.value = D.today; pfDate.min = D.earliestDate; pfDate.max = D.today;
document.getElementById("pfSave").onclick = async () => {
  if (!pfT1.value && !pfT2.value) { pfMsg.textContent = "enter at least one time"; setTimeout(() => pfMsg.textContent = "", 2000); return; }
  const times = [pfT1.value, pfT2.value].filter(Boolean).sort();
  const r = await callApi("/api/punch/add", { date: pfDate.value, from: times[0], to: times[1] });
  pfMsg.textContent = r.ok ? "✓ added — reloading" : "failed: "+r.error;
  if (r.ok) setTimeout(() => location.reload(), 700);
  else setTimeout(() => pfMsg.textContent = "", 2500);
};

// Initial + tick
renderKpis(); renderAlert(); renderWeek(); renderMonth(); renderSessions();
setInterval(() => { renderKpis(); renderAlert(); if (dPicker.value === D.today) renderSessions(); }, 30_000);

const footBits = ["Generated " + D.generatedAt];
if (D.lastPoll) footBits.push("last fetch " + D.lastPoll.ran_at + " (" + D.lastPoll.status + ")");
if (D.lastSync) footBits.push("last sync " + D.lastSync.ran_at);
document.getElementById("footInfo").textContent = footBits.join(" · ");
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
