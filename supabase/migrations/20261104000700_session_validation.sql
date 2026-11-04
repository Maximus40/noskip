-- Phase 5: server-side session validation and anti-cheat.
--
-- The phone decides *when* a player is at the gym (geofence or two foreground checks), but the
-- server decides *whether* 40 minutes really passed: it trusts its own clock, recorded when the
-- session was opened (`server_opened_at`), never a timestamp sent by the phone.
-- No GPS data is involved: the server only sees gym_id and times.

alter table public.sessions add column server_opened_at timestamptz;
update public.sessions set server_opened_at = created_at where server_opened_at is null;
alter table public.sessions alter column server_opened_at set not null;
alter table public.sessions alter column server_opened_at set default now();

-- (Re)opening a session (new row, or start_session on a cancelled one) restarts the server clock.
create function app_private.sessions_server_clock() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.server_opened_at := now();
  elsif new.validated_at is null and (new.started_at is distinct from old.started_at
        or (old.cancelled_at is not null and new.cancelled_at is null)) then
    new.server_opened_at := now();
  else
    new.server_opened_at := old.server_opened_at;
  end if;
  return new;
end $$;

create trigger sessions_server_clock before insert or update on public.sessions
for each row execute function app_private.sessions_server_clock();

-- Grace for network latency between the geofence event and start_session reaching the server.
create function app_private.session_clock_grace() returns interval
language sql immutable set search_path = '' as $$ select interval '5 minutes' $$;

-- Validates the player's open session. Returns the validated row and weekly progress.
-- p_demo skips the server-clock check; only the Edge Function may pass it, and only when the
-- deployment explicitly allows demo sessions (development projects).
create function app_private.validate_session(
  p_user uuid,
  p_gym uuid,
  p_ended_at timestamptz,
  p_demo boolean default false
)
returns table (
  session_id uuid,
  validated_at timestamptz,
  duration_min int,
  week_start date,
  done_this_week int,
  goal smallint,
  lifetime_sessions int
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  s public.sessions;
  ended timestamptz;
  effective_start timestamptz;
  minutes int;
begin
  select * into s from public.sessions
   where user_id = p_user and validated_at is null and cancelled_at is null
     and started_at > now() - interval '18 hours'
   order by started_at desc
   limit 1
   for update;

  if not found then
    if exists (select 1 from public.sessions
                where user_id = p_user and validated_at is not null
                  and local_date = app_private.paris_date(now())) then
      raise exception 'already_validated_today' using errcode = 'P0001';
    end if;
    raise exception 'no_open_session' using errcode = 'P0002';
  end if;

  if s.gym_id <> p_gym
     or not exists (select 1 from public.user_gyms where user_id = p_user and gym_id = p_gym) then
    raise exception 'gym_mismatch' using errcode = '42501';
  end if;

  if exists (select 1 from public.sessions
              where user_id = p_user and validated_at is not null and local_date = s.local_date) then
    raise exception 'already_validated_today' using errcode = 'P0001';
  end if;

  -- The end can never be in the future, nor before the start.
  ended := least(coalesce(p_ended_at, now()), now());
  if ended <= s.started_at then
    raise exception 'invalid_ended_at' using errcode = '22023';
  end if;

  effective_start := case
    when p_demo then s.started_at
    else greatest(s.started_at, s.server_opened_at - app_private.session_clock_grace())
  end;
  minutes := floor(extract(epoch from (ended - effective_start)) / 60)::int;
  if minutes < 40 then
    raise exception 'session_too_short' using errcode = 'P0001',
      detail = greatest(minutes, 0)::text;
  end if;
  minutes := least(minutes, 360);

  update public.sessions
     set ended_at = ended, duration_min = minutes, validated_at = now()
   where id = s.id
  returning * into s;

  update public.profiles set lifetime_sessions = lifetime_sessions + 1 where id = p_user;

  return query
  select s.id, s.validated_at, s.duration_min, s.week_start,
         (select count(*)::int from public.sessions x
           where x.user_id = p_user and x.validated_at is not null and x.week_start = s.week_start),
         app_private.effective_goal(p_user, s.week_start),
         (select p.lifetime_sessions from public.profiles p where p.id = p_user);
end $$;

-- Teammates to notify for an event, honouring each recipient's notification preference.
-- Never returns the actor. `p_pref` is a key of profiles.notification_prefs.
create function app_private.teammate_push_targets(p_user uuid, p_pref text)
returns table (user_id uuid, token text, team_id uuid)
language sql stable security definer set search_path = ''
as $$
  select distinct on (pt.token) other.user_id, pt.token, other.team_id
  from public.team_members me
  join public.team_members other on other.team_id = me.team_id and other.user_id <> me.user_id
  join public.profiles p on p.id = other.user_id
  join public.push_tokens pt on pt.user_id = other.user_id
  where me.user_id = p_user
    and coalesce((p.notification_prefs ->> p_pref)::boolean, true)
  order by pt.token, other.team_id
$$;

revoke all on function app_private.sessions_server_clock(), app_private.session_clock_grace(),
  app_private.validate_session(uuid, uuid, timestamptz, boolean),
  app_private.teammate_push_targets(uuid, text) from public;
grant execute on function app_private.session_clock_grace() to authenticated, service_role;
grant execute on function app_private.validate_session(uuid, uuid, timestamptz, boolean),
  app_private.teammate_push_targets(uuid, text) to service_role;

-- Service-only wrappers for Edge Functions (PostgREST only exposes `public`).
create function public.svc_validate_session(
  p_user uuid, p_gym uuid, p_ended_at timestamptz, p_demo boolean default false
)
returns table (
  session_id uuid, validated_at timestamptz, duration_min int, week_start date,
  done_this_week int, goal smallint, lifetime_sessions int
)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.validate_session(p_user, p_gym, p_ended_at, p_demo) $$;

create function public.svc_teammate_push_targets(p_user uuid, p_pref text)
returns table (user_id uuid, token text, team_id uuid)
language sql stable security definer set search_path = ''
as $$ select * from app_private.teammate_push_targets(p_user, p_pref) $$;

create function public.svc_delete_push_tokens(p_tokens text[]) returns void
language sql volatile security definer set search_path = ''
as $$ delete from public.push_tokens where token = any (p_tokens) $$;

revoke all on function public.svc_validate_session(uuid, uuid, timestamptz, boolean),
  public.svc_teammate_push_targets(uuid, text), public.svc_delete_push_tokens(text[])
  from public, anon, authenticated;
grant execute on function public.svc_validate_session(uuid, uuid, timestamptz, boolean),
  public.svc_teammate_push_targets(uuid, text), public.svc_delete_push_tokens(text[])
  to service_role;

-- The open session of the caller (for the "Séance en cours" screen after an app restart).
create function public.my_open_session()
returns table (id uuid, gym_id uuid, source public.session_source, started_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.gym_id, s.source, s.started_at
  from public.sessions s
  where s.user_id = (select auth.uid())
    and s.validated_at is null and s.cancelled_at is null
    and s.started_at > now() - interval '18 hours'
  order by s.started_at desc
  limit 1
$$;
revoke all on function public.my_open_session() from public, anon;
grant execute on function public.my_open_session() to authenticated, service_role;
