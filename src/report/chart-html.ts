// Dashboard HTML — modern-minimal, sidebar-navigated, dark/light themes.
// Three views: Today, Week, Month. View state in the URL hash. Theme in localStorage
// (respects prefers-color-scheme on first visit).

import type { DashboardData } from "./chart-data.js";

export function renderDashboardHtml(data: DashboardData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>desk-time</title>
<script>
  // Apply theme before first paint to avoid flash.
  (function() {
    var t = localStorage.getItem("dt.theme");
    if (!t || t === "system") { t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; }
    document.documentElement.setAttribute("data-theme", t);
  })();
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  :root {
    --radius: 8px;
    --radius-sm: 5px;
    --font: -apple-system, "Segoe UI", system-ui, sans-serif;
    --mono: ui-monospace, "SF Mono", Consolas, monospace;
    --transition: 120ms cubic-bezier(0.2, 0, 0.1, 1);
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0e1015;
    --bg-elev: #171a22;
    --bg-hover: #1c2029;
    --border: #262c3b;
    --border-strong: #3a4358;
    --fg: #e8ecf1;
    --fg-muted: #7d8592;
    --fg-subtle: #4b5568;
    --accent: #60a5fa;
    --accent-fg: #dbeafe;
    --pos: #4ade80;
    --pos-bg: #1b3a2a;
    --pos-border: #1f4a35;
    --neg: #f87171;
    --neg-bg: #2a0e10;
    --warn: #fbbf24;
    --warn-bg: #241a08;
    --grid: rgba(255,255,255,0.04);
    --shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  :root[data-theme="light"] {
    color-scheme: light;
    --bg: #f7f7f8;
    --bg-elev: #ffffff;
    --bg-hover: #f4f4f5;
    --border: #e4e4e7;
    --border-strong: #d4d4d8;
    --fg: #18181b;
    --fg-muted: #52525b;
    --fg-subtle: #a1a1aa;
    --accent: #2563eb;
    --accent-fg: #1e40af;
    --pos: #16a34a;
    --pos-bg: #dcfce7;
    --pos-border: #bbf7d0;
    --neg: #dc2626;
    --neg-bg: #fee2e2;
    --warn: #ca8a04;
    --warn-bg: #fef9c3;
    --grid: rgba(0,0,0,0.04);
    --shadow: 0 4px 12px rgba(0,0,0,0.06);
  }

  /* ─────── Global reset — kill all browser defaults ─────── */
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    font: 14px/1.5 var(--font); margin: 0; padding: 0;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
  }
  b { font-weight: 600; }
  a { color: inherit; text-decoration: none; }

  /* All form controls inherit typography; strip OS chrome */
  button, input, select, textarea {
    font: inherit; color: inherit; margin: 0;
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    background: transparent; border: 0; outline: 0; border-radius: 0;
    box-shadow: none;
  }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; }
  input, select, textarea { min-width: 0; }
  textarea { resize: vertical; }
  /* Hide the OS number-input spinners */
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  /* Date/time picker indicator — recolored per theme */
  input[type=date]::-webkit-calendar-picker-indicator,
  input[type=time]::-webkit-calendar-picker-indicator {
    filter: invert(0.5); opacity: 0.6; cursor: pointer; padding: 2px; transition: var(--transition);
  }
  input[type=date]:hover::-webkit-calendar-picker-indicator,
  input[type=time]:hover::-webkit-calendar-picker-indicator { opacity: 1; }
  :root[data-theme="dark"] input[type=date]::-webkit-calendar-picker-indicator,
  :root[data-theme="dark"] input[type=time]::-webkit-calendar-picker-indicator { filter: invert(1) brightness(0.85); }
  /* Placeholder */
  ::placeholder { color: var(--fg-subtle); opacity: 1; }
  /* Selection */
  ::selection { background: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--fg); }
  /* Visible-only focus ring, themed */
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: var(--radius-sm); }
  button:focus-visible, .btn:focus-visible, .nav-item:focus-visible { outline-offset: 2px; }
  /* Details marker (Chrome, Firefox, Safari) */
  details > summary { list-style: none; }
  details > summary::-webkit-details-marker { display: none; }
  details > summary::marker { display: none; content: ""; }

  /* Custom scrollbars — WebKit + Firefox */
  * { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; border: 2px solid var(--bg); }
  ::-webkit-scrollbar-thumb:hover { background: var(--fg-subtle); }
  ::-webkit-scrollbar-corner { background: transparent; }

  /* Utility classes */
  .muted { color: var(--fg-muted); }
  .subtle { color: var(--fg-subtle); }
  [hidden] { display: none !important; }

  /* App layout — sidebar + content */
  .app { display: grid; grid-template-columns: 220px 1fr; grid-template-rows: 56px 1fr; grid-template-areas: "brand topbar" "sidebar content"; min-height: 100vh; }
  .brand { grid-area: brand; padding: 0 20px; display: flex; align-items: center; font-weight: 600; font-size: 16px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); letter-spacing: -0.01em; }
  .topbar { grid-area: topbar; padding: 0 20px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; border-bottom: 1px solid var(--border); }
  .sidebar { grid-area: sidebar; padding: 16px 12px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
  .content { grid-area: content; padding: 24px; overflow-y: auto; max-width: 960px; }

  /* Sidebar nav */
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: var(--radius-sm);
    color: var(--fg-muted); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: var(--transition);
  }
  .nav-item:hover { background: var(--bg-hover); color: var(--fg); }
  .nav-item.active { background: var(--bg-hover); color: var(--fg); }
  .nav-item .ico { width: 16px; text-align: center; opacity: 0.85; }

  /* Topbar buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    height: 32px; padding: 0 12px;
    background: var(--bg-elev); color: var(--fg); border: 1px solid var(--border);
    border-radius: var(--radius-sm); font-size: 12px; font-weight: 500;
    transition: var(--transition); white-space: nowrap; user-select: none;
  }
  .btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--border-strong); }
  .btn:active:not(:disabled) { transform: translateY(0.5px); }
  .btn:disabled { opacity: 0.45; }
  .btn.primary { background: var(--accent); color: var(--bg-elev); border-color: var(--accent); }
  .btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 88%, black); border-color: color-mix(in srgb, var(--accent) 88%, black); }
  :root[data-theme="light"] .btn.primary { color: #fff; }
  .btn.icon { width: 32px; padding: 0; font-size: 14px; }
  .btn.ghost { background: transparent; border-color: transparent; color: var(--fg-muted); }
  .btn.ghost:hover:not(:disabled) { background: var(--bg-hover); border-color: transparent; color: var(--fg); }
  .btn.sm { height: 26px; padding: 0 10px; font-size: 12px; }

  .user-chip { display: flex; align-items: center; gap: 8px; padding: 0 8px; color: var(--fg-muted); font-size: 12px; }

  /* Views */
  .view { display: none; }
  .view.active { display: block; }
  .view-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .view-title { display: flex; align-items: baseline; gap: 10px; }
  .view-title h1 { font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
  .view-title .sub { color: var(--fg-muted); font-size: 13px; font-variant-numeric: tabular-nums; }

  /* Cards */
  .card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; margin-bottom: 16px; }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .card-head h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); margin: 0; font-weight: 600; }
  .card-sub { color: var(--fg-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .card-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }

  /* ─────── Hero (Today / Week / Month top band) ─────── */
  .hero { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px 24px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; }
  .hero-left { min-width: 0; }
  .hero-pill { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid transparent; }
  .hero-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .hero-pill.working { background: var(--pos-bg); color: var(--pos); border-color: var(--pos-border); }
  .hero-pill.working .dot { animation: livepulse 1.4s ease-in-out infinite; }
  .hero-pill.break { background: var(--warn-bg); color: var(--warn); border-color: var(--warn); }
  .hero-pill.done { background: var(--pos-bg); color: var(--pos); border-color: var(--pos-border); }
  .hero-pill.idle { background: var(--bg); color: var(--fg-muted); border-color: var(--border); }
  .hero-pill.off { background: var(--bg); color: var(--fg-muted); border-color: var(--border); }
  @keyframes livepulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
  .hero-line { font-size: 22px; font-weight: 600; margin-top: 10px; letter-spacing: -0.015em; line-height: 1.25; font-variant-numeric: tabular-nums; color: var(--fg); }
  .hero-line b { font-weight: 700; }
  .hero-line .accent { color: var(--accent); }
  .hero-line .pos { color: var(--pos); }
  .hero-line .neg { color: var(--neg); }
  .hero-line .warn { color: var(--warn); }
  .hero-sub { color: var(--fg-muted); font-size: 12px; margin-top: 8px; font-variant-numeric: tabular-nums; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .hero-sub b { color: var(--fg); font-weight: 600; }

  /* Ring gauge (session cap) */
  .ring { position: relative; width: 108px; height: 108px; flex-shrink: 0; }
  .ring svg { transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 8; }
  .ring .track { stroke: var(--border); }
  .ring .fill { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 400ms cubic-bezier(0.2, 0, 0.1, 1), stroke 200ms; }
  .ring.warn .fill { stroke: var(--warn); }
  .ring.crit .fill { stroke: var(--neg); animation: pulse 1.4s ease-in-out infinite; }
  .ring-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .ring-inner .n { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .ring-inner .l { font-size: 9px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-top: 2px; }

  /* Progress bar (day/week/month completion) */
  .pbar { position: relative; height: 6px; background: var(--border); border-radius: 999px; overflow: hidden; margin-top: 14px; }
  .pbar .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 999px; transition: width 400ms cubic-bezier(0.2, 0, 0.1, 1); }
  .pbar.pos .fill { background: var(--pos); }
  .pbar.warn .fill { background: var(--warn); }
  .pbar.neg .fill { background: var(--neg); }
  .pbar-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-top: 6px; font-variant-numeric: tabular-nums; }

  @media (max-width: 720px) {
    .hero { grid-template-columns: 1fr; text-align: left; padding: 18px 18px; }
    .hero-line { font-size: 18px; }
    .ring { width: 88px; height: 88px; align-self: flex-start; }
  }

  /* Chart tab strip */
  .tabs { display: inline-flex; gap: 2px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px; }
  .tabs button { height: 24px; padding: 0 12px; font-size: 11px; font-weight: 500; color: var(--fg-muted); border-radius: 4px; transition: var(--transition); background: transparent; }
  .tabs button:hover { color: var(--fg); }
  .tabs button.active { background: var(--bg-elev); color: var(--fg); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

  /* Toggle chip */
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; font-size: 11px; font-weight: 500; color: var(--fg-muted); background: var(--bg); border: 1px solid var(--border); border-radius: 999px; transition: var(--transition); user-select: none; }
  .chip:hover { border-color: var(--border-strong); color: var(--fg); }
  .chip.active { background: color-mix(in srgb, var(--accent) 15%, var(--bg)); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }

  /* Alert */
  .alert { border-radius: var(--radius); padding: 12px 16px; margin-bottom: 14px; font-size: 13px; display: flex; align-items: center; gap: 10px; border: 1px solid transparent; }
  .alert.warn { background: var(--warn-bg); color: var(--warn); border-color: var(--warn); }
  .alert.crit { background: var(--neg-bg); color: var(--neg); border-color: var(--neg); animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }

  /* Nav pills (prev/next/dropdown inside cards) */
  .nav { display: flex; align-items: center; gap: 4px; font-size: 12px; }
  .nav button, .nav select, .nav input {
    background: var(--bg); color: var(--fg); border: 1px solid var(--border);
    height: 28px; border-radius: var(--radius-sm); padding: 0 10px;
    transition: var(--transition);
  }
  .nav button { width: 28px; padding: 0; line-height: 1; color: var(--fg-muted); display: inline-flex; align-items: center; justify-content: center; }
  .nav button:hover:not(:disabled), .nav select:hover, .nav input:hover { border-color: var(--border-strong); color: var(--fg); }
  .nav select:focus-visible, .nav input:focus-visible { border-color: var(--accent); outline: 0; }
  .nav button:disabled { opacity: 0.35; }
  .nav .today-btn { padding: 0 12px; color: var(--fg-muted); width: auto; background: transparent; border-color: transparent; }
  .nav .today-btn:hover:not(:disabled) { color: var(--fg); border-color: var(--border); background: var(--bg-hover); }
  /* Themed dropdown arrow — CSS mask so it inherits currentColor */
  .nav select, .fb-row select {
    padding-right: 26px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'><path fill='%237d8592' d='M0 0l5 6 5-6z'/></svg>");
    background-repeat: no-repeat; background-position: right 9px center; background-size: 9px;
  }
  :root[data-theme="light"] .nav select, :root[data-theme="light"] .fb-row select {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'><path fill='%2352525b' d='M0 0l5 6 5-6z'/></svg>");
  }

  /* Summary line inside a card */
  .summary { color: var(--fg); font-size: 12px; margin: 8px 0 14px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
  .summary b { font-variant-numeric: tabular-nums; font-weight: 600; }
  .summary .pos { color: var(--pos); }
  .summary .neg { color: var(--neg); }
  .summary .sep { color: var(--fg-subtle); }
  .summary .muted { color: var(--fg-muted); }
  .leave-line { color: var(--fg-muted); font-size: 11px; margin: -6px 0 12px; }
  .leave-line b { color: var(--fg); }
  .leave-line .comp { color: var(--pos); }
  .leave-line .partial { color: var(--warn); }
  .leave-line .partial b { color: var(--warn); }

  /* Charts */
  .cwrap { position: relative; height: 220px; margin-top: 4px; }
  .cwrap.clickable canvas { cursor: pointer; }
  .back-link { color: var(--fg-muted); font-size: 12px; margin-top: 10px; cursor: pointer; background: none; border: 0; padding: 0; }
  .back-link:hover { color: var(--fg); }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  th { color: var(--fg-muted); font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  tr:last-child td { border-bottom: 0; }
  tr.open td { color: var(--warn); }
  tr.highlight td { background: var(--bg-hover); }
  th:first-child, td:first-child { padding-left: 0; color: var(--fg-subtle); width: 30px; }

  /* Timeline */
  .timeline-wrap { margin: 12px 0 4px; }
  .timeline-axis { position: relative; height: 14px; color: var(--fg-subtle); font-size: 10px; font-variant-numeric: tabular-nums; }
  .timeline-axis span { position: absolute; transform: translateX(-50%); }
  .timeline { position: relative; height: 24px; background: var(--bg); border-radius: var(--radius-sm); border: 1px solid var(--border); overflow: hidden; }
  .timeline-bar { position: absolute; top: 0; bottom: 0; min-width: 2px; background: var(--accent); opacity: 0.85; border-right: 1px solid var(--bg-elev); transition: outline var(--transition); }
  .timeline-bar.open { background: var(--warn); }
  .timeline-bar.break { background: color-mix(in srgb, var(--fg-muted) 30%, transparent); border: 0; }
  .timeline-bar.highlight { outline: 2px solid var(--fg); outline-offset: -1px; z-index: 2; opacity: 1; }
  .timeline-now { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--neg); box-shadow: 0 0 4px color-mix(in srgb, var(--neg) 60%, transparent); }
  .timeline-legend { display: flex; gap: 14px; margin-top: 8px; color: var(--fg-muted); font-size: 11px; align-items: center; }
  .timeline-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin-right: 4px; }
  .timeline-legend i.tl-work { background: var(--accent); }
  .timeline-legend i.tl-open { background: var(--warn); }
  .timeline-legend i.tl-break { background: color-mix(in srgb, var(--fg-muted) 30%, transparent); }

  /* Heatmap */
  .heatmap { display: grid; grid-template-columns: 36px repeat(7, 1fr); gap: 4px; margin-top: 4px; }
  .heatmap .dow-label, .heatmap .week-label { color: var(--fg-subtle); font-size: 10px; text-align: center; padding: 2px 0; font-variant-numeric: tabular-nums; }
  .heatmap .dow-label { align-self: end; }
  .heatmap .cell { aspect-ratio: 1; border-radius: 3px; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; cursor: pointer; transition: transform 80ms; }
  .heatmap .cell:hover { transform: scale(1.15); outline: 1px solid var(--border-strong); }
  .heatmap .cell.outside { background: transparent; border-color: transparent; cursor: default; color: transparent; }
  .heatmap .cell.outside:hover { transform: none; outline: 0; }
  .heatmap .cell.today { outline: 2px solid var(--warn); }
  .heatmap-legend { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: var(--fg-muted); font-size: 11px; }
  .heatmap-legend .swatches { display: flex; gap: 3px; }
  .heatmap-legend .swatches i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; border: 1px solid var(--border); }

  /* Collapsible forms (leave, punch) */
  .form-block { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; }
  .form-block summary { display: inline-flex; align-items: center; gap: 6px; color: var(--fg); font-size: 12px; font-weight: 500; padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; user-select: none; transition: var(--transition); }
  .form-block summary::before { content: "+"; color: var(--fg-muted); font-weight: 400; font-size: 14px; line-height: 1; }
  .form-block summary:hover { border-color: var(--border-strong); background: var(--bg-hover); }
  .form-block[open] summary::before { content: "−"; }
  .fb-body { margin-top: 12px; }
  .fb-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; }
  .fb-row label { color: var(--fg-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .fb-row input, .fb-row select { background: var(--bg); color: var(--fg); border: 1px solid var(--border); height: 30px; padding: 0 10px; border-radius: var(--radius-sm); transition: var(--transition); }
  .fb-row input:hover, .fb-row select:hover { border-color: var(--border-strong); }
  .fb-row input:focus-visible, .fb-row select:focus-visible { border-color: var(--accent); outline: 0; }
  .fb-row input[type=text] { flex: 1; min-width: 140px; }
  .fb-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .fb-hint { color: var(--fg-muted); font-size: 11px; margin-top: 6px; }

  /* Toast stack */
  .toast-stack { position: fixed; top: 72px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
  .toast { background: var(--bg-elev); color: var(--fg); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 13px; min-width: 220px; max-width: 380px; box-shadow: var(--shadow); animation: toast-in 180ms ease-out; pointer-events: auto; }
  .toast.pos { border-color: var(--pos); color: var(--pos); }
  .toast.err { border-color: var(--neg); color: var(--neg); }
  .toast.fading { opacity: 0; transition: opacity 400ms; }
  @keyframes toast-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }

  /* Footer */
  .foot { color: var(--fg-subtle); font-size: 11px; margin-top: 24px; text-align: right; }

  /* Mobile — collapse sidebar to top row */
  @media (max-width: 720px) {
    .app { grid-template-columns: 1fr; grid-template-rows: 56px auto 1fr; grid-template-areas: "brand" "topbar" "content"; }
    .sidebar { display: none; }
    .content { padding: 16px; }
  }
</style>
</head>
<body>
<div class="app">
  <div class="brand">desk-time</div>
  <div class="topbar">
    <button id="refreshNow" class="btn ghost sm" title="Fetch current data (no sync)">↻ Refresh</button>
    <button id="syncNow" class="btn primary sm" title="Trigger ATS sync + fetch">Sync now</button>
    <button id="themeToggle" class="btn icon sm" title="Toggle theme" aria-label="Toggle theme">🌙</button>
    <div class="user-chip">${escapeHtml(data.userEmail)}</div>
    <button id="logoutBtn" class="btn ghost sm" title="Log out">Log out</button>
  </div>
  <aside class="sidebar">
    <a class="nav-item active" data-view="today"><span class="ico">◐</span> Today</a>
    <a class="nav-item" data-view="week"><span class="ico">▤</span> Week</a>
    <a class="nav-item" data-view="month"><span class="ico">▦</span> Month</a>
  </aside>
  <main class="content">
    <div class="toast-stack" id="toasts"></div>

    <!-- ─────────── Today ─────────── -->
    <section class="view active" data-view="today">
      <div class="view-head">
        <div class="view-title"><h1>Today</h1><span class="sub" id="todayStamp"></span></div>
      </div>

      <div id="alert" class="alert" hidden></div>

      <section class="hero" id="hero">
        <div class="hero-left">
          <span class="hero-pill" id="heroPill"><span class="dot"></span><span id="heroPillLabel">—</span></span>
          <div class="hero-line" id="heroLine">—</div>
          <div class="hero-sub" id="heroSub"></div>
          <div class="pbar" id="heroPbar" hidden><div class="fill"></div></div>
          <div class="pbar-labels" id="heroPbarLabels" hidden></div>
        </div>
        <div class="ring" id="heroRing" hidden>
          <svg width="108" height="108" viewBox="0 0 108 108">
            <circle class="track" cx="54" cy="54" r="48"></circle>
            <circle class="fill" cx="54" cy="54" r="48" stroke-dasharray="301.59" stroke-dashoffset="301.59"></circle>
          </svg>
          <div class="ring-inner"><div class="n" id="ringN">—</div><div class="l" id="ringL">Session</div></div>
        </div>
      </section>

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
        <div class="timeline-wrap">
          <div class="timeline-axis">
            <span style="left:0%">0</span><span style="left:12.5%">3</span><span style="left:25%">6</span>
            <span style="left:37.5%">9</span><span style="left:50%">12</span><span style="left:62.5%">15</span>
            <span style="left:75%">18</span><span style="left:87.5%">21</span><span style="left:100%">24</span>
          </div>
          <div class="timeline" id="timeline"></div>
          <div class="timeline-legend">
            <span><i class="tl-work"></i>work</span>
            <span><i class="tl-open"></i>in progress</span>
            <span><i class="tl-break"></i>break</span>
          </div>
        </div>
        <details class="form-block">
          <summary>Missed a punch? Add it manually</summary>
          <div class="fb-body">
            <div class="fb-row">
              <label>Date</label><input type="date" id="pfDate" />
              <label>Time 1</label><input type="time" id="pfT1" step="60" />
              <label>Time 2</label><input type="time" id="pfT2" step="60" placeholder="optional" />
            </div>
            <div class="fb-actions">
              <button id="pfSave" class="btn primary sm">Save punch</button>
              <span class="fb-hint" id="pfMsg"></span>
            </div>
            <div class="fb-hint">Order doesn't matter — earlier time becomes in, later becomes out. Leave Time 2 blank for an open session.</div>
          </div>
        </details>
      </div>
    </section>

    <!-- ─────────── Week ─────────── -->
    <section class="view" data-view="week">
      <div class="view-head">
        <div class="view-title"><h1>Week</h1><span class="sub" id="wLabel"></span></div>
        <div class="nav">
          <button id="wPrev" aria-label="Previous week">‹</button>
          <button id="wNext" aria-label="Next week">›</button>
          <button class="today-btn" id="wToday">This week</button>
        </div>
      </div>

      <section class="hero">
        <div class="hero-left">
          <span class="hero-pill idle" id="wHeroPill"><span class="dot"></span><span id="wHeroPillLabel">—</span></span>
          <div class="hero-line" id="wHeroLine">—</div>
          <div class="hero-sub" id="wHeroSub"></div>
          <div class="pbar" id="wPbar"><div class="fill"></div></div>
          <div class="pbar-labels" id="wPbarLabels"></div>
        </div>
        <div class="ring" id="wRing">
          <svg width="108" height="108" viewBox="0 0 108 108">
            <circle class="track" cx="54" cy="54" r="48"></circle>
            <circle class="fill" cx="54" cy="54" r="48" stroke-dasharray="301.59" stroke-dashoffset="301.59"></circle>
          </svg>
          <div class="ring-inner"><div class="n" id="wRingN">—</div><div class="l">of target</div></div>
        </div>
      </section>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><h2>Daily breakdown</h2></div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="chip" id="wCompare" title="Show last week as ghost bars">vs last week</button>
            <button class="chip active" id="wShowBreak" title="Show unpaid break time on top of work">break</button>
          </div>
        </div>
        <div class="cwrap clickable" style="height:260px"><canvas id="weekChart"></canvas></div>
        <div class="fb-hint" style="text-align:center;margin-top:6px">Click a day to view its sessions · hover for details</div>
      </div>
    </section>

    <!-- ─────────── Month ─────────── -->
    <section class="view" data-view="month">
      <div class="view-head">
        <div class="view-title"><h1>Month</h1><span class="sub" id="mLabel"></span></div>
        <div class="nav">
          <select id="mSelect"></select>
          <button class="today-btn" id="mToday">This month</button>
        </div>
      </div>

      <section class="hero">
        <div class="hero-left">
          <span class="hero-pill idle" id="mHeroPill"><span class="dot"></span><span id="mHeroPillLabel">—</span></span>
          <div class="hero-line" id="mHeroLine">—</div>
          <div class="hero-sub" id="mHeroSub"></div>
          <div class="pbar" id="mPbar"><div class="fill"></div></div>
          <div class="pbar-labels" id="mPbarLabels"></div>
        </div>
        <div class="ring" id="mRing">
          <svg width="108" height="108" viewBox="0 0 108 108">
            <circle class="track" cx="54" cy="54" r="48"></circle>
            <circle class="fill" cx="54" cy="54" r="48" stroke-dasharray="301.59" stroke-dashoffset="301.59"></circle>
          </svg>
          <div class="ring-inner"><div class="n" id="mRingN">—</div><div class="l">of month</div></div>
        </div>
      </section>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><h2>Trend</h2><span class="card-sub" id="mTrendSub"></span></div>
          <div class="tabs" id="mTabs">
            <button data-tab="cumulative" class="active">Cumulative</button>
            <button data-tab="weeks">Weeks</button>
            <button data-tab="days">Days</button>
          </div>
        </div>
        <div class="leave-line" id="mLeaves"></div>
        <div id="monthMain">
          <div class="cwrap clickable" style="height:280px"><canvas id="monthChart"></canvas></div>
          <div class="fb-hint" id="mChartHint" style="text-align:center;margin-top:6px">Hover to see cumulative gap vs target</div>
        </div>
        <div id="monthDrill" hidden>
          <div class="summary" id="drillSummary"></div>
          <div class="cwrap clickable"><canvas id="drillChart"></canvas></div>
          <button class="back-link" id="drillBack">‹ back to month view</button>
        </div>
        <details class="form-block">
          <summary>Add / remove a leave</summary>
          <div class="fb-body">
            <div class="fb-row">
              <label>Date</label><input type="date" id="lfDate" />
              <label>Type</label>
              <select id="lfType">
                <option value="casual">casual</option>
                <option value="medical" selected>medical</option>
                <option value="festival">festival</option>
                <option value="planned">planned</option>
                <option value="holiday">holiday</option>
                <option value="other">other</option>
              </select>
              <label>Reason</label><input type="text" id="lfReason" placeholder="optional" />
            </div>
            <div class="fb-actions">
              <button id="lfSaveAdd" class="btn primary sm">Save leave</button>
              <button id="lfSaveRemove" class="btn sm">Remove leave</button>
              <span class="fb-hint" id="lfMsg"></span>
            </div>
          </div>
        </details>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><h2>Heatmap</h2><span class="card-sub" id="hmLabel"></span></div>
          <div class="nav">
            <select id="hmSelect"></select>
            <button class="today-btn" id="hmToday">This month</button>
          </div>
        </div>
        <div class="heatmap" id="heatmap"></div>
        <div class="heatmap-legend">
          <span>less</span>
          <div class="swatches" id="hmSwatches"></div>
          <span>more</span>
          <span class="muted" style="margin-left:auto">click a cell to view its sessions</span>
        </div>
      </div>
    </section>

    <div class="foot" id="foot"><span id="footInfo"></span></div>
  </main>
</div>

<script>
let D = ${JSON.stringify(data)};

async function callApi(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.json().catch(() => ({ ok: false, error: "invalid JSON" }));
}

function toast(msg, kind = "info", ttlMs = 2500) {
  const stack = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.classList.add("fading"); setTimeout(() => el.remove(), 420); }, ttlMs);
}

