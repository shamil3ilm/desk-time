// Row shapes matching migrations/0001_init.sql.
// All user-scoped rows include user_id as the first field for index locality.

export interface UserRow {
  id: number;
  email: string;
  hr_password_encrypted: ArrayBuffer;
  staff_id: number | null;
  telegram_chat_id: string | null;
  active: number; // 0 or 1
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRow {
  id: number;
  user_id: number;
  punch_in: string;
  punch_out: string | null;
  duration_minutes: number | null;
  work_date: string;
  updated_at: string;
}

export interface LeaveRow {
  user_id: number;
  date: string;
  reason: string | null;
  type: string | null;
  added_at: string;
}

export interface PollLogRow {
  id: number;
  user_id: number;
  ran_at: string;
  status: string;
  sessions: number | null;
  error: string | null;
  synced: number;
}

export interface SessionAlertRow {
  user_id: number;
  session_id: number;
  threshold: number;
  fired_at: string;
}

export interface DailyMetaRow {
  user_id: number;
  work_date: string;
  target_minutes: number;
  break_minutes: number;
  updated_at: string;
}

export interface TokenRow {
  user_id: number;
  token: string;
  expires_at: number;
}

export interface AppSessionRow {
  id: string;
  user_id: number;
  expires_at: number;
  created_at: string;
}
