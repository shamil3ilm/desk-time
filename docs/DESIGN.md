# Shared multi-tenant deployment — Design Sketch

**Target**: Cloudflare Workers + D1 + Cron Triggers  
**Model**: one deployment, N users (~10), each sees only their own data  
**Cost**: ₹0/month, no credit card, no trial expiry  
**Auth**: per-user login, HR password encrypted at rest with server master key

Not committed to. Just the shape for review. Approve or push back before ~30h build.

---

## Why Cloudflare Workers over Vercel/Fly/Railway

| Feature | Free tier | Fit |
|---|---|---|
| Workers requests | 100k/day | We'll do ~5k/day for 10 users. 5% |
| Cron Triggers | Unlimited | ✅ hourly poll + day-end trivially |
| D1 (SQLite) | 5 GB storage, 5M reads/day | Our data is ~5 MB per user. Comfortable |
| KV | 100k reads/day | Session cache |
| Secrets | Unlimited | For master encryption key |
| Wall time per invocation | 30s (CPU 50ms) | Enough for one user's sync |
| Card required | **No** | Contrast with Fly, Vercel Pro |
| Trial expiry | **Never** | Contrast with Fly, Railway |

Vercel Hobby's 10s timeout and 2-cron cap break down at 10 users; Pro solves it but costs $20/mo.  
Fly.io needs a credit card even on free credit and could change tiers.  
Cloudflare has been rock-solid on their free tier for years.

---

## Trust model (explicit)

You (the deployer) hold the master encryption key. Colleagues' HR passwords are encrypted with that key.

- **What you can do**: decrypt any user's password if you access the deployment's env vars
- **What no one else can do**: read the DB and see passwords — they're ciphertext without your key
- **What compromises everyone**: if your Cloudflare account gets breached, or you're forced to hand over the key

Before shipping, each colleague must sign off on: "I trust Shamil to hold the master key protecting my HR password." No workaround — that's the shared-deployment trade.

---

## Architecture

```
                          shamil3ilm/time
                          (Cloudflare Worker)
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
  /login             /            /api/sync-all
  /logout            (dashboard)  (cron target)
  /signup            /api/sync    /api/sync-user?id=X
                     /api/leave   /api/fetch
                     /api/punch
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  D1 (shared SQLite)     │
                    │  - users                │
                    │  - sessions (user_id)   │
                    │  - leaves (user_id)     │
                    │  - poll_log (user_id)   │
                    │  - daily_meta (user_id) │
                    │  - session_alerts       │
                    │      (user_id)          │
                    │  - tokens (JWT cache,   │
                    │      user_id)           │
                    └─────────────────────────┘
                                 ▲
                                 │
                    ┌────────────┴────────────┐
                    │ Cron Trigger (hourly)   │
                    │  → /api/sync-all        │
                    │      → for each user,   │
                    │        ctx.waitUntil(   │
                    │          fanout(user))  │
                    └─────────────────────────┘
```

`ctx.waitUntil()` runs background tasks in parallel after the request returns. Each user's sync is an independent execution, each with its own 30s budget — no orchestrator timeout.

---

## Directory shape

```
time/
├── src/
│   ├── worker.ts               # entry: router
│   ├── routes/
│   │   ├── auth.ts             # POST /login, POST /signup, POST /logout
│   │   ├── dashboard.ts        # GET /  → HTML for logged-in user
│   │   ├── api-sync.ts         # POST /api/sync (user-triggered)
│   │   ├── api-fetch.ts        # POST /api/fetch
│   │   ├── api-cron.ts         # POST /api/sync-all (cron target)
│   │   ├── api-sync-user.ts    # POST /api/sync-user?id=X (fan-out target)
│   │   ├── api-leave.ts        # POST /api/leave (add/remove)
│   │   └── api-punch.ts        # POST /api/punch
│   ├── db/
│   │   ├── client.ts           # D1 helpers (prepare/bind/all)
│   │   ├── schema.sql          # canonical schema
│   │   ├── migrations/         # 0001_init.sql, 0002_add_..., etc
│   │   ├── users.ts            # createUser, findByEmail, updatePassword
│   │   ├── sessions.ts         # per-user session queries
│   │   ├── leaves.ts
│   │   └── poll-log.ts
│   ├── crypto/
│   │   ├── encrypt.ts          # AES-GCM via Web Crypto API
│   │   └── session.ts          # signed session cookies
│   ├── ats/
│   │   ├── auth.ts             # login to ATS, cache JWT in D1
│   │   ├── api.ts              # fetchMyToday, triggerSync, waitForSyncIdle
│   │   └── poll.ts             # runPoll(userId) — orchestrates one user's cycle
│   ├── notify/
│   │   └── telegram.ts         # webhook sender (per-user, optional)
│   └── report/
│       ├── chart-html.ts       # generates dashboard HTML from D1 data
│       ├── today.ts, week.ts, month.ts, history.ts
│       └── dates.ts
├── wrangler.toml               # Cloudflare project config: routes, D1 binding, secrets
├── package.json
├── tsconfig.json
└── README.md
```

