-- NoSkip core schema.
-- Rules of the road:
--   * RLS is enabled on every table. Players see their own rows and rows of teams they belong to.
--   * Sensitive writes (session validation, weeks, results, SKIP cards, belts, subscriptions)
--     are done by Edge Functions with the service role only.
--   * Client-side writes go through narrow SECURITY DEFINER RPCs that validate input.
--   * GPS coordinates of players are never stored. Only gyms (public OSM places) have coordinates.
--   * All week logic is Europe/Paris.

-- ---------------------------------------------------------------------------
-- Privileges baseline: nothing is granted to API roles unless stated below.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.team_role as enum ('owner', 'member');
create type public.team_kind as enum ('standard', 'challenge');
create type public.session_source as enum ('geofence', 'manual_check');
create type public.belt_type as enum ('belt', 'big_canap');
create type public.lifter_title as enum (
  'machine', 'bro_du_lundi', 'toujours_au_shaker', 'skippeur_de_jambes'
);
create type public.push_platform as enum ('ios', 'android');
create type public.subscription_source as enum ('individual', 'duo', 'team');
create type public.subscription_status as enum (
  'trialing', 'active', 'grace_period', 'billing_issue', 'cancelled', 'expired'
);

-- ---------------------------------------------------------------------------
-- Time helpers (Europe/Paris)
-- ---------------------------------------------------------------------------
create function app_private.paris_date(ts timestamptz) returns date
language sql immutable parallel safe
as $$ select (ts at time zone 'Europe/Paris')::date $$;

-- Monday of the ISO week containing `d`.
create function app_private.monday_of(d date) returns date
language sql immutable parallel safe
as $$ select d - (extract(isodow from d)::int - 1) $$;

-- A game week runs Monday 00:00 → Sunday 20:00 (Paris). Anything after Sunday 20:00
-- belongs to the next week.
create function app_private.game_week_start(ts timestamptz) returns date
language sql immutable parallel safe
as $$
  select case
    when extract(isodow from (ts at time zone 'Europe/Paris')) = 7
         and extract(hour from (ts at time zone 'Europe/Paris')) >= 20
      then app_private.monday_of(app_private.paris_date(ts)) + 7
    else app_private.monday_of(app_private.paris_date(ts))
  end
$$;

-- Sunday 20:00 Paris closing instant of the week starting `week_start`.
create function app_private.week_deadline(week_start date) returns timestamptz
language sql immutable parallel safe
as $$ select ((week_start + 6)::timestamp + interval '20 hours') at time zone 'Europe/Paris' $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text check (pseudo is null or char_length(btrim(pseudo)) between 2 and 20),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1024),
  title public.lifter_title not null default 'machine',
  plate_color text not null default '#B9BBC0' check (plate_color ~ '^#[0-9A-F]{6}$'),
  weekly_goal smallint not null default 3 check (weekly_goal between 2 and 5),
  pending_weekly_goal smallint check (pending_weekly_goal between 2 and 5),
  goal_effective_from date,
  lifetime_sessions integer not null default 0 check (lifetime_sessions >= 0),
  onboarding_answers jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  rules_accepted_at timestamptz,
  sound_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  notification_prefs jsonb not null default
    '{"plate_loaded": true, "spot": true, "shaky_bar": true, "skip": true, "recap": true, "team_pr": true, "gym_change": true}'::jsonb,
  primary_gym_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_goal_has_date check ((pending_weekly_goal is null) = (goal_effective_from is null)),
  constraint onboarding_answers_is_object check (jsonb_typeof(onboarding_answers) = 'object'),
  constraint notification_prefs_is_object check (jsonb_typeof(notification_prefs) = 'object')
);

create function app_private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
for each row execute function app_private.touch_updated_at();

-- Create the profile row as soon as the auth user exists.
create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Gyms (public OSM cache) and player gyms
-- ---------------------------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  osm_id text not null unique check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  name text not null check (char_length(name) between 1 and 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gyms_lat_lng_idx on public.gyms (lat, lng);

create table public.user_gyms (
  user_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete restrict,
  is_primary boolean not null default false,
  chosen_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);
create unique index user_gyms_one_primary on public.user_gyms (user_id) where is_primary;

create function app_private.enforce_max_gyms() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.user_gyms where user_id = new.user_id) >= 3 then
    raise exception 'max_gyms_reached' using errcode = 'P0001', hint = 'A player can have at most 3 gyms.';
  end if;
  return new;
end $$;

