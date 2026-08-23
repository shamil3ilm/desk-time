// Late-evening stale-session alarm.
// Runs at 22:30 IST via cron. For each active user with a telegram_chat_id,
// checks if today (in IST) still has an open session (punch_out IS NULL).
// If yes, sends a nudge so the user can record the punch-out manually before
// midnight IST — the ATS /my-today endpoint won't return yesterday's data
// after the day rolls, so any missed punch-out becomes unrecoverable.

import type { Env } from "./worker.js";
import { getConfig } from "./config.js";
import { listActiveUserIds, findUserById } from "./db/users.js";
import { getOpenSessionOnDate } from "./db/sessions.js";
import { todayISO } from "./report/dates.js";
import { sendTelegramMessage } from "./telegram.js";

export async function staleSessionAlarm(env: Env): Promise<void> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn("stale-session alarm: TELEGRAM_BOT_TOKEN not set — skipping");
    return;
  }
  const config = getConfig(env);
  const date = todayISO(config.tzOffsetMin);
  const appUrl = (env.APP_URL ?? "https://desk-time.letmeknow.workers.dev").replace(/\/$/, "");
  const userIds = await listActiveUserIds(env.DB);
  console.log(`stale-session alarm: checking ${userIds.length} users for open sessions on ${date}`);

  let alerted = 0;
  for (const userId of userIds) {
    try {
      const user = await findUserById(env.DB, userId);
      if (!user?.telegram_chat_id) continue;
      const open = await getOpenSessionOnDate(env.DB, userId, date);
      if (!open) continue;
      const startClock = open.punch_in.slice(11, 16);
      const text =
        `⏰ <b>desk-time</b>: your session from <b>${startClock}</b> IST is still open on ${date}.\n\n` +
        `If you've already punched out, open the dashboard and use <b>Add manual punch</b> to record it — the ATS won't backfill after midnight.\n\n` +
        `${appUrl}/#today`;
      await sendTelegramMessage({ botToken, chatId: user.telegram_chat_id }, text);
      alerted++;
      console.log(`stale-session alarm sent to user ${userId} (${user.email})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`stale-session alarm for user ${userId} failed:`, msg);
    }
  }
  console.log(`stale-session alarm complete — ${alerted}/${userIds.length} nudged`);
}
