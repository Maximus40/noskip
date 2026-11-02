-- Narrow, validated entry points for client writes (SECURITY DEFINER, search_path pinned).
-- Every function checks auth.uid() itself; errors use stable codes the app maps to French copy.

create function app_private.require_uid() returns uuid
language plpgsql stable
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end $$;

-- Goal in force for a given week (pending goal applies from goal_effective_from).
create function app_private.effective_goal(p_user uuid, p_week_start date) returns smallint
language sql stable security definer set search_path = ''
as $$
  select case
    when p.pending_weekly_goal is not null and p.goal_effective_from <= p_week_start
      then p.pending_weekly_goal
    else p.weekly_goal
  end
  from public.profiles p where p.id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Goal: immediate while the player has no history, otherwise from next Monday.
-- ---------------------------------------------------------------------------
create function public.set_weekly_goal(p_goal integer) returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  has_history boolean;
  next_monday date := app_private.game_week_start(now()) + 7;
  result public.profiles;
begin
  if p_goal is null or p_goal not between 2 and 5 then
    raise exception 'invalid_goal' using errcode = '22023';
  end if;

  select exists (select 1 from public.sessions where user_id = uid and validated_at is not null)
      or exists (select 1 from public.week_results where user_id = uid)
    into has_history;

  if has_history then
    update public.profiles
       set pending_weekly_goal = case when p_goal = weekly_goal then null else p_goal end,
           goal_effective_from = case when p_goal = weekly_goal then null else next_monday end
     where id = uid
    returning * into result;
  else
    update public.profiles
       set weekly_goal = p_goal, pending_weekly_goal = null, goal_effective_from = null
     where id = uid
    returning * into result;
  end if;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Gyms: OSM gyms only (FK to gyms), max 3, primary change once every 30 days.
-- ---------------------------------------------------------------------------
create function public.choose_gym(p_gym_id uuid, p_make_primary boolean default true)
returns setof public.user_gyms
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  current_primary uuid;
  last_change timestamptz;