create trigger user_gyms_max before insert on public.user_gyms
for each row execute function app_private.enforce_max_gyms();

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 32),
  created_by uuid references public.profiles (id) on delete set null,
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  kind public.team_kind not null default 'standard',
  max_members smallint not null default 4 check (max_members between 2 and 500),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  accepted_rules_at timestamptz,
  plate_color text not null check (plate_color ~ '^#[0-9A-F]{6}$'),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);
create unique index team_members_one_owner on public.team_members (team_id) where role = 'owner';

-- Membership helpers. SECURITY DEFINER avoids RLS recursion on team_members.
create function app_private.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = (select auth.uid())
  )
$$;

create function app_private.is_team_owner(p_team uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

create function app_private.shares_team_with(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members me
    join public.team_members other on other.team_id = me.team_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user
  )
$$;

-- Unambiguous alphabet (no I, O, 0, 1).
create function app_private.new_invite_code() returns text
language plpgsql volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

-- Grey plates for teammates; the app renders "you" in the accent colour.
create function app_private.next_plate_color(p_team uuid) returns text
language sql stable
as $$
  select coalesce(
    (select c from unnest(array['#F5F5F0','#B9BBC0','#7C7E84','#5E6066','#D9DADD','#9A9CA1']) with ordinality as p(c, ord)
     where c not in (select plate_color from public.team_members where team_id = p_team)
     order by ord limit 1),
    '#B9BBC0'
  )
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete restrict,
  source public.session_source not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min integer,
  validated_at timestamptz,
  cancelled_at timestamptz,
  local_date date not null,
  week_start date,
  created_at timestamptz not null default now(),
  unique (user_id, local_date),
  constraint ended_after_start check (ended_at is null or ended_at > started_at),
  constraint validated_needs_duration check (
    validated_at is null
    or (ended_at is not null and duration_min is not null and duration_min >= 40 and week_start is not null)
  ),
  constraint not_both_validated_and_cancelled check (validated_at is null or cancelled_at is null)
);
create index sessions_week_idx on public.sessions (week_start, user_id) where validated_at is not null;

create function app_private.sessions_derive() returns trigger
language plpgsql as $$
begin
  new.local_date := app_private.paris_date(new.started_at);
  if new.validated_at is not null then
    new.week_start := app_private.game_week_start(new.validated_at);
  else
    new.week_start := null;
  end if;
  return new;
end $$;

create trigger sessions_derive before insert or update on public.sessions
for each row execute function app_private.sessions_derive();

-- ---------------------------------------------------------------------------
-- Weeks, results, SKIP cards
-- ---------------------------------------------------------------------------
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  closed_at timestamptz,
  total_kg integer not null default 0 check (total_kg >= 0),
  skips_count integer not null default 0 check (skips_count >= 0),
  is_team_pr boolean not null default false,
  all_achieved boolean not null default false,
  machine_user_id uuid references public.profiles (id) on delete set null,
  skipper_user_id uuid references public.profiles (id) on delete set null,
  recap_sent_at timestamptz,
  unique (team_id, week_start)
);

create table public.week_results (
  week_id uuid not null references public.weeks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal smallint not null check (goal between 2 and 5),
  done smallint not null check (done >= 0),
  achieved boolean not null,
  used_joker boolean not null default false,
  primary key (week_id, user_id)
);
create index week_results_user_idx on public.week_results (user_id);

create table public.skip_cards (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  line_id text not null,
  created_at timestamptz not null default now(),
  shared_count integer not null default 0 check (shared_count >= 0),
  unique (week_id, user_id)
);
create index skip_cards_team_idx on public.skip_cards (team_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Social: spots, jokers, belts, duo streaks, reports
-- ---------------------------------------------------------------------------
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  constraint no_self_spot check (from_user <> to_user),
  unique (from_user, to_user, local_date)
);
create index spots_from_day_idx on public.spots (from_user, local_date);

create table public.jokers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  week_start date not null check (extract(isodow from week_start) = 1),
  used_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.belts (
  team_id uuid not null references public.teams (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  type public.belt_type not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (team_id, month, type)
);

create table public.duo_streaks (
  team_id uuid primary key references public.teams (id) on delete cascade,
  current_weeks integer not null default 0 check (current_weeks >= 0),
  best_weeks integer not null default 0 check (best_weeks >= 0),
  last_week_start date,
  updated_at timestamptz not null default now()
);

create table public.member_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_id)
);

-- ---------------------------------------------------------------------------
-- Push tokens and subscriptions
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform public.push_platform not null,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entitlement text not null default 'pro' check (entitlement = 'pro'),
  source public.subscription_source not null,
  status public.subscription_status not null,
  product_id text,
  expires_at timestamptz,
  rc_customer_id text,
  granted_by_user_id uuid references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, source, granted_by_user_id)
);

