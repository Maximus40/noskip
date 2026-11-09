-- Phase 7 (2/4): closing logic, notification claims, "la barre tremble".

-- ---------------------------------------------------------------------------
-- Per-player result of a week for one team
-- ---------------------------------------------------------------------------
-- Calendar days of the week still usable when the player joined (Monday = 7 … Sunday = 1).
create function app_private.days_left_at(p_ts timestamptz, p_week date) returns int
language sql immutable parallel safe
as $$
  select case
    when p_ts < (p_week::timestamp at time zone 'Europe/Paris') then 7
    else 8 - extract(isodow from (p_ts at time zone 'Europe/Paris'))::int
  end
$$;

create function app_private.team_week_players(p_team uuid, p_week date)
returns table (
  user_id uuid, pseudo text, joined_at timestamptz,
  goal smallint, done int, used_joker boolean, exempt boolean, achieved boolean
)
language sql stable security definer set search_path = ''
as $$
  with base as (
    select
      m.user_id,
      p.pseudo,
      m.joined_at,
      app_private.effective_goal(m.user_id, p_week) as goal,
      (select count(*)::int from public.sessions s
        where s.user_id = m.user_id and s.validated_at is not null and s.week_start = p_week) as done,
      exists (select 1 from public.jokers j
               where j.user_id = m.user_id and j.week_start = p_week) as used_joker
    from public.team_members m
    join public.profiles p on p.id = m.user_id
    where m.team_id = p_team
      and m.joined_at < app_private.week_deadline(p_week)
  )
  select
    b.user_id, b.pseudo, b.joined_at, b.goal, b.done, b.used_joker,
    (b.done < b.goal and app_private.days_left_at(b.joined_at, p_week) < b.goal) as exempt,
    b.done >= b.goal as achieved
  from base b
$$;

