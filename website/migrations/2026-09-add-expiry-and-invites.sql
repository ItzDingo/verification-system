-- Run this once in the Supabase SQL editor.
-- Adds: timed verification expiry, invite-join tracking, and the staff
-- leaderboard "last known name" cache (from the previous update).

-- 1) Leaderboard name cache (safe to re-run: IF NOT EXISTS guards it)
alter table staff_stats
  add column if not exists last_known_username text,
  add column if not exists last_known_avatar text;

-- 2) Timed verification support on the users table
alter table users
  add column if not exists verified_until timestamptz,       -- null = permanent
  add column if not exists verify_duration_label text;        -- e.g. "7 days", "Permanent" — for display in logs

-- Index to make the bot's expiry sweep cheap even with many verified users
create index if not exists idx_users_verified_until
  on users (verified_until)
  where verified = true and verified_until is not null;

-- 3) Invite-join tracking — which invite code/inviter a user joined with.
-- One row per join event (a user could re-join later with a different invite).
create table if not exists invite_joins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  invite_code text,
  inviter_id text,
  inviter_username text,
  inviter_avatar text,
  uses_at_join integer,
  joined_at timestamptz not null default now()
);

create index if not exists idx_invite_joins_user_id on invite_joins (user_id, joined_at desc);
