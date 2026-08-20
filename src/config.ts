// Typed view over env vars from wrangler.toml + secrets.
// Resolve once per request; pass the returned object into helpers.

import type { Env } from "./worker.js";
import { parseOffset } from "./report/dates.js";

export interface AppConfig {
  atsBaseUrl: string;
  tzOffset: string;
  tzOffsetMin: number;
  dailyTargetMinutes: number;
  workingDaysPerWeek: number;
  monthlyCasualLeaves: number;
  sessionAlertMinutes: number;
  sessionMaxMinutes: number;
  masterKey: string;
  sessionSecret: string;
  telegramBotToken: string | undefined;
}

function num(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number, got: ${raw}`);
  return n;
}

export function getConfig(env: Env): AppConfig {
  if (!env.MASTER_KEY) throw new Error("MASTER_KEY secret not set — run `wrangler secret put MASTER_KEY`");
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET secret not set — run `wrangler secret put SESSION_SECRET`");
  const tzOffset = env.APP_TZ_OFFSET || "+05:30";
  return {
    atsBaseUrl: (env.ATS_BASE_URL || "https://api.hr.zilmoney.com").replace(/\/$/, ""),
    tzOffset,
    tzOffsetMin: parseOffset(tzOffset),
    dailyTargetMinutes: num("DAILY_TARGET_MINUTES", env.DAILY_TARGET_MINUTES, 480),
    workingDaysPerWeek: num("WORKING_DAYS_PER_WEEK", env.WORKING_DAYS_PER_WEEK, 6),
    monthlyCasualLeaves: num("MONTHLY_CL_ALLOWANCE", env.MONTHLY_CL_ALLOWANCE, 1),
    sessionAlertMinutes: num("SESSION_ALERT_MINUTES", env.SESSION_ALERT_MINUTES, 240),
    sessionMaxMinutes: num("SESSION_MAX_MINUTES", env.SESSION_MAX_MINUTES, 270),
    masterKey: env.MASTER_KEY,
    sessionSecret: env.SESSION_SECRET,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
  };
}
