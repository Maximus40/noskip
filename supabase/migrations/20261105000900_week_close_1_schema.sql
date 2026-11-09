-- Phase 7: closing the game week (Sunday 20:00 Paris), SKIP cards, Sunday recap,
-- "la barre tremble" (midweek check) and the pg_cron schedules that drive them.
--
-- Everything here is service-role only. Edge Functions call the `svc_*` wrappers; the
-- crons call the Edge Functions through pg_net with a shared secret stored in
-- app_private.cron_config (never exposed through the API).

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table public.weeks
  add column is_record boolean not null default false,
  add column skip_notified_at timestamptz;

-- A player who joined too late in the week to reach their goal is exempt (no SKIP card).
alter table public.week_results
  add column exempt boolean not null default false;

-- One "la barre tremble" alert per player per Paris day.
create table public.shaky_alerts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  days_left smallint not null,
  missing smallint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
alter table public.shaky_alerts enable row level security;
revoke all on public.shaky_alerts from anon, authenticated;
grant select, insert, update, delete on public.shaky_alerts to service_role;

-- Cron settings (functions URL + shared secret), never exposed through the API.
create table app_private.cron_config (
  id boolean primary key default true check (id),
  functions_url text not null check (functions_url ~ '^https://'),
  secret text not null check (char_length(secret) >= 32),
  updated_at timestamptz not null default now()
);
revoke all on app_private.cron_config from public, anon, authenticated;