async function refresh() {
  try {
    const res = await fetch("/api/dashboard-data", { headers: { "accept": "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    D = await res.json();
    renderAll();
  } catch (err) { toast("Refresh failed: " + err.message, "err", 3500); }
}
function renderAll() { renderHero(); renderAlert(); renderWeek(); renderMonth(); renderSessions(); renderHeatmap(); renderFooter(); }

/* Theme toggle — the pre-paint script at the top already set data-theme.
   Here we only wire the icon + click handler; charts pick up colors via css() when rendered.
   Toggling AFTER initial render re-invokes renderWeek/renderMonth so Chart.js re-reads the vars. */
function currentTheme() { return document.documentElement.getAttribute("data-theme") || "dark"; }
function updateThemeIcon() { document.getElementById("themeToggle").textContent = currentTheme() === "light" ? "☀" : "🌙"; }
updateThemeIcon();
document.getElementById("themeToggle").onclick = () => {
  const next = currentTheme() === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("dt.theme", next);
  updateThemeIcon();
  // Charts baked into canvases don't auto-restyle — force a re-render so they re-read CSS vars.
  renderWeek(); renderMonth(); renderHeatmap();
};

/* View routing */
function activateView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.getAttribute("data-view") === name));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.getAttribute("data-view") === name));
  location.hash = name;
}
document.querySelectorAll(".nav-item").forEach((n) => {
  n.addEventListener("click", (e) => { e.preventDefault(); activateView(n.getAttribute("data-view")); });
});
window.addEventListener("hashchange", () => activateView((location.hash || "#today").slice(1)));
if (location.hash) activateView(location.hash.slice(1));

