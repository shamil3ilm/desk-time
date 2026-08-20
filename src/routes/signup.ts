import type { Env } from "../worker.js";
import { getConfig } from "../config.js";
import { atsLogin, saveCachedToken } from "../ats/auth.js";
import { encryptString } from "../crypto/encrypt.js";
import { createUser, findUserByEmail, updateUserPassword } from "../db/users.js";
import { createAppSession } from "../db/app-sessions.js";
import { makeSessionSetCookie } from "../crypto/cookie.js";
import { runPoll } from "../ats/poll.js";
import { formPage, redirect } from "./_html.js";

export function signupPage(): Response {
  return new Response(formPage({
    title: "Sign up",
    heading: "Create your desk-time account",
    intro: "Enter your Zil Money HR email and password. We verify against the ATS immediately and encrypt your password at rest.",
    action: "/signup",
    submitLabel: "Sign up",
    footerLinks: [{ href: "/login", text: "Have an account? Log in" }],
  }), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function signupSubmit(req: Request, env: Env): Promise<Response> {
  const config = getConfig(env);
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return new Response(formPage({
      title: "Sign up",
      heading: "Create your desk-time account",
      action: "/signup",
      submitLabel: "Sign up",
      error: "Email and password are required.",
      values: { email },
      footerLinks: [{ href: "/login", text: "Have an account? Log in" }],
    }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // 1. Verify credentials against the ATS
  let login;
  try {
    login = await atsLogin(config.atsBaseUrl, email, password);
  } catch (err) {
    return new Response(formPage({
      title: "Sign up",
      heading: "Create your desk-time account",
      action: "/signup",
      submitLabel: "Sign up",
      error: `Could not verify with the ATS: ${err instanceof Error ? err.message : String(err)}`,
      values: { email },
      footerLinks: [{ href: "/login", text: "Have an account? Log in" }],
    }), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // 2. Encrypt password + create-or-update user
  const encrypted = await encryptString(password, config.masterKey);
  let existing = await findUserByEmail(env.DB, email);
  let userId: number;
  if (existing) {
    userId = existing.id;
    await updateUserPassword(env.DB, userId, encrypted);
  } else {
    userId = await createUser(env.DB, email, encrypted, login.staffId);
  }

  // 3. Cache JWT + create app session
  await saveCachedToken(env.DB, userId, login.token, login.expiresAt);
  const session = await createAppSession(env.DB, userId);

  // 4. Seed the dashboard with a full sync so the first render isn't empty.
  //    Errors are swallowed — user is signed in, they can Sync now if this failed.
  await runPoll(env.DB, config, userId, { syncFirst: true, forceSync: true }).catch((err) => {
    console.error(`initial sync for user ${userId} failed:`, err instanceof Error ? err.message : String(err));
  });

  return redirect("/", makeSessionSetCookie(session.id, session.expiresAt));
}
