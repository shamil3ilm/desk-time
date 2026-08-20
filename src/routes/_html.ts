// Minimal HTML helpers for auth pages + redirects. Dashboard has its own rendering (Phase 2b).

export function redirect(location: string, setCookie?: string): Response {
  const headers = new Headers({ location });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

interface FormPageOpts {
  title: string;
  heading: string;
  intro?: string;
  action: string;
  submitLabel: string;
  error?: string;
  values?: { email?: string };
  footerLinks?: Array<{ href: string; text: string }>;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function formPage(opts: FormPageOpts): string {
  const errorBlock = opts.error ? `<div class="alert">${esc(opts.error)}</div>` : "";
  const intro = opts.intro ? `<p class="intro">${esc(opts.intro)}</p>` : "";
  const emailVal = opts.values?.email ? `value="${esc(opts.values.email)}"` : "";
  const links = (opts.footerLinks ?? []).map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join(" · ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)} — desk-time</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 60px 24px; background: #0e1015; color: #e8ecf1; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .wrap { width: 100%; max-width: 400px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .intro { color: #7d8592; font-size: 13px; margin: 0 0 24px; }
  form { display: flex; flex-direction: column; gap: 12px; }
  label { color: #6b7385; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  input {
    background: #171a22; color: #e8ecf1; border: 1px solid #262c3b;
    padding: 10px 12px; border-radius: 5px; font: inherit; outline: none;
  }
  input:focus { border-color: #3a4358; }
  button {
    background: #1b3a2a; color: #4ade80; border: 1px solid #1f4a35;
    padding: 10px 16px; border-radius: 5px; cursor: pointer; font: inherit;
    font-size: 13px; font-weight: 600; margin-top: 8px;
  }
  button:hover { background: #235241; }
  .alert { background: #2a0e10; color: #fca5a5; padding: 10px 12px; border-radius: 5px; margin-bottom: 16px; font-size: 13px; }
  .footer { margin-top: 20px; color: #6b7385; font-size: 12px; text-align: center; }
  .footer a { color: #7d8592; text-decoration: none; }
  .footer a:hover { color: #b7becb; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(opts.heading)}</h1>
  ${intro}
  ${errorBlock}
  <form method="post" action="${esc(opts.action)}">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required ${emailVal} />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">${esc(opts.submitLabel)}</button>
  </form>
  <div class="footer">${links}</div>
</div>
</body>
</html>`;
}