-- ---------------------------------------------------------------------------
-- Closing one team's week. Idempotent: a closed week is returned as is.
-- p_lines maps user_id → SKIP line id, drawn by the Edge Function (no recent repeats).
-- ---------------------------------------------------------------------------
create function app_private.close_team_week(p_team uuid, p_week date, p_lines jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  w public.weeks;
  deadline timestamptz := app_private.week_deadline(p_week);
  n_players int;
  n_counted int;
  n_achieved int;
  v_total int;
  v_skips int;
  v_all boolean;
  v_best int;
  v_record boolean;
  v_machine uuid;
  v_skipper uuid;
  v_next int;
begin
  if extract(isodow from p_week) <> 1 then
    raise exception 'invalid_week' using errcode = '22023';
  end if;
  if now() < deadline then
    raise exception 'week_not_over' using errcode = 'P0001';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'object' then
    raise exception 'invalid_lines' using errcode = '22023';
  end if;

  insert into public.weeks (team_id, week_start) values (p_team, p_week)
  on conflict (team_id, week_start) do nothing;
  select * into w from public.weeks
   where team_id = p_team and week_start = p_week
   for update;

  if w.closed_at is not null then
    return jsonb_build_object('week_id', w.id, 'newly_closed', false);
  end if;

  select count(*),
         count(*) filter (where not exempt and not used_joker),
         count(*) filter (where not exempt and not used_joker and achieved),
         coalesce(sum(done), 0) * 20
    into n_players, n_counted, n_achieved, v_total
    from app_private.team_week_players(p_team, p_week);

  -- Every player who counts reached the goal (jokers are excused, not counted).
  v_all := n_counted > 0 and n_achieved = n_counted;
  select max(total_kg) into v_best from public.weeks
   where team_id = p_team and week_start < p_week and closed_at is not null;
  v_record := v_all and v_total > coalesce(v_best, 0);

  select user_id into v_machine from app_private.team_week_players(p_team, p_week)
   where done > 0
   order by done desc, done - goal desc, joined_at
   limit 1;

  insert into public.week_results (week_id, user_id, goal, done, achieved, used_joker, exempt)
  select w.id, user_id, goal, least(done, 32767)::smallint, achieved, used_joker, exempt
    from app_private.team_week_players(p_team, p_week);

  insert into public.skip_cards (week_id, team_id, user_id, line_id)
  select w.id, p_team, cp.user_id, coalesce(p_lines ->> cp.user_id::text, 'canap-pr-sieste')
    from app_private.team_week_players(p_team, p_week) cp
   where not cp.achieved and not cp.used_joker and not cp.exempt;
  get diagnostics v_skips = row_count;

  select user_id into v_skipper from app_private.team_week_players(p_team, p_week)
   where not achieved and not used_joker and not exempt
   order by goal - done desc, done, joined_at
   limit 1;

  update public.weeks
     set closed_at = now(),
         total_kg = v_total,
         skips_count = v_skips,
         all_achieved = v_all,
         is_team_pr = v_all,
         is_record = v_record,
         machine_user_id = v_machine,
         skipper_user_id = v_skipper
   where id = w.id;

  -- Duo streak: weeks in a row where both players held their goal. A joker preserves the
  -- streak without extending it; a missed goal resets it.
  if n_players = 2 and not exists (select 1 from app_private.team_week_players(p_team, p_week) where exempt) then
    if exists (select 1 from app_private.team_week_players(p_team, p_week) where not achieved and not used_joker) then
      v_next := 0;
    else
      select case
               when d.last_week_start = p_week - 7 then d.current_weeks
               else 0
             end
        into v_next
        from public.duo_streaks d where d.team_id = p_team;
      v_next := coalesce(v_next, 0)
        + case when exists (select 1 from app_private.team_week_players(p_team, p_week) where used_joker) then 0 else 1 end;
    end if;
    insert into public.duo_streaks (team_id, current_weeks, best_weeks, last_week_start, updated_at)
    values (p_team, v_next, v_next, p_week, now())
    on conflict (team_id) do update
      set current_weeks = v_next,
          best_weeks = greatest(public.duo_streaks.best_weeks, v_next),
          last_week_start = p_week,
          updated_at = now()
      where public.duo_streaks.last_week_start is null or public.duo_streaks.last_week_start < p_week;
  end if;

  return jsonb_build_object('week_id', w.id, 'newly_closed', true);
end $$;

-- Teams whose given week is still open (created before its deadline, with at least one player).
create function app_private.teams_to_close(p_week date)
returns table (team_id uuid)
language sql stable security definer set search_path = ''
as $$
  select t.id
  from public.teams t
  where t.created_at < app_private.week_deadline(p_week)
    and exists (select 1 from public.team_members m
                 where m.team_id = t.id and m.joined_at < app_private.week_deadline(p_week))
    and not exists (select 1 from public.weeks w
                     where w.team_id = t.id and w.week_start = p_week and w.closed_at is not null)
  order by t.created_at
$$;

-- Most recent SKIP lines used by a team (the draw avoids them).
create function app_private.recent_skip_lines(p_team uuid, p_limit int)
returns table (line_id text)
language sql stable security definer set search_path = ''
as $$
  select c.line_id from public.skip_cards c
  where c.team_id = p_team
  order by c.created_at desc, c.id
  limit greatest(p_limit, 0)
$$;

-- Everything the close/recap pushes need about a closed week.
create function app_private.week_summary(p_week_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'week_id', w.id,
    'team_id', w.team_id,
    'team_name', t.name,
    'week_start', w.week_start,
    'total_kg', w.total_kg,
    'skips_count', w.skips_count,
    'is_team_pr', w.is_team_pr,
    'is_record', w.is_record,
    'machine_pseudo', (select pseudo from public.profiles where id = w.machine_user_id),
    'skip_cards', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', c.id, 'user_id', c.user_id, 'pseudo', p.pseudo)
                       order by c.created_at, c.id)
      from public.skip_cards c join public.profiles p on p.id = c.user_id
      where c.week_id = w.id), '[]'::jsonb)
  )
  from public.weeks w join public.teams t on t.id = w.team_id
  where w.id = p_week_id
$$;

