-- Phase 6: "spot" (nudge a teammate who has not trained yet today).
-- Limits: 3 spots sent per day per player, 1 spot per day from the same person to the same
-- person (unique constraint), only towards a teammate who has not done today's session and
-- has no injury joker this week.

create function app_private.send_spot(p_from uuid, p_to uuid, p_team uuid)
returns table (spot_id uuid, sent_today int, from_pseudo text)
language plpgsql security definer set search_path = ''
as $$
declare
  today date := app_private.paris_date(now());
  wk date := app_private.game_week_start(now());
  sent int;
  new_id uuid;
begin
  if p_from = p_to then
    raise exception 'cannot_spot_self' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.team_members where team_id = p_team and user_id = p_from)
     or not exists (select 1 from public.team_members where team_id = p_team and user_id = p_to) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.sessions
              where user_id = p_to and local_date = today and validated_at is not null) then
    raise exception 'already_trained_today' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.jokers where user_id = p_to and week_start = wk) then
    raise exception 'player_has_joker' using errcode = 'P0001';
  end if;

  -- Serialise this sender's spots of the day so the daily cap holds under concurrency.
  perform pg_advisory_xact_lock(hashtext('spot:' || p_from::text || ':' || today::text));
  select count(*) into sent from public.spots where from_user = p_from and local_date = today;
  if sent >= 3 then
    raise exception 'spot_daily_limit' using errcode = 'P0001';
  end if;

  begin
    insert into public.spots (from_user, to_user, team_id, local_date)
    values (p_from, p_to, p_team, today)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'already_spotted_today' using errcode = 'P0001';
  end;

  return query
  select new_id, sent + 1, (select pseudo from public.profiles where id = p_from);
end $$;

-- Push tokens of one player for one notification type (respects their preference).
create function app_private.user_push_targets(p_user uuid, p_pref text)
returns table (token text)
language sql stable security definer set search_path = ''
as $$
  select pt.token
  from public.push_tokens pt
  join public.profiles p on p.id = pt.user_id
  where pt.user_id = p_user and coalesce((p.notification_prefs ->> p_pref)::boolean, true)
$$;

revoke all on function app_private.send_spot(uuid, uuid, uuid), app_private.user_push_targets(uuid, text)
  from public;
grant execute on function app_private.send_spot(uuid, uuid, uuid), app_private.user_push_targets(uuid, text)
  to service_role;

create function public.svc_send_spot(p_from uuid, p_to uuid, p_team uuid)
returns table (spot_id uuid, sent_today int, from_pseudo text)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.send_spot(p_from, p_to, p_team) $$;

create function public.svc_user_push_targets(p_user uuid, p_pref text)
returns table (token text)
language sql stable security definer set search_path = ''
as $$ select * from app_private.user_push_targets(p_user, p_pref) $$;

revoke all on function public.svc_send_spot(uuid, uuid, uuid), public.svc_user_push_targets(uuid, text)
  from public, anon, authenticated;
grant execute on function public.svc_send_spot(uuid, uuid, uuid), public.svc_user_push_targets(uuid, text)
  to service_role;

-- What the app needs to draw spot buttons: how many I sent today, and to whom.
create function public.my_spots_today()
returns table (to_user uuid)
language sql stable security definer set search_path = ''
as $$
  select s.to_user from public.spots s
  where s.from_user = (select auth.uid()) and s.local_date = app_private.paris_date(now())
$$;
revoke all on function public.my_spots_today() from public, anon;
grant execute on function public.my_spots_today() to authenticated, service_role;