Most of `src/report/*.ts` is directly ported from today's code (queries change from sync to async, but the logic is identical).

---

## `wrangler.toml`

```toml
name = "time"
main = "src/worker.ts"
compatibility_date = "2026-08-01"

[[d1_databases]]
binding = "DB"
database_name = "time"
database_id = "<generated on first `wrangler d1 create time`>"

[triggers]
crons = [
  "0 9-21 * * *",    # hourly during work hours (fires /api/sync-all)
  "30 23 * * *",     # day-end catch-up
]

# Secrets set via `wrangler secret put`:
#   MASTER_KEY          — 32-byte base64, encrypts HR passwords at rest
#   SESSION_SECRET      — HMAC key for session cookies
#   ATS_BASE_URL        — https://api.hr.zilmoney.com
```

Two crons on the free tier. Both hit `/api/sync-all`, which fans out per user.

---

## D1 schema

```sql
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT UNIQUE NOT NULL,
  hr_password_encrypted BLOB NOT NULL,      -- AES-GCM: iv (12 bytes) || ciphertext || tag
  staff_id              INTEGER,            -- from JWT after first login
  telegram_chat_id      TEXT,               -- optional
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at         TEXT
);

CREATE TABLE sessions (
  id                INTEGER NOT NULL,        -- ATS id, unique per (user_id, id)
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punch_in          TEXT NOT NULL,
  punch_out         TEXT,
  duration_minutes  INTEGER,
  work_date         TEXT NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, work_date);

CREATE TABLE leaves (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  reason      TEXT,
  type        TEXT,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE poll_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ran_at      TEXT NOT NULL DEFAULT (datetime('now')),
  status      TEXT NOT NULL,
  sessions    INTEGER,
  error       TEXT,
  synced      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_poll_log_user_time ON poll_log(user_id, ran_at DESC);

CREATE TABLE session_alerts (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  INTEGER NOT NULL,
  threshold   INTEGER NOT NULL,
  fired_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, session_id, threshold)
);

CREATE TABLE daily_meta (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date       TEXT NOT NULL,
  target_minutes  INTEGER NOT NULL,
  break_minutes   INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, work_date)
);

CREATE TABLE tokens (              -- cached JWTs to avoid re-login every request
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL     -- unix seconds
);

CREATE TABLE app_sessions (        -- browser session cookies (signed)
  id          TEXT PRIMARY KEY,    -- random 32-byte hex
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
```

Every user-scoped query filters by `user_id`. A middleware attaches `user_id` from the session cookie to every request.

---

## Encryption approach

**Setup (once, by you)**:

```bash
# Generate a 32-byte key, base64-encode
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Store in Cloudflare Secrets
wrangler secret put MASTER_KEY
# paste when prompted
```

**Per-user save** (on signup or password rotation):

```typescript
import { encrypt } from "./crypto/encrypt";
// crypto/encrypt.ts uses Web Crypto (available in Workers runtime):
export async function encrypt(plaintext: string, masterKeyB64: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0)),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  ));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;   // stored as BLOB in D1
}
```

**Per-user use** (during poll): fetch `hr_password_encrypted`, decrypt with `MASTER_KEY`, use in `POST /api/auth/login` to get a fresh ATS JWT, cache the JWT in `tokens` for 23 hours.

Master key never in code, never in DB, never in Git — only in Cloudflare Secrets. Rotation requires re-encrypting all rows (a one-off admin script).

---

## Auth flow (user-facing)

**First-time signup** (`/signup`):

```
POST /signup { email, hr_password }
  → attempt ATS login with these creds
      → 401? return "invalid ATS credentials"
      → 200? extract staff_id from JWT
              encrypt hr_password with MASTER_KEY
              INSERT into users
              cache JWT in tokens
              create app_sessions row + set cookie
              redirect to /
```