create table public.team_subscriptions (
  team_id uuid primary key references public.teams (id) on delete cascade,
  payer_user_id uuid references public.profiles (id) on delete set null,
  product text not null default 'team' check (product = 'team'),
  status public.subscription_status not null,
  expires_at timestamptz,
  rc_customer_id text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.user_gyms enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.sessions enable row level security;
alter table public.weeks enable row level security;
alter table public.week_results enable row level security;
alter table public.skip_cards enable row level security;
alter table public.spots enable row level security;
alter table public.jokers enable row level security;
alter table public.belts enable row level security;
alter table public.duo_streaks enable row level security;
alter table public.member_reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.subscriptions enable row level security;
alter table public.team_subscriptions enable row level security;

-- Table privileges for the client role (RLS then filters rows).
revoke all on all tables in schema public from anon, authenticated;
grant select on
  public.profiles, public.gyms, public.user_gyms, public.teams, public.team_members,
  public.sessions, public.weeks, public.week_results, public.skip_cards, public.spots,
  public.jokers, public.belts, public.duo_streaks, public.push_tokens,
  public.subscriptions, public.team_subscriptions
to authenticated;
grant update (pseudo, avatar_url, title, onboarding_answers, onboarded_at,
              sound_enabled, haptics_enabled, notification_prefs)
  on public.profiles to authenticated;
grant insert, update, delete on public.push_tokens to authenticated;
grant insert on public.member_reports to authenticated;
grant delete on public.team_members to authenticated;
grant all on all tables in schema public to service_role;

-- profiles: me + teammates.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app_private.shares_team_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- gyms: public places, readable by any signed-in player. Written by search-gyms only.
create policy gyms_select on public.gyms for select to authenticated using (true);

-- user_gyms: only me (teammates never learn where I train).
create policy user_gyms_select_self on public.user_gyms for select to authenticated
  using (user_id = (select auth.uid()));

-- teams / members: members only.
create policy teams_select_member on public.teams for select to authenticated
  using (app_private.is_team_member(id));
create policy team_members_select on public.team_members for select to authenticated
  using (app_private.is_team_member(team_id));
-- A member may leave; the owner may remove a member. The owner leaves through leave_team().
create policy team_members_delete on public.team_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role = 'member')
    or (role = 'member' and app_private.is_team_owner(team_id))
  );

-- sessions: only my own rows. Teammates get aggregates through team_board().
create policy sessions_select_self on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));

-- weeks & co: members of the team.
create policy weeks_select_member on public.weeks for select to authenticated
  using (app_private.is_team_member(team_id));
create policy week_results_select_member on public.week_results for select to authenticated
  using (exists (select 1 from public.weeks w where w.id = week_id and app_private.is_team_member(w.team_id)));
create policy skip_cards_select_member on public.skip_cards for select to authenticated
  using (app_private.is_team_member(team_id));
create policy belts_select_member on public.belts for select to authenticated
  using (app_private.is_team_member(team_id));
create policy duo_streaks_select_member on public.duo_streaks for select to authenticated
  using (app_private.is_team_member(team_id));
create policy team_subscriptions_select_member on public.team_subscriptions for select to authenticated
  using (app_private.is_team_member(team_id));

-- spots: sender or receiver.
create policy spots_select_party on public.spots for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));

-- jokers: me + teammates (the team sees who is injured).
create policy jokers_select on public.jokers for select to authenticated
  using (user_id = (select auth.uid()) or app_private.shares_team_with(user_id));

-- push tokens: fully mine.
create policy push_tokens_all_self on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- subscriptions: mine.
create policy subscriptions_select_self on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- reports: a member reports another member of the same team. Nobody reads them from the app.
create policy member_reports_insert on public.member_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and app_private.is_team_member(team_id)
    and exists (select 1 from public.team_members m where m.team_id = member_reports.team_id and m.user_id = reported_id)
  );

-- ---------------------------------------------------------------------------
-- Helper execution rights
-- ---------------------------------------------------------------------------
revoke all on all functions in schema app_private from public;
grant execute on function
  app_private.is_team_member(uuid), app_private.is_team_owner(uuid), app_private.shares_team_with(uuid),
  app_private.paris_date(timestamptz), app_private.monday_of(date),
  app_private.game_week_start(timestamptz), app_private.week_deadline(date)
to authenticated, service_role;
grant execute on all functions in schema app_private to service_role;