/* Utility formatters */
function fmtHours(h) { const s = h < 0 ? "-" : ""; const a = Math.abs(h); const hh = Math.floor(a); const mm = Math.round((a - hh) * 60); return s + hh + "h " + String(mm).padStart(2, "0") + "m"; }
function fmtHM(m) { return fmtHours(m / 60); }
function fmtSigned(h) { return (h >= 0 ? "+" : "") + fmtHours(h); }
function clock(iso) { return iso ? iso.slice(11, 16) : "—"; }
function liveRunningMin() { return D.openPunchInMs ? Math.max(0, Math.round((Date.now() - D.openPunchInMs) / 60000)) : 0; }
function liveTodayHours() { return +(D.closedTodayHours + liveRunningMin() / 60).toFixed(2); }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

const dowFull = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const dowShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function niceDate(iso) { const d = new Date(iso+"T00:00:00"); return dowShort[d.getDay()]+", "+monShort[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
function niceDateFull(iso) { const d = new Date(iso+"T00:00:00"); return dowFull[d.getDay()]+", "+monShort[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }

document.getElementById("todayStamp").textContent = niceDate(D.today);

/* ─── Ring gauge helpers ─── */
const RING_C = 301.59; // 2 * PI * 48
function setRing(elId, pct, tone) {
  const ring = document.getElementById(elId);
  if (!ring) return;
  const clamped = Math.max(0, Math.min(1, pct));
  const fill = ring.querySelector(".fill");
  fill.setAttribute("stroke-dashoffset", String(RING_C * (1 - clamped)));
  ring.classList.remove("warn", "crit");
  if (tone) ring.classList.add(tone);
}
function setPbar(pbarId, labelsId, pct, tone, leftLabel, rightLabel) {
  const bar = document.getElementById(pbarId);
  const labels = document.getElementById(labelsId);
  if (!bar) return;
  const clamped = Math.max(0, Math.min(1, pct));
  bar.querySelector(".fill").style.width = (clamped * 100).toFixed(1) + "%";
  bar.classList.remove("pos", "warn", "neg");
  if (tone) bar.classList.add(tone);
  if (labels) {
    labels.innerHTML = '<span>'+leftLabel+'</span><span>'+rightLabel+'</span>';
    labels.hidden = false;
    bar.hidden = false;
  }
}

/* ─── Today hero ─── */
function renderHero() {
  document.getElementById("todayStamp").textContent = niceDate(D.today);
  const pill = document.getElementById("heroPill");
  const pillLabel = document.getElementById("heroPillLabel");
  const line = document.getElementById("heroLine");
  const sub = document.getElementById("heroSub");
  const ring = document.getElementById("heroRing");
  const pbar = document.getElementById("heroPbar");
  const pbarLabels = document.getElementById("heroPbarLabels");

  const running = liveRunningMin();
  const totalLiveMin = D.closedTodayHours * 60 + running;
  const targetMin = D.todayTargetHours * 60;
  const remaining = Math.max(0, targetMin - totalLiveMin);
  const bal = D.monthDaysBalance;

  pill.className = "hero-pill";

  if (D.todayNonWorking) {
    pill.classList.add("off");
    pillLabel.textContent = D.todayIsSunday ? "Off — Sunday" : "Off — Leave day";
    if (D.isPunchedIn || totalLiveMin > 0) {
      line.innerHTML = 'Bonus <span class="pos"><b>'+fmtHM(totalLiveMin)+'</b></span> today';
      sub.innerHTML = D.isPunchedIn ? '<span>Session <b>'+fmtHM(running)+'</b></span>' : '<span>No active session</span>';
    } else {
      line.innerHTML = 'Enjoy your day';
      sub.innerHTML = '<span>'+(D.todayIsSunday ? 'Weekend' : 'On leave')+' — no target</span>';
    }
    ring.hidden = true;
    pbar.hidden = true; pbarLabels.hidden = true;
  } else if (D.isPunchedIn) {
    pill.classList.add("working");
    pillLabel.textContent = "Working";
    const etaTxt = totalLiveMin >= targetMin
      ? '<span class="pos">Target met</span> — <b>'+fmtHM(totalLiveMin - targetMin)+'</b> banked'
      : (() => { const e = new Date(D.etaEpochMs); const eS = String(e.getHours()).padStart(2,"0")+':'+String(e.getMinutes()).padStart(2,"0"); return 'Finish by <span class="accent"><b>'+eS+'</b></span> — <b>'+fmtHM(remaining)+'</b> to go'; })();
    line.innerHTML = etaTxt;
    sub.innerHTML =
      '<span>Session <b>'+fmtHM(running)+'</b></span>'+
      '<span>Today <b>'+fmtHM(totalLiveMin)+'</b> of '+fmtHours(D.todayTargetHours)+'</span>'+
      (bal !== 0 ? '<span>Month <b class="'+(bal>0?"pos":"neg")+'">'+(bal>0?"+":"")+bal+'d</b></span>' : '');
    // Ring shows session progress toward cap
    ring.hidden = false;
    const capPct = running / D.sessionMaxMin;
    const capTone = running >= D.sessionMaxMin ? "crit" : running >= D.sessionAlertMin ? "warn" : "";
    setRing("heroRing", capPct, capTone);
    document.getElementById("ringN").textContent = fmtHM(running);
    document.getElementById("ringL").textContent = capTone === "crit" ? "OVER CAP" : "Session";
    // Progress bar toward today target
    const donePct = targetMin === 0 ? 0 : totalLiveMin / targetMin;
    const tone = donePct >= 1 ? "pos" : donePct >= 0.75 ? "" : "";
    setPbar("heroPbar", "heroPbarLabels", donePct, tone, fmtHM(totalLiveMin)+' worked', fmtHM(remaining)+' to go');
  } else if (totalLiveMin >= targetMin && totalLiveMin > 0) {
    pill.classList.add("done");
    pillLabel.textContent = "Done for today";
    const overMin = totalLiveMin - targetMin;
    line.innerHTML = '<span class="pos"><b>'+fmtHM(totalLiveMin)+'</b></span> today — <b>'+fmtHM(overMin)+'</b> banked';
    sub.innerHTML = '<span>Target <b>'+fmtHours(D.todayTargetHours)+'</b> met</span>'+
      (bal !== 0 ? '<span>Month <b class="'+(bal>0?"pos":"neg")+'">'+(bal>0?"+":"")+bal+'d</b></span>' : '');
    ring.hidden = true;
    setPbar("heroPbar", "heroPbarLabels", 1, "pos", fmtHM(totalLiveMin)+' worked', 'complete');
  } else if (totalLiveMin > 0) {
    pill.classList.add("break");
    pillLabel.textContent = "On break";
    const eta = new Date(D.etaEpochMs);
    const eS = String(eta.getHours()).padStart(2,"0")+':'+String(eta.getMinutes()).padStart(2,"0");
    line.innerHTML = '<b>'+fmtHM(remaining)+'</b> to go — resume to finish by <span class="accent"><b>'+eS+'</b></span>';
    sub.innerHTML =
      '<span>Today <b>'+fmtHM(totalLiveMin)+'</b> of '+fmtHours(D.todayTargetHours)+'</span>'+
      (bal !== 0 ? '<span>Month <b class="'+(bal>0?"pos":"neg")+'">'+(bal>0?"+":"")+bal+'d</b></span>' : '');
    ring.hidden = true;
    setPbar("heroPbar", "heroPbarLabels", totalLiveMin / targetMin, "", fmtHM(totalLiveMin)+' worked', fmtHM(remaining)+' to go');
  } else {
    pill.classList.add("idle");
    pillLabel.textContent = "Not started";
    line.innerHTML = 'Punch in to finish by <span class="accent"><b>'+(() => { const e = new Date(Date.now() + targetMin * 60000); return String(e.getHours()).padStart(2,"0")+':'+String(e.getMinutes()).padStart(2,"0"); })()+'</b></span>';
    sub.innerHTML = '<span>Target <b>'+fmtHours(D.todayTargetHours)+'</b></span>'+
      (bal !== 0 ? '<span>Month <b class="'+(bal>0?"pos":"neg")+'">'+(bal>0?"+":"")+bal+'d</b></span>' : '');
    ring.hidden = true;
    pbar.hidden = true; pbarLabels.hidden = true;
  }
}

function renderAlert() {
  const el = document.getElementById("alert");
  if (!D.isPunchedIn) { el.hidden = true; return; }
  const m = liveRunningMin();
  if (m >= D.sessionMaxMin) { el.hidden = false; el.className = "alert crit"; el.innerHTML = "Session <b>"+fmtHM(m)+"</b> — over "+fmtHM(D.sessionMaxMin)+" cap. Punch out now."; }
  else if (m >= D.sessionAlertMin) { el.hidden = false; el.className = "alert warn"; el.innerHTML = "Session <b>"+fmtHM(m)+"</b> — approaching "+fmtHM(D.sessionMaxMin)+" cap."; }
  else { el.hidden = true; }
}

/* ─── Sync/Refresh buttons ─── */
async function runButton(btn, doingLabel, endpoint, successMsg) {
  const original = btn.textContent; btn.disabled = true; btn.textContent = doingLabel;
  try {
    const r = await callApi(endpoint, null);
    if (r.ok) { const msg = successMsg + (r.sessions !== undefined ? " · " + r.sessions + " session" + (r.sessions === 1 ? "" : "s") : ""); toast(msg, "pos"); await refresh(); btn.textContent = original; btn.disabled = false; }
    else { toast("Failed: " + (r.error || "unknown"), "err", 3500); btn.textContent = original; btn.disabled = false; }
  } catch (err) { toast("Failed: " + err.message, "err", 3500); btn.textContent = original; btn.disabled = false; }
}
document.getElementById("syncNow").onclick = () => runButton(document.getElementById("syncNow"), "Syncing…", "/api/sync?force=1", "✓ Synced");
document.getElementById("refreshNow").onclick = () => runButton(document.getElementById("refreshNow"), "Refreshing…", "/api/fetch", "✓ Refreshed");
document.getElementById("logoutBtn").onclick = () => fetch("/logout", { method: "POST" }).then(() => location.href = "/login");

/* ─── Week ─── */
let weekIdx = D.weeks.length - 1;
let weekChart;
let wCompareOn = false;
let wShowBreak = true;
function dayBreakHours(date) { const rows = D.sessions.byDate[date] || []; return computeBreakMin(rows) / 60; }
function renderWeek() {
  const w = D.weeks[weekIdx];
  const isCurrent = weekIdx === D.weeks.length - 1;
  document.getElementById("wLabel").textContent = monShort[+w.start.slice(5,7)-1]+" "+ +w.start.slice(8,10)+" – "+monShort[+w.end.slice(5,7)-1]+" "+ +w.end.slice(8,10)+", "+w.end.slice(0,4);
  document.getElementById("wPrev").disabled = weekIdx === 0;
  document.getElementById("wNext").disabled = isCurrent;
  document.getElementById("wToday").disabled = isCurrent;

  // Hero
  const bal = w.total - w.target;
  const balTone = bal >= 0 ? "pos" : "neg";
  const daysWorked = w.days.filter(d => d.hours > 0).length;
  const daysWithTarget = w.days.filter(d => d.targetHours > 0).length;
  const pillEl = document.getElementById("wHeroPill");
  const pillLabelEl = document.getElementById("wHeroPillLabel");
  pillEl.className = "hero-pill";
  if (isCurrent) {
    if (bal >= 0) { pillEl.classList.add("done"); pillLabelEl.textContent = "This week — ahead"; }
    else if (bal >= -5) { pillEl.classList.add("break"); pillLabelEl.textContent = "This week — behind"; }
    else { pillEl.classList.add("idle"); pillLabelEl.textContent = "This week"; }
  } else {
    if (bal >= 0) { pillEl.classList.add("done"); pillLabelEl.textContent = "Completed"; }
    else { pillEl.classList.add("idle"); pillLabelEl.textContent = "Below target"; }
  }
  const remaining = Math.max(0, w.target - w.total);
  const daysLeft = isCurrent ? w.days.filter(d => d.date > D.today && d.targetHours > 0).length + (D.todayTargetHours > 0 ? 1 : 0) : 0;
  const wLine = isCurrent
    ? (bal >= 0
      ? '<span class="pos"><b>'+fmtSigned(bal)+'</b></span> ahead of pace'
      : daysLeft > 0
        ? '<b>'+fmtHours(remaining)+'</b> in <b>'+daysLeft+'</b> day'+(daysLeft===1?'':'s')+' — <b>'+fmtHours(remaining/daysLeft)+'/day</b>'
        : '<span class="neg"><b>'+fmtSigned(bal)+'</b></span> — week ended below target')
    : '<b>'+fmtHours(w.total)+'</b> of <b>'+fmtHours(w.target)+'</b> — <span class="'+balTone+'"><b>'+fmtSigned(bal)+'</b></span>';
  document.getElementById("wHeroLine").innerHTML = wLine;
  document.getElementById("wHeroSub").innerHTML =
    '<span><b>'+daysWorked+'</b> of <b>'+daysWithTarget+'</b> working day'+(daysWithTarget===1?'':'s')+' logged</span>'+
    '<span>Avg <b>'+fmtHours(daysWorked > 0 ? w.total/daysWorked : 0)+'</b>/day</span>'+
    (isCurrent && daysLeft > 0 ? '<span><b>'+daysLeft+'</b> day'+(daysLeft===1?'':'s')+' left</span>' : '');
  const wPct = w.target > 0 ? w.total / w.target : 0;
  setRing("wRing", wPct, wPct >= 1 ? "" : ""); // ring uses accent by default
  document.getElementById("wRingN").textContent = Math.round(wPct * 100) + "%";
  setPbar("wPbar", "wPbarLabels", wPct, wPct >= 1 ? "pos" : "", fmtHours(w.total)+' worked', fmtHours(w.target)+' target');

  // Chart — stacked (work + break) with optional last-week ghost
  const accent = css("--accent"); const warn = css("--warn"); const sunColor = css("--fg-subtle"); const grid = css("--grid"); const tick = css("--fg-muted"); const partial = "#fb923c"; const breakClr = css("--fg-subtle");
  const workData = w.days.map(d => d.hours);
  const breakData = w.days.map(d => dayBreakHours(d.date));
  const targetData = w.days.map(d => d.targetHours);
  const barColors = w.days.map(d => d.date === D.today ? warn : d.isSunday ? sunColor : d.isPartial ? partial : accent);
  const datasets = [
    { label: "Worked", data: workData, backgroundColor: barColors, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, barPercentage: 0.68, stack: "curr", order: 2 },
  ];
  if (wShowBreak) {
    datasets.push({ label: "Break", data: breakData, backgroundColor: "rgba(125,133,146,0.35)", borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, barPercentage: 0.68, stack: "curr", order: 3 });
  }
  if (wCompareOn && weekIdx > 0) {
    const prev = D.weeks[weekIdx - 1];
    datasets.push({ label: "Last week", data: prev.days.map(d => d.hours), type: "bar", backgroundColor: "transparent", borderColor: tick, borderWidth: 1.5, borderDash: [4,3], borderSkipped: false, barPercentage: 0.68, stack: "prev", order: 1 });
  }
  datasets.push({ label: "Target", data: targetData, type: "line", borderColor: tick, borderDash: [3,3], pointRadius: 0, borderWidth: 1, order: 0 });

  const cfg = {
    type: "bar",
    data: { labels: w.days.map(d => d.label), datasets },
    options: {
      maintainAspectRatio: false, animation: { duration: 200 },
      interaction: { mode: "index", axis: "x", intersect: false },
      scales: {
        y: { stacked: true, beginAtZero: true, suggestedMax: 10, grid: { color: grid }, ticks: { color: tick, stepSize: 2, callback: (v) => v + "h" } },
        x: { stacked: true, grid: { display: false }, ticks: { color: tick } },
      },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: tick, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => niceDateFull(w.days[items[0].dataIndex].date),
            label: (c) => c.dataset.label + ": " + fmtHours(c.parsed.y),
            afterBody: (items) => sessionsTooltipLines(w.days[items[0].dataIndex].date),
          },
        },
      },
      onClick: (evt) => { const points = weekChart.getElementsAtEventForMode(evt, "nearest", { intersect: false }, true); if (points.length) jumpSessionsTo(w.days[points[0].index].date); },
    },
  };
  if (weekChart) { weekChart.destroy(); }
  weekChart = new Chart(document.getElementById("weekChart"), cfg);
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
  activateView("today");
  dPicker.value = date;
  renderSessions();
}