-- Claims a notification step for a closed week. Returns false if it was already claimed,
-- so replays never send the same push twice.
create function app_private.claim_week_notification(p_week_id uuid, p_step text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_step = 'skip' then
    update public.weeks set skip_notified_at = now()
     where id = p_week_id and closed_at is not null and skip_notified_at is null;
  elsif p_step = 'recap' then
    update public.weeks set recap_sent_at = now()
     where id = p_week_id and closed_at is not null and recap_sent_at is null;
  else
    raise exception 'invalid_step' using errcode = '22023';
  end if;
  return found;
end $$;

-- Closed weeks (last 3 days) whose SKIP or recap push has not been claimed yet, oldest first.
-- Lets a replay finish a run that crashed between closing and notifying.
create function app_private.weeks_pending_notification(p_step text)
returns table (week_id uuid)
language sql stable security definer set search_path = ''
as $$
  select w.id from public.weeks w
  where w.closed_at is not null
    and w.closed_at > now() - interval '3 days'
    and case p_step
          when 'skip' then w.skip_notified_at is null
          when 'recap' then w.recap_sent_at is null
          else false
        end
  order by w.closed_at, w.id
$$;

-- Push tokens of every player of a team for one notification type.
create function app_private.team_push_targets(p_team uuid, p_pref text)
returns table (user_id uuid, token text)
language sql stable security definer set search_path = ''
as $$
  select pt.user_id, pt.token
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  join public.push_tokens pt on pt.user_id = m.user_id
  where m.team_id = p_team
    and coalesce((p.notification_prefs ->> p_pref)::boolean, true)
$$;

-- ---------------------------------------------------------------------------
-- "La barre tremble": players who can only reach their goal by training every remaining
-- day. Claims the alert (one per player per Paris day) and returns who to notify.
-- Before 18:00 Paris nothing is returned unless p_force (tests, simulation).
-- ---------------------------------------------------------------------------
create function app_private.claim_shaky_alerts(p_now timestamptz, p_force boolean)
returns table (user_id uuid, pseudo text, days_left int, missing int)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  paris timestamp := p_now at time zone 'Europe/Paris';
  today date := app_private.paris_date(p_now);
  wk date := app_private.game_week_start(p_now);
begin
  if not p_force and extract(hour from paris) < 18 then
    return;
  end if;
  -- Sunday after 20:00 belongs to next week: nobody can be shaky yet.
  if wk <> app_private.monday_of(today) then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id as user_id,
      p.pseudo,
      (8 - extract(isodow from today)::int)
        - case when exists (select 1 from public.sessions s
                             where s.user_id = p.id and s.local_date = today
                               and s.validated_at is not null) then 1 else 0 end as days_left,
      app_private.effective_goal(p.id, wk)
        - (select count(*)::int from public.sessions s
            where s.user_id = p.id and s.validated_at is not null and s.week_start = wk) as missing
    from public.profiles p
    where exists (select 1 from public.team_members m where m.user_id = p.id)
      and not exists (select 1 from public.jokers j where j.user_id = p.id and j.week_start = wk)
  ),
  claimed as (
    insert into public.shaky_alerts (user_id, local_date, days_left, missing)
    select c.user_id, today, c.days_left, c.missing
      from candidates c
     where c.missing > 0 and c.missing = c.days_left
    on conflict (user_id, local_date) do nothing
    returning user_id, days_left, missing
  )
  select cl.user_id, p.pseudo, cl.days_left::int, cl.missing::int
    from claimed cl join public.profiles p on p.id = cl.user_id;
end $$;

revoke all on function
  app_private.team_week_players(uuid, date),
  app_private.close_team_week(uuid, date, jsonb),
  app_private.teams_to_close(date),
  app_private.recent_skip_lines(uuid, int),
  app_private.week_summary(uuid),
  app_private.claim_week_notification(uuid, text),
  app_private.weeks_pending_notification(text),
  app_private.team_push_targets(uuid, text),
  app_private.claim_shaky_alerts(timestamptz, boolean)
from public;
grant execute on function
  app_private.team_week_players(uuid, date),
  app_private.close_team_week(uuid, date, jsonb),
  app_private.teams_to_close(date),
  app_private.recent_skip_lines(uuid, int),
  app_private.week_summary(uuid),
  app_private.claim_week_notification(uuid, text),
  app_private.weeks_pending_notification(text),
  app_private.team_push_targets(uuid, text),
  app_private.claim_shaky_alerts(timestamptz, boolean)
to service_role;
