-- Per-day classification for short-worked days (worked < target, not a leave).
--   'partial' — compensated with time from other days → counts as 1 day
--   'half'    — not compensated (approved half-day)   → counts as 0.5 day
--    NULL    — user hasn't classified → treat as 'partial' (current behavior)
--
-- Stored on daily_meta so we don't need a new table. All existing rows
-- get NULL which preserves today's behavior.
ALTER TABLE daily_meta ADD COLUMN day_type TEXT;