/* ─── Month ─── */
let monthChart, drillChart;
let mChartTab = localStorage.getItem("dt.mTab") || "cumulative";
const mSelect = document.getElementById("mSelect");
D.months.slice().reverse().forEach((m) => { const opt = document.createElement("option"); opt.value = m.key; opt.textContent = m.label; mSelect.appendChild(opt); });
mSelect.value = D.months[D.months.length - 1].key;
function currentMonth() { return D.months.find(m => m.key === mSelect.value) || D.months[D.months.length - 1]; }
function flattenMonthDays(m) {
  const out = [];
  for (const w of m.weeks) for (const d of w.days) out.push(d);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function renderMonth() {
  const m = currentMonth();
  const isCurrent = mSelect.value === D.months[D.months.length - 1].key;
  document.getElementById("mToday").disabled = isCurrent;
  document.getElementById("mLabel").textContent = m.label;

  // Hero
  const bal = m.daysBalance;
  const balTone = bal > 0 ? "pos" : bal < 0 ? "neg" : "";
  const bankMin = m.bankedMinutes;
  const bankTone = bankMin > 0 ? "pos" : bankMin < 0 ? "neg" : "";
  const pillEl = document.getElementById("mHeroPill");
  const pillLabelEl = document.getElementById("mHeroPillLabel");
  pillEl.className = "hero-pill";
  if (isCurrent) {
    if (bal > 0) { pillEl.classList.add("done"); pillLabelEl.textContent = "Ahead of pace"; }
    else if (bal < 0) { pillEl.classList.add("break"); pillLabelEl.textContent = "Behind pace"; }
    else { pillEl.classList.add("idle"); pillLabelEl.textContent = "On pace"; }
  } else {
    pillEl.classList.add(bal >= 0 ? "done" : "idle");
    pillLabelEl.textContent = bal >= 0 ? "Month completed" : "Missed target";
  }
  const paceStr = bal > 0 ? '<span class="pos"><b>'+bal+' day'+(bal===1?'':'s')+'</b></span> ahead' : bal < 0 ? '<span class="neg"><b>'+Math.abs(bal)+' day'+(bal===-1?'':'s')+'</b></span> behind' : '<b>on track</b>';
  const hoursStr = bankMin === 0 ? '' : bankMin > 0 ? ' — <span class="pos"><b>+'+fmtHM(bankMin)+'</b></span> banked' : ' — <span class="neg"><b>'+fmtHM(bankMin)+'</b></span> owed';
  document.getElementById("mHeroLine").innerHTML = paceStr + hoursStr;
  document.getElementById("mHeroSub").innerHTML =
    '<span><b>'+m.daysCompleted+'</b> of <b>'+m.workingDays+'</b> working days</span>'+
    '<span>Worked <b>'+fmtHours(m.worked)+'</b></span>'+
    (m.workingDaysLeftIncludingToday > 0 ? '<span><b>'+m.workingDaysLeftIncludingToday+'d</b> left</span>' : '');
  const donePct = m.workingDays > 0 ? m.daysCompleted / m.workingDays : 0;
  setRing("mRing", donePct, donePct >= 1 ? "" : "");
  document.getElementById("mRingN").textContent = Math.round(donePct * 100) + "%";
  setPbar("mPbar", "mPbarLabels", donePct, donePct >= 1 ? "pos" : "", m.daysCompleted+'d done', m.workingDays+'d total');

  // Leaves
  const leaveEl = document.getElementById("mLeaves");
  const any = m.excusedLeaves + m.unexcusedLeaves + m.sundaysWorked + m.preEmploymentDays + (m.partialDays || 0);
  if (any === 0) { leaveEl.textContent = ""; leaveEl.hidden = true; }
  else {
    leaveEl.hidden = false;
    const parts = [];
    if (m.preEmploymentDays > 0) parts.push('<span class="muted">Pre-employment: <b>'+m.preEmploymentDays+'d</b></span>');
    if (m.excusedLeaves > 0) { const typeParts = Object.entries(m.excusedByType).map(([t, dates]) => t+' <b>'+dates.length+'</b> <span class="muted">('+dates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", ")+')</span>'); parts.push('<span class="comp">Excused: '+typeParts.join(', ')+'</span>'); }
    if (m.partialDays > 0) { const dates = m.partialDates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", "); parts.push('<span class="partial">Partial: <b>'+m.partialDays+'</b> <span class="muted">('+dates+')</span></span>'); }
    if (m.unexcusedLeaves > 0) { const dates = m.unexcusedDates.map(d => monShort[+d.slice(5,7)-1]+" "+ +d.slice(8)).join(", "); parts.push('Missed: <b>'+m.unexcusedLeaves+'</b> <span class="muted">('+dates+')</span>'); }
    if (m.sundaysWorked > 0) parts.push('<span class="comp">Sundays worked: <b>'+m.sundaysWorked+'</b></span>');
    leaveEl.innerHTML = parts.join(' <span class="sep">·</span> ');
  }

  // Tab sync
  document.querySelectorAll("#mTabs button").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === mChartTab));
  const hint = document.getElementById("mChartHint");
  hint.textContent = mChartTab === "cumulative" ? "Hover to see cumulative gap vs target"
    : mChartTab === "weeks" ? "Click a week to drill into daily view"
    : "Each bar is one day · click to view sessions";

  // Chart render — dispatch by tab
  if (monthChart) { monthChart.destroy(); monthChart = null; }
  if (mChartTab === "cumulative") renderMonthCumulative(m);
  else if (mChartTab === "weeks") renderMonthWeeks(m);
  else renderMonthDays(m);

  document.getElementById("monthMain").hidden = false;
  document.getElementById("monthDrill").hidden = true;
}

