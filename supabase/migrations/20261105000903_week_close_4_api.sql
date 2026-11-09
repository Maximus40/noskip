-- Phase 7 (4/4): service-only wrappers for the Edge Functions, and the app's reads.

create function public.svc_due_week() returns date
language sql stable security definer set search_path = ''
as $$ select app_private.game_week_start(now()) - 7 $$;

create function public.svc_teams_to_close(p_week date)
returns table (team_id uuid)
language sql stable security definer set search_path = ''
as $$ select * from app_private.teams_to_close(p_week) $$;

create function public.svc_recent_skip_lines(p_team uuid, p_limit int)
returns table (line_id text)
language sql stable security definer set search_path = ''
as $$ select * from app_private.recent_skip_lines(p_team, p_limit) $$;

create function public.svc_team_member_ids(p_team uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = ''
as $$ select m.user_id from public.team_members m where m.team_id = p_team order by m.joined_at $$;

create function public.svc_close_team_week(p_team uuid, p_week date, p_lines jsonb)
returns jsonb
language sql volatile security definer set search_path = ''
as $$ select app_private.close_team_week(p_team, p_week, p_lines) $$;

create function public.svc_week_summary(p_week_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$ select app_private.week_summary(p_week_id) $$;

create function public.svc_claim_week_notification(p_week_id uuid, p_step text) returns boolean
language sql volatile security definer set search_path = ''
as $$ select app_private.claim_week_notification(p_week_id, p_step) $$;

create function public.svc_weeks_pending_notification(p_step text)
returns table (week_id uuid)
language sql stable security definer set search_path = ''
as $$ select * from app_private.weeks_pending_notification(p_step) $$;

create function public.svc_team_push_targets(p_team uuid, p_pref text)
returns table (user_id uuid, token text)
language sql stable security definer set search_path = ''
as $$ select * from app_private.team_push_targets(p_team, p_pref) $$;

create function public.svc_claim_shaky_alerts(p_force boolean default false)
returns table (user_id uuid, pseudo text, days_left int, missing int)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.claim_shaky_alerts(now(), p_force) $$;

create function public.svc_cron_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = ''
as $$ select app_private.cron_secret_ok(p_secret) $$;

revoke all on function
  public.svc_due_week(),
  public.svc_teams_to_close(date),
  public.svc_recent_skip_lines(uuid, int),
  public.svc_team_member_ids(uuid),
  public.svc_close_team_week(uuid, date, jsonb),
  public.svc_week_summary(uuid),
  public.svc_claim_week_notification(uuid, text),
  public.svc_weeks_pending_notification(text),
  public.svc_team_push_targets(uuid, text),
  public.svc_claim_shaky_alerts(boolean),
  public.svc_cron_secret_ok(text)
from public, anon, authenticated;
grant execute on function
  public.svc_due_week(),
  public.svc_teams_to_close(date),
  public.svc_recent_skip_lines(uuid, int),
  public.svc_team_member_ids(uuid),
  public.svc_close_team_week(uuid, date, jsonb),
  public.svc_week_summary(uuid),
  public.svc_claim_week_notification(uuid, text),
  public.svc_weeks_pending_notification(text),
  public.svc_team_push_targets(uuid, text),
  public.svc_claim_shaky_alerts(boolean),
  public.svc_cron_secret_ok(text)
to service_role;

-- ---------------------------------------------------------------------------
-- App reads: a team's closed weeks (history) — plain RLS selects cover the rest.
-- ---------------------------------------------------------------------------
create function public.team_history(p_team uuid, p_limit int default 26)
returns table (
  week_id uuid, week_start date, total_kg int, skips_count int,
  is_team_pr boolean, is_record boolean, machine_pseudo text, skipper_pseudo text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app_private.require_uid();
  if not app_private.is_team_member(p_team) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return query
  select w.id, w.week_start, w.total_kg, w.skips_count, w.is_team_pr, w.is_record,
         pm.pseudo, ps.pseudo
    from public.weeks w
    left join public.profiles pm on pm.id = w.machine_user_id
    left join public.profiles ps on ps.id = w.skipper_user_id
   where w.team_id = p_team and w.closed_at is not null
   order by w.week_start desc
   limit least(greatest(p_limit, 1), 104);
end $$;

-- One week's recap / SKIP card data, readable by members of that team only. Pseudos of
-- players who have since left stay visible here (they were part of that week).
create function public.week_recap(p_week_id uuid)
returns table (
  week_id uuid, team_id uuid, team_name text, invite_code text, week_start date,
  total_kg int, skips_count int, is_team_pr boolean, is_record boolean,
  machine_user_id uuid, skipper_user_id uuid,
  user_id uuid, pseudo text, avatar_url text, plate_color text,
  goal smallint, done smallint, achieved boolean, used_joker boolean, exempt boolean,
  card_id uuid, line_id text, is_me boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  v_team uuid;
begin
  select w.team_id into v_team from public.weeks w where w.id = p_week_id;
  if v_team is null or not app_private.is_team_member(v_team) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query
  select w.id, w.team_id, t.name, t.invite_code, w.week_start,
         w.total_kg, w.skips_count, w.is_team_pr, w.is_record,
         w.machine_user_id, w.skipper_user_id,
         r.user_id, p.pseudo, p.avatar_url,
         coalesce(m.plate_color, p.plate_color),
         r.goal, r.done, r.achieved, r.used_joker, r.exempt,
         c.id, c.line_id, r.user_id = uid
    from public.weeks w
    join public.teams t on t.id = w.team_id
    join public.week_results r on r.week_id = w.id
    join public.profiles p on p.id = r.user_id
    left join public.team_members m on m.team_id = w.team_id and m.user_id = r.user_id
    left join public.skip_cards c on c.week_id = w.id and c.user_id = r.user_id
   where w.id = p_week_id
   order by r.done desc, p.pseudo;
end $$;

-- Latest closed week of a team whose recap the app can show on "Ma team".
create function public.latest_closed_week(p_team uuid)
returns table (week_id uuid, week_start date, closed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app_private.require_uid();
  if not app_private.is_team_member(p_team) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return query
  select w.id, w.week_start, w.closed_at from public.weeks w
   where w.team_id = p_team and w.closed_at is not null
   order by w.week_start desc limit 1;
end $$;

-- A card id → its week (deep link from the SKIP push).
create function public.skip_card_week(p_card uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v uuid;
begin
  perform app_private.require_uid();
  select c.week_id into v from public.skip_cards c
   where c.id = p_card and app_private.is_team_member(c.team_id);
  if v is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v;
end $$;

revoke all on function public.team_history(uuid, int), public.week_recap(uuid),
  public.latest_closed_week(uuid), public.skip_card_week(uuid) from public, anon;
grant execute on function public.team_history(uuid, int), public.week_recap(uuid),
  public.latest_closed_week(uuid), public.skip_card_week(uuid) to authenticated, service_role;
