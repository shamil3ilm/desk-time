import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import { atsLogin, saveCachedToken } from "../ats/auth.js";
import { encryptString } from "../crypto/encrypt.js";
import { findUserByEmail, updateUserPassword, markUserLoggedIn } from "../db/users.js";
import { createAppSession, deleteAppSession } from "../db/app-sessions.js";
import { makeSessionSetCookie, makeSessionClearCookie, readSessionIdFromRequest } from "../crypto/cookie.js";
import { runPoll } from "../ats/poll.js";
import { formPage, redirect } from "./_html.js";

export function loginPage(): Response {
  return new Response(formPage({
    title: "Log in",
    heading: "Log in to desk-time",
    intro: "Use your Zil Money HR credentials.",
    action: "/login",
    submitLabel: "Log in",
    footerLinks: [{ href: "/signup", text: "First time? Sign up" }],
  }), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function loginSubmit(req: Request, env: Env): Promise<Response> {
  const config = getConfig(env);
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return new Response(formPage({
      title: "Log in",
      heading: "Log in to desk-time",
      action: "/login",
      submitLabel: "Log in",
      error: "Email and password are required.",
      values: { email },
      footerLinks: [{ href: "/signup", text: "First time? Sign up" }],
    }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // We always verify against the ATS (proves the password is current). Re-encrypt on success
  // so a password rotation via re-login updates the stored ciphertext.
  let login;
  try {
    login = await atsLogin(config.atsBaseUrl, email, password);
  } catch (err) {
    return new Response(formPage({
      title: "Log in",
      heading: "Log in to desk-time",
      action: "/login",
      submitLabel: "Log in",
      error: `Login failed: ${err instanceof Error ? err.message : String(err)}`,
      values: { email },
      footerLinks: [{ href: "/signup", text: "First time? Sign up" }],
    }), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const existing = await findUserByEmail(env.DB, email);
  if (!existing) {
    return new Response(formPage({
      title: "Log in",
      heading: "Log in to desk-time",
      action: "/login",
      submitLabel: "Log in",
      error: "No account for this email. Sign up first.",
      values: { email },
      footerLinks: [{ href: "/signup", text: "First time? Sign up" }],
    }), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const encrypted = await encryptString(password, config.masterKey);
  await updateUserPassword(env.DB, existing.id, encrypted);
  await saveCachedToken(env.DB, existing.id, login.token, login.expiresAt);
  await markUserLoggedIn(env.DB, existing.id);
  const session = await createAppSession(env.DB, existing.id);

  // Refresh today's data so the dashboard shows current state right after login.
  // Fetch-only (no sync) — cheap, and the hourly cron has probably synced recently.
  await runPoll(env.DB, config, existing.id, { syncFirst: false }).catch((err) => {
    console.error(`login refresh for user ${existing.id} failed:`, err instanceof Error ? err.message : String(err));
  });

  return redirect("/", makeSessionSetCookie(session.id, session.expiresAt));
}

export async function logoutSubmit(req: Request, env: Env): Promise<Response> {
  const sid = readSessionIdFromRequest(req);
  if (sid) await deleteAppSession(env.DB, sid);
  return redirect("/login", makeSessionClearCookie());
}