function renderMonthCumulative(m) {
  const days = flattenMonthDays(m);
  const dailyTarget = D.todayTargetHours || 8; // full-day nominal target
  let cumWorked = 0, cumTarget = 0;
  const labels = []; const worked = []; const target = []; const isFuture = [];
  for (const d of days) {
    labels.push(+d.date.slice(8));
    if (d.date > D.today) { isFuture.push(true); worked.push(null); }
    else { cumWorked += d.hours; worked.push(+cumWorked.toFixed(2)); isFuture.push(false); }
    if (d.targetHours > 0) cumTarget += d.targetHours;
    target.push(+cumTarget.toFixed(2));
  }
  const accent = css("--accent"); const grid = css("--grid"); const tick = css("--fg-muted"); const targetLine = css("--fg-subtle");
  const accentFill = "color-mix(in srgb, " + accent + " 18%, transparent)";
  const yMax = Math.max(10, Math.ceil(Math.max(cumTarget, cumWorked) / 10) * 10 + 10);
  const cfg = {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Worked (cumulative)", data: worked, borderColor: accent, backgroundColor: accentFill, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: accent, tension: 0.15, fill: "origin", spanGaps: false },
        { label: "Target (cumulative)", data: target, borderColor: targetLine, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0 },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: "index", axis: "x", intersect: false },
      scales: {
        y: { beginAtZero: true, suggestedMax: yMax, grid: { color: grid }, ticks: { color: tick, callback: (v) => v + "h" } },
        x: { grid: { display: false }, ticks: { color: tick, autoSkip: true, maxTicksLimit: 12 } },
      },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: tick, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => { const idx = items[0].dataIndex; return niceDateFull(days[idx].date); },
            label: (c) => c.dataset.label + ": " + fmtHours(c.parsed.y),
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              if (isFuture[idx]) return ["", "future"];
              const gap = worked[idx] - target[idx];
              return ["", (gap >= 0 ? "▲ " : "▼ ") + fmtSigned(gap) + " vs target"];
            },
          },
        },
      },
    },
  };
  monthChart = new Chart(document.getElementById("monthChart"), cfg);
}