**Subsequent visits**: cookie identifies user → dashboard for that user only.

**Password changed on ATS side**: next poll fails with 401 → mark user inactive → they see "re-authenticate" banner → `/re-auth` form updates encrypted password.

---

## Cron fan-out

**`/api/sync-all`** (hit by Cron Triggers):

```typescript
export async function syncAll(env: Env, ctx: ExecutionContext): Promise<Response> {
  const users = await env.DB.prepare(
    "SELECT id FROM users WHERE active = 1"
  ).all<{ id: number }>();

  for (const { id } of users.results ?? []) {
    // Each syncUser runs in the background after this response returns.
    // Each has its own 30s Worker budget. Parallel by default in the runtime.
    ctx.waitUntil(syncUser(env, id));
  }

  return new Response(JSON.stringify({ ok: true, queued: users.results?.length ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
}

async function syncUser(env: Env, userId: number): Promise<void> {
  try {
    await runPoll(env, userId, { syncFirst: true });
  } catch (err) {
    console.error(`syncUser ${userId} failed:`, err);
  }
}
```

10 users × 3-5s each = comfortable under Cloudflare's per-execution limits, and no orchestrator timeout because we return immediately.

---

## Alerts on serverless

Windows toasts are gone. Replacement: **Telegram bot per user** (optional).

- User adds `telegram_chat_id` in their profile (settings page)
- On alert threshold crossed, `alerts.ts` posts to `https://api.telegram.org/bot${SHARED_BOT_TOKEN}/sendMessage`
- One shared bot, per-user chat IDs
- Users who don't set a chat ID just don't get alerts

Telegram bot setup by you (one-time, ~5 min): create bot via @BotFather, put token in `SHARED_BOT_TOKEN` secret. Users message the bot once to get their chat ID (via a "Get my chat ID" helper), paste into settings.

---

## Onboarding a new colleague

1. You send them: **https://time.workers.dev/signup**
2. They enter their zilmoney email + HR password
3. App verifies against ATS (proves credentials are valid)
4. On success: their record is encrypted and saved
5. First poll fires within the hour, they see their dashboard at `/`
6. (Optional) Message your Telegram bot, paste chat ID into their profile → alerts enabled

**Zero local install. Zero PowerShell. Zero DevOps.**

---

## Phased delivery plan

Ship in slices so I don't build 30 hours in the dark:

| Phase | Deliverable | Effort |
|---|---|---|
| **P1** | Cloudflare account, Worker deployed with a `/health` route, D1 created with schema, all secrets set. Just proves infra. | 2h |
| **P2** | Single-user MVP: hardcoded user, signup/login/dashboard for one person, sync working. **Prove the concept end-to-end for you first.** | 12h |
| **P3** | Multi-user: users table, signup flow, cookie sessions, all queries scoped by user_id, cron fan-out | 10h |
| **P4** | Alerts (Telegram), password rotation, admin tools (disable user, view poll_log per user) | 6h |
| **P5** | Migrate your existing SQLite data into shared D1 as user_id=1, invite first 2 colleagues to test | 3h |
| **P6** | Onboard remaining colleagues, monitor, iterate | ongoing |

**~33h total.** After P2 you have a working thing you use. P3-P5 turn it into a proper shared tool. Each phase is shippable.

---

## Open decisions before I start

1. **App URL**: `time.shamil3ilm.workers.dev` (default free) or custom domain? Custom is optional and free with Cloudflare.
2. **Telegram bot name**: needs to be globally unique, e.g. `@zil_time_bot`. You create it.
3. **What happens when a user leaves the company**: mark inactive? delete? (soft delete + hard-delete-after-90-days is safe default)
4. **Admin access**: do you want a `/admin` page (users list, force sync a user, view logs) or is CLI-only via `wrangler d1 execute` enough? Admin page adds ~4h.
5. **Timeline**: parallel with your day job = evenings/weekends → ~3-4 weeks realistic. Faster if we skip P4/P6 initially.

---

## What I need from you to start

- **Approval of this shape** (or specific pushback on any of it)
- **Cloudflare account created** (free signup, ~1 min)
- **Telegram bot created** if we want alerts (~5 min via @BotFather)
- **Confirmation from at least 2 colleagues** they're OK with the shared-key trust model, so P5 has real users to test with

I can start P1 immediately after your approval; you'll see a live Worker within an hour.