begin
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'unknown_gym' using errcode = 'P0002';
  end if;

  select gym_id into current_primary from public.user_gyms where user_id = uid and is_primary;
  select primary_gym_changed_at into last_change from public.profiles where id = uid;

  if p_make_primary and current_primary is not null and current_primary <> p_gym_id then
    if last_change is not null and last_change > now() - interval '30 days' then
      raise exception 'primary_gym_change_too_soon' using errcode = 'P0001',
        detail = to_char(last_change + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SSOF');
    end if;
    update public.user_gyms set is_primary = false where user_id = uid and gym_id = current_primary;
    update public.profiles set primary_gym_changed_at = now() where id = uid;
  end if;

  if exists (select 1 from public.user_gyms where user_id = uid and gym_id = p_gym_id) then
    update public.user_gyms
       set is_primary = is_primary or (p_make_primary or current_primary is null)
     where user_id = uid and gym_id = p_gym_id;
  else
    insert into public.user_gyms (user_id, gym_id, is_primary)
    values (uid, p_gym_id, p_make_primary or current_primary is null);
  end if;

  return query select * from public.user_gyms where user_id = uid order by is_primary desc, chosen_at;
end $$;

create function public.remove_gym(p_gym_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if exists (select 1 from public.user_gyms where user_id = uid and gym_id = p_gym_id and is_primary) then
    raise exception 'cannot_remove_primary_gym' using errcode = 'P0001';
  end if;
  delete from public.user_gyms where user_id = uid and gym_id = p_gym_id;
end $$;

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create function public.create_team(p_name text) returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  t public.teams;
  attempts int := 0;
begin
  if p_name is null or char_length(btrim(p_name)) not between 2 and 32 then
    raise exception 'invalid_team_name' using errcode = '22023';
  end if;
  if (select count(*) from public.team_members where user_id = uid) >= 3 then
    raise exception 'max_teams_reached' using errcode = 'P0001';
  end if;

  loop
    begin
      insert into public.teams (name, created_by, invite_code)
      values (btrim(p_name), uid, app_private.new_invite_code())
      returning * into t;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 5 then raise; end if;
    end;
  end loop;

  insert into public.team_members (team_id, user_id, role, plate_color)
  values (t.id, uid, 'owner', app_private.next_plate_color(t.id));
  return t;
end $$;

create function public.accept_team_rules(p_team uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  update public.team_members set accepted_rules_at = coalesce(accepted_rules_at, now())
   where team_id = p_team and user_id = uid;
  if not found then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  update public.profiles set rules_accepted_at = coalesce(rules_accepted_at, now()) where id = uid;
end $$;

-- Owner leaving hands the team to the longest-standing member, or deletes it when alone.
create function public.leave_team(p_team uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  my_role public.team_role;
  heir uuid;
begin
  select role into my_role from public.team_members where team_id = p_team and user_id = uid;
  if my_role is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  if my_role = 'owner' then
    select user_id into heir from public.team_members
     where team_id = p_team and user_id <> uid order by joined_at limit 1;
    if heir is null then
      delete from public.teams where id = p_team;
      return;
    end if;
    delete from public.team_members where team_id = p_team and user_id = uid;
    update public.team_members set role = 'owner' where team_id = p_team and user_id = heir;
  else
    delete from public.team_members where team_id = p_team and user_id = uid;
  end if;
end $$;

create function public.delete_team(p_team uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_private.require_uid();
  if not app_private.is_team_owner(p_team) then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  delete from public.teams where id = p_team;
end $$;

-- ---------------------------------------------------------------------------
-- Sessions: the client may only open or cancel an in-progress session.
-- Validation (validated_at, duration) is done by the validate-session Edge Function.
-- ---------------------------------------------------------------------------
create function public.start_session(
  p_gym_id uuid,
  p_started_at timestamptz,
  p_source public.session_source
) returns public.sessions
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  s public.sessions;
begin
  if not exists (select 1 from public.user_gyms where user_id = uid and gym_id = p_gym_id) then
    raise exception 'gym_not_chosen' using errcode = '42501';
  end if;
  if p_started_at is null
     or p_started_at > now() + interval '5 minutes'
     or p_started_at < now() - interval '18 hours' then
    raise exception 'invalid_started_at' using errcode = '22023';
  end if;

  select * into s from public.sessions
   where user_id = uid and local_date = app_private.paris_date(p_started_at);

  if found and s.validated_at is not null then
    raise exception 'already_validated_today' using errcode = 'P0001';
  end if;

  if found then
    update public.sessions
       set gym_id = p_gym_id, source = p_source, started_at = p_started_at,
           ended_at = null, duration_min = null, cancelled_at = null
     where id = s.id
    returning * into s;
  else
    insert into public.sessions (user_id, gym_id, source, started_at, local_date)
    values (uid, p_gym_id, p_source, p_started_at, app_private.paris_date(p_started_at))
    returning * into s;
  end if;
  return s;
end $$;

create function public.cancel_session() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  update public.sessions set cancelled_at = now()
   where user_id = uid and validated_at is null and cancelled_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Team board: what teammates may know about each other this week.
-- No gym, no position, no time of day: just counts and a coarse status.
-- ---------------------------------------------------------------------------
create function public.team_board(p_team uuid)
returns table (
  user_id uuid,
  pseudo text,
  avatar_url text,
  title public.lifter_title,
  plate_color text,
  role public.team_role,
  goal smallint,
  done integer,
  today_status text,
  joker_this_week boolean,
  is_me boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  wk date := app_private.game_week_start(now());
  today date := app_private.paris_date(now());
begin
  if not app_private.is_team_member(p_team) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  return query
  select
    m.user_id,
    p.pseudo,
    p.avatar_url,
    p.title,
    m.plate_color,
    m.role,
    app_private.effective_goal(m.user_id, wk),
    (select count(*)::int from public.sessions s
      where s.user_id = m.user_id and s.validated_at is not null and s.week_start = wk),
    case
      when exists (select 1 from public.sessions s
                    where s.user_id = m.user_id and s.local_date = today and s.validated_at is not null)
        then 'done'
      when exists (select 1 from public.sessions s
                    where s.user_id = m.user_id and s.local_date = today
                      and s.validated_at is null and s.cancelled_at is null
                      and s.started_at > now() - interval '6 hours')
        then 'at_gym'
      else 'not_yet'
    end,
    exists (select 1 from public.jokers j where j.user_id = m.user_id and j.week_start = wk),
    m.user_id = uid
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  where m.team_id = p_team
  order by m.joined_at;
end $$;

create function public.increment_skip_share(p_card uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_private.require_uid();
  update public.skip_cards set shared_count = shared_count + 1
   where id = p_card and app_private.is_team_member(team_id);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Execution rights
-- ---------------------------------------------------------------------------
revoke all on function
  public.set_weekly_goal(integer), public.choose_gym(uuid, boolean), public.remove_gym(uuid),
  public.create_team(text), public.accept_team_rules(uuid), public.leave_team(uuid),
  public.delete_team(uuid), public.start_session(uuid, timestamptz, public.session_source),
  public.cancel_session(), public.team_board(uuid), public.increment_skip_share(uuid)
from public, anon;

grant execute on function
  public.set_weekly_goal(integer), public.choose_gym(uuid, boolean), public.remove_gym(uuid),
  public.create_team(text), public.accept_team_rules(uuid), public.leave_team(uuid),
  public.delete_team(uuid), public.start_session(uuid, timestamptz, public.session_source),
  public.cancel_session(), public.team_board(uuid), public.increment_skip_share(uuid)
to authenticated, service_role;

grant execute on function app_private.require_uid(), app_private.effective_goal(uuid, date)
to authenticated, service_role;