function renderMonthWeeks(m) {
  const accent = css("--accent"); const grid = css("--grid"); const tick = css("--fg-muted"); const targetLine = css("--fg-subtle");
  const yMax = Math.max(50, Math.ceil(m.weeks.reduce((mx, w) => Math.max(mx, w.hours, w.target), 0) / 10) * 10);
  const cfg = {
    type: "bar",
    data: { labels: m.weeks.map(w => w.label), datasets: [
      { label: "Worked", data: m.weeks.map(w => w.hours), backgroundColor: accent, borderRadius: 4, barPercentage: 0.68 },
      { label: "Target", data: m.weeks.map(w => w.target), type: "line", borderColor: targetLine, borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
    ]},
    options: {
      maintainAspectRatio: false, animation: { duration: 220 },
      interaction: { mode: "index", axis: "x", intersect: false },
      scales: { y: { beginAtZero: true, suggestedMax: yMax, grid: { color: grid }, ticks: { color: tick, stepSize: yMax > 40 ? 10 : 5, callback: (v) => v+"h" } }, x: { grid: { display: false }, ticks: { color: tick } } },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: tick, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => c.dataset.label+": "+fmtHours(c.parsed.y) } },
      },
      onClick: (evt) => { const points = monthChart.getElementsAtEventForMode(evt, "nearest", { intersect: false }, true); if (points.length) drillIntoWeek(m.weeks[points[0].index]); },
    },
  };
  monthChart = new Chart(document.getElementById("monthChart"), cfg);
}

