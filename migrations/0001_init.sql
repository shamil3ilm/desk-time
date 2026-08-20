-- Initial schema for desk-time on D1.
-- All user-scoped tables have user_id as the first PK column so index locality is good.
-- Apply locally:  npm run db:migrate:local
-- Apply remote:   npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT UNIQUE NOT NULL,
  hr_password_encrypted BLOB NOT NULL,
  staff_id              INTEGER,
  telegram_chat_id      TEXT,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at         TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id                INTEGER NOT NULL,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punch_in          TEXT NOT NULL,
  punch_out         TEXT,
  duration_minutes  INTEGER,
  work_date         TEXT NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, work_date);

CREATE TABLE IF NOT EXISTS leaves (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  reason      TEXT,
  type        TEXT,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS poll_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ran_at      TEXT NOT NULL DEFAULT (datetime('now')),
  status      TEXT NOT NULL,
  sessions    INTEGER,
  error       TEXT,
  synced      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_log_user_time ON poll_log(user_id, ran_at DESC);

CREATE TABLE IF NOT EXISTS session_alerts (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  INTEGER NOT NULL,
  threshold   INTEGER NOT NULL,
  fired_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, session_id, threshold)
);

CREATE TABLE IF NOT EXISTS daily_meta (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date       TEXT NOT NULL,
  target_minutes  INTEGER NOT NULL,
  break_minutes   INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, work_date)
);

CREATE TABLE IF NOT EXISTS tokens (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