function renderMonthDays(m) {
  const days = flattenMonthDays(m);
  const accent = css("--accent"); const warn = css("--warn"); const sunColor = css("--fg-subtle"); const grid = css("--grid"); const tick = css("--fg-muted"); const targetLine = css("--fg-subtle"); const partial = "#fb923c";
  const cfg = {
    type: "bar",
    data: {
      labels: days.map(d => +d.date.slice(8)),
      datasets: [
        { label: "Worked", data: days.map(d => d.date > D.today ? 0 : d.hours), backgroundColor: days.map(d => d.date === D.today ? warn : d.isSunday ? sunColor : d.isPartial ? partial : accent), borderRadius: 3, barPercentage: 0.85, categoryPercentage: 0.9 },
        { label: "Target", data: days.map(d => d.targetHours), type: "line", borderColor: targetLine, borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 220 },
      interaction: { mode: "index", axis: "x", intersect: false },
      scales: { y: { beginAtZero: true, suggestedMax: 10, grid: { color: grid }, ticks: { color: tick, stepSize: 2, callback: (v) => v+"h" } }, x: { grid: { display: false }, ticks: { color: tick, autoSkip: true, maxTicksLimit: 15 } } },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: tick, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => niceDateFull(days[items[0].dataIndex].date),
            label: (c) => c.dataset.label + ": " + fmtHours(c.parsed.y),
            afterBody: (items) => sessionsTooltipLines(days[items[0].dataIndex].date),
          },
        },
      },
      onClick: (evt) => { const points = monthChart.getElementsAtEventForMode(evt, "nearest", { intersect: false }, true); if (points.length) jumpSessionsTo(days[points[0].index].date); },
    },
  };
  monthChart = new Chart(document.getElementById("monthChart"), cfg);
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
  const accent = css("--accent"); const warn = css("--warn"); const sunColor = css("--fg-subtle"); const grid = css("--grid"); const tick = css("--fg-muted"); const targetLine = css("--fg-subtle"); const partial = "#fb923c";
  const cfg = {
    type: "bar",
    data: { labels: wb.days.map(d => d.label), datasets: [
      { label: "Worked", data: wb.days.map(d => d.hours), backgroundColor: wb.days.map(d => d.date === D.today ? warn : d.isSunday ? sunColor : d.isPartial ? partial : accent), borderRadius: 4, barPercentage: 0.68 },
      { label: "Target", data: wb.days.map(d => d.targetHours), type: "line", borderColor: targetLine, borderDash: [3,3], pointRadius: 0, borderWidth: 1 },
    ]},
    options: {
      maintainAspectRatio: false, animation: { duration: 180 },
      scales: { y: { beginAtZero: true, suggestedMax: 10, grid: { color: grid }, ticks: { color: tick, stepSize: 2, callback: (v) => v+"h" } }, x: { grid: { display: false }, ticks: { color: tick } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => niceDateFull(wb.days[items[0].dataIndex].date), label: (c) => c.dataset.label+": "+fmtHours(c.parsed.y), afterBody: (items) => sessionsTooltipLines(wb.days[items[0].dataIndex].date) } } },
      onClick: (evt) => { const points = drillChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true); if (points.length) jumpSessionsTo(wb.days[points[0].index].date); },
    },
  };
  if (drillChart) drillChart.destroy();
  drillChart = new Chart(document.getElementById("drillChart"), cfg);
}

/* ─── Sessions ─── */
const dPicker = document.getElementById("dPicker");
dPicker.value = D.today; dPicker.min = D.earliestDate; dPicker.max = D.today;
function computeBreakMin(rows) {
  if (!rows || rows.length < 2) return 0;
  const sorted = [...rows].sort((a, b) => a.punch_in.localeCompare(b.punch_in));
  let breakMin = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i-1];
    if (!prev.punch_out) continue;
    const gapMs = Date.parse(sorted[i].punch_in) - Date.parse(prev.punch_out);
    if (gapMs > 0) breakMin += Math.round(gapMs / 60000);
  }
  return breakMin;
}
function tzOffsetFromISO(iso) { const m = /([+-]\\d{2}:\\d{2})$/.exec(iso); return m ? m[1] : "+00:00"; }
function renderTimeline(date, rows) {
  const el = document.getElementById("timeline");
  if (!el) return;
  el.innerHTML = "";
  const isToday = date === D.today;
  if (!rows || rows.length === 0) { el.innerHTML = '<div class="timeline-bar break" style="left:0;width:100%" title="No sessions"></div>'; return; }
  const sorted = [...rows].sort((a, b) => a.punch_in.localeCompare(b.punch_in));
  const dayStartMs = Date.parse(date + "T00:00:00" + tzOffsetFromISO(sorted[0].punch_in));
  const dayLenMs = 24 * 60 * 60 * 1000;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const startMs = Date.parse(s.punch_in);
    let endMs;
    if (s.punch_out) endMs = Date.parse(s.punch_out);
    else if (isToday) endMs = Date.now();
    else endMs = startMs + 30 * 60000;
    const leftPct = ((startMs - dayStartMs) / dayLenMs) * 100;
    const widthPct = Math.max(0.3, ((endMs - startMs) / dayLenMs) * 100);
    const cls = !s.punch_out && isToday ? "timeline-bar open" : "timeline-bar";
    const inClock = s.punch_in.slice(11, 16);
    const outClock = s.punch_out ? s.punch_out.slice(11, 16) : (isToday ? "now" : "?");
    const dur = fmtHM(Math.round((endMs - startMs) / 60000));
    el.innerHTML += '<div class="'+cls+'" data-sidx="'+i+'" style="left:'+leftPct.toFixed(2)+'%;width:'+widthPct.toFixed(2)+'%" title="'+inClock+' → '+outClock+' · '+dur+'"></div>';
    if (i + 1 < sorted.length && s.punch_out) {
      const gapStart = endMs;
      const gapEnd = Date.parse(sorted[i+1].punch_in);
      if (gapEnd > gapStart) {
        const gLeft = ((gapStart - dayStartMs) / dayLenMs) * 100;
        const gWidth = ((gapEnd - gapStart) / dayLenMs) * 100;
        const gDur = fmtHM(Math.round((gapEnd - gapStart) / 60000));
        el.innerHTML += '<div class="timeline-bar break" style="left:'+gLeft.toFixed(2)+'%;width:'+gWidth.toFixed(2)+'%" title="break · '+gDur+'"></div>';
      }
    }
  }
  if (isToday) { const nowPct = ((Date.now() - dayStartMs) / dayLenMs) * 100; if (nowPct > 0 && nowPct < 100) el.innerHTML += '<div class="timeline-now" style="left:'+nowPct.toFixed(2)+'%" title="now"></div>'; }
  el.querySelectorAll("[data-sidx]").forEach((bar) => {
    bar.addEventListener("mouseenter", () => highlightSession(+bar.getAttribute("data-sidx"), true));
    bar.addEventListener("mouseleave", () => highlightSession(+bar.getAttribute("data-sidx"), false));
  });
}
function highlightSession(idx, on) {
  document.querySelectorAll('#sTable tr[data-sidx="'+idx+'"]').forEach((el) => el.classList.toggle("highlight", on));
  document.querySelectorAll('#timeline [data-sidx="'+idx+'"]').forEach((el) => el.classList.toggle("highlight", on));
}
function renderSessions() {
  const date = dPicker.value;
  const rows = (D.sessions.byDate[date] || []).slice();
  const dayIsSun = new Date(date+"T00:00:00").getDay() === 0;
  const isToday = date === D.today;
  document.getElementById("dToday").disabled = isToday;
  document.getElementById("sLabel").textContent = niceDateFull(date);

  let total = 0;
  const tbody = document.querySelector("#sTable tbody");
  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:16px;color:var(--fg-muted)">No sessions</td></tr>'; }
  else {
    tbody.innerHTML = rows.map((s, i) => {
      const openRow = s.punch_out === null && isToday;
      const live = openRow ? liveRunningMin() : 0;
      const dur = s.duration_minutes !== null ? s.duration_minutes : live;
      total += dur;
      const durLabel = s.duration_minutes !== null ? fmtHM(dur) : fmtHM(live)+' <span class="muted">(open)</span>';
      return '<tr'+(openRow?' class="open"':'')+' data-sidx="'+i+'"><td>'+(i+1)+'</td><td>'+clock(s.punch_in)+'</td><td>'+clock(s.punch_out)+'</td><td>'+durLabel+'</td></tr>';
    }).join("");
    document.querySelectorAll("#sTable tr[data-sidx]").forEach((tr) => {
      tr.addEventListener("mouseenter", () => highlightSession(+tr.getAttribute("data-sidx"), true));
      tr.addEventListener("mouseleave", () => highlightSession(+tr.getAttribute("data-sidx"), false));
    });
  }
  const target = dayIsSun ? 0 : (D.todayTargetHours * 60);
  const bal = total - target;
  const breakMin = computeBreakMin(rows);
  const parts = [
    '<span><b>'+rows.length+'</b> session'+(rows.length===1?'':'s')+'</span>',
    '<span class="sep">·</span>', '<span>Worked <b>'+fmtHM(total)+'</b></span>',
  ];
  if (breakMin > 0) parts.push('<span class="sep">·</span>', '<span class="muted">Break <b>'+fmtHM(breakMin)+'</b></span>');
  if (dayIsSun) parts.push('<span class="sep">·</span>', '<span class="muted">Sunday · no target</span>');
  else parts.push('<span class="sep">·</span>', '<span>Target <b>'+fmtHM(target)+'</b></span>', '<span class="sep">·</span>', '<span class="'+(bal>=0?"pos":"neg")+'">Balance <b>'+(bal>=0?"+":"")+fmtHM(bal)+'</b></span>');
  document.getElementById("sSummary").innerHTML = parts.join("");
  renderTimeline(date, rows);
}

/* ─── Heatmap ─── */
const hmSelectEl = document.getElementById("hmSelect");
D.months.slice().reverse().forEach((m) => { const opt = document.createElement("option"); opt.value = m.key; opt.textContent = m.label; hmSelectEl.appendChild(opt); });
hmSelectEl.value = D.months[D.months.length - 1].key;
function renderHeatmap() {
  const el = document.getElementById("heatmap");
  const m = D.months.find(mm => mm.key === hmSelectEl.value) || D.months[D.months.length - 1];
  document.getElementById("hmLabel").textContent = m.label;
  document.getElementById("hmToday").disabled = hmSelectEl.value === D.months[D.months.length - 1].key;
  const targetHrs = D.todayTargetHours || 8;
  const isLight = currentTheme() === "light";
  const scale = isLight
    ? ["#f4f4f5", "#c8ecd0", "#95d9a3", "#5fbf7a", "#22a04a"]
    : ["#171a22", "#1e3a2a", "#265236", "#357048", "#4ade80"];
  document.getElementById("hmSwatches").innerHTML = scale.map((c) => '<i style="background:'+c+'"></i>').join("");
  const colorFor = (h) => {
    if (h <= 0) return scale[0];
    const ratio = h / targetHrs;
    if (ratio < 0.25) return scale[1];
    if (ratio < 0.5)  return scale[2];
    if (ratio < 0.75) return scale[3];
    return scale[4];
  };
  const header = ['<div class="week-label"></div>', 'Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => i === 0 ? d : '<div class="dow-label">' + d + '</div>').join("");
  const rowsHtml = [header];
  for (const w of m.weeks) {
    const cells = ['<div class="week-label">' + w.label.split('–')[0] + '</div>'];
    const byDow = new Array(7).fill(null);
    for (const day of w.days) { const dow = new Date(day.date + "T00:00:00").getDay(); const idx = dow === 0 ? 6 : dow - 1; byDow[idx] = day; }
    for (let i = 0; i < 7; i++) {
      const day = byDow[i];
      if (!day) cells.push('<div class="cell outside"></div>');
      else {
        const bg = colorFor(day.hours);
        const isTd = day.date === D.today ? " today" : "";
        const label = day.date.slice(8);
        const title = day.date + " · " + fmtHours(day.hours) + (day.isSunday ? " (Sun)" : "");
        cells.push('<div class="cell'+isTd+'" data-date="'+day.date+'" style="background:'+bg+'" title="'+title+'">'+label+'</div>');
      }
    }
    rowsHtml.push(cells.join(""));
  }
  el.innerHTML = rowsHtml.join("");
  el.querySelectorAll(".cell[data-date]").forEach((cell) => cell.addEventListener("click", () => jumpSessionsTo(cell.getAttribute("data-date"))));
}

/* ─── Nav wiring ─── */
document.getElementById("wPrev").onclick = () => { if (weekIdx > 0) { weekIdx--; renderWeek(); } };
document.getElementById("wNext").onclick = () => { if (weekIdx < D.weeks.length - 1) { weekIdx++; renderWeek(); } };
document.getElementById("wToday").onclick = () => { weekIdx = D.weeks.length - 1; renderWeek(); };
document.getElementById("wCompare").onclick = () => { wCompareOn = !wCompareOn; document.getElementById("wCompare").classList.toggle("active", wCompareOn); renderWeek(); };
document.getElementById("wShowBreak").onclick = () => { wShowBreak = !wShowBreak; document.getElementById("wShowBreak").classList.toggle("active", wShowBreak); renderWeek(); };
mSelect.onchange = renderMonth;
document.getElementById("mToday").onclick = () => { mSelect.value = D.months[D.months.length - 1].key; renderMonth(); };
document.getElementById("drillBack").onclick = () => { document.getElementById("monthDrill").hidden = true; document.getElementById("monthMain").hidden = false; };
document.querySelectorAll("#mTabs button").forEach((b) => {
  b.onclick = () => { mChartTab = b.getAttribute("data-tab"); localStorage.setItem("dt.mTab", mChartTab); renderMonth(); };
});
hmSelectEl.onchange = renderHeatmap;
document.getElementById("hmToday").onclick = () => { hmSelectEl.value = D.months[D.months.length - 1].key; renderHeatmap(); };
function shiftDay(days) { const d = new Date(dPicker.value+"T00:00:00"); d.setDate(d.getDate()+days); const iso = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); if (iso > D.today || iso < D.earliestDate) return; dPicker.value = iso; renderSessions(); }
document.getElementById("dPrev").onclick = () => shiftDay(-1);
document.getElementById("dNext").onclick = () => shiftDay(1);
document.getElementById("dToday").onclick = () => { dPicker.value = D.today; renderSessions(); };
dPicker.onchange = renderSessions;

/* Leave form */
const lfDate = document.getElementById("lfDate");
const lfType = document.getElementById("lfType");
const lfReason = document.getElementById("lfReason");
const lfMsg = document.getElementById("lfMsg");
lfDate.value = D.today; lfDate.min = D.earliestDate;
document.getElementById("lfSaveAdd").onclick = async () => {
  const r = await callApi("/api/leave/add", { date: lfDate.value, type: lfType.value, reason: lfReason.value.trim() || undefined });
  if (r.ok) { toast("✓ Leave saved for " + lfDate.value, "pos"); await refresh(); } else toast("Failed: " + r.error, "err", 3500);
};
document.getElementById("lfSaveRemove").onclick = async () => {
  const r = await callApi("/api/leave/remove", { date: lfDate.value });
  if (r.ok) toast("✓ Leave removed for " + lfDate.value, "pos"); else toast("No leave for " + lfDate.value, "err", 3500);
  if (r.ok) await refresh();
};

/* Punch form */
const pfDate = document.getElementById("pfDate");
const pfT1 = document.getElementById("pfT1");
const pfT2 = document.getElementById("pfT2");
const pfMsg = document.getElementById("pfMsg");
pfDate.value = D.today; pfDate.min = D.earliestDate; pfDate.max = D.today;
document.getElementById("pfSave").onclick = async () => {
  if (!pfT1.value && !pfT2.value) { toast("Enter at least one time", "err", 2000); return; }
  const times = [pfT1.value, pfT2.value].filter(Boolean).sort();
  const r = await callApi("/api/punch/add", { date: pfDate.value, from: times[0], to: times[1] });
  if (r.ok) { toast("✓ Punch saved · " + times[0] + (times[1] ? " → " + times[1] : " (open)"), "pos"); pfT1.value = ""; pfT2.value = ""; await refresh(); }
  else toast("Failed: " + r.error, "err", 3500);
};

/* Footer */
function renderFooter() {
  const bits = ["Generated " + D.generatedAt];
  if (D.lastPoll) bits.push("last fetch " + D.lastPoll.ran_at + " (" + D.lastPoll.status + ")");
  if (D.lastSync) bits.push("last sync " + D.lastSync.ran_at);
  document.getElementById("footInfo").textContent = bits.join(" · ");
}

/* Initial render + tick */
renderAll();
setInterval(() => { renderHero(); renderAlert(); if (dPicker.value === D.today) renderSessions(); }, 5_000);
setInterval(refresh, 5 * 60_000);
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
