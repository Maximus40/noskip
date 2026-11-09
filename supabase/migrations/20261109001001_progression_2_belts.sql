-- Phase 8 (2/3): seasons (calendar months). On the 1st at 10:00 Paris, each team awards
-- the Ceinture (most regular player: goal-reached rate over the month's closed weeks,
-- tie-break on sessions) and the "Gros Canap'" trophy (most SKIP cards, for laughs).
-- A week belongs to the month of its Monday. Joker and late-join weeks do not count.

alter table public.belts add column notified_at timestamptz;

create function app_private.award_team_belts(p_team uuid, p_month date)
returns table (type public.belt_type, user_id uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if extract(day from p_month) <> 1 then
    raise exception 'invalid_month' using errcode = '22023';
  end if;
  if p_month >= date_trunc('month', app_private.paris_date(now()))::date then
    raise exception 'month_not_over' using errcode = 'P0001';
  end if;

  return query
  with stats as (
    select
      r.user_id,
      m.joined_at,
      count(*) filter (where not r.used_joker and not r.exempt) as counted,
      count(*) filter (where r.achieved and not r.used_joker and not r.exempt) as achieved_n,
      coalesce(sum(r.done), 0) as sessions,
      count(c.id) as skips
    from public.weeks w
    join public.week_results r on r.week_id = w.id
    join public.team_members m on m.team_id = w.team_id and m.user_id = r.user_id
    left join public.skip_cards c on c.week_id = w.id and c.user_id = r.user_id
    where w.team_id = p_team
      and w.closed_at is not null
      and w.week_start >= p_month
      and w.week_start < (p_month + interval '1 month')::date
    group by r.user_id, m.joined_at
  ),
  belt as (
    select s.user_id from stats s
     where s.counted > 0 and s.achieved_n > 0
     order by s.achieved_n::numeric / s.counted desc, s.sessions desc, s.joined_at
     limit 1
  ),
  big_canap as (
    select s.user_id from stats s
     where s.skips > 0
     order by s.skips desc, s.sessions, s.joined_at
     limit 1
  ),
  inserted as (
    insert into public.belts (team_id, month, type, user_id)
    select p_team, p_month, 'belt'::public.belt_type, b.user_id from belt b
    union all
    select p_team, p_month, 'big_canap'::public.belt_type, g.user_id from big_canap g
    on conflict (team_id, month, type) do nothing
    returning type, user_id
  )
  select i.type, i.user_id from inserted i;
end $$;

-- Teams with at least one closed week in the month.
create function app_private.teams_for_belts(p_month date)
returns table (team_id uuid)
language sql stable security definer set search_path = ''
as $$
  select distinct w.team_id from public.weeks w
  where w.closed_at is not null
    and w.week_start >= p_month
    and w.week_start < (p_month + interval '1 month')::date
$$;

-- The month to award: the previous one, once the 1st at 10:00 Paris has passed.
create function app_private.due_belt_month(p_now timestamptz, p_force boolean)
returns date
language sql stable set search_path = ''
as $$
  select case
    when not p_force
         and extract(day from (p_now at time zone 'Europe/Paris')) = 1
         and extract(hour from (p_now at time zone 'Europe/Paris')) < 10
      then null
    else (date_trunc('month', app_private.paris_date(p_now)) - interval '1 month')::date
  end
$$;

-- Belts awarded in the last 3 days whose push has not been sent yet.
create function app_private.pending_belts()
returns table (team_id uuid, team_name text, month date, type public.belt_type, user_id uuid, pseudo text)
language sql stable security definer set search_path = ''
as $$
  select b.team_id, t.name, b.month, b.type, b.user_id, p.pseudo
  from public.belts b
  join public.teams t on t.id = b.team_id
  join public.profiles p on p.id = b.user_id
  where b.notified_at is null and b.awarded_at > now() - interval '3 days'
  order by b.awarded_at, b.team_id, b.type
$$;

create function app_private.claim_belt_notification(p_team uuid, p_month date, p_type public.belt_type)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.belts set notified_at = now()
   where team_id = p_team and month = p_month and type = p_type and notified_at is null;
  return found;
end $$;

revoke all on function
  app_private.award_team_belts(uuid, date),
  app_private.teams_for_belts(date),
  app_private.due_belt_month(timestamptz, boolean),
  app_private.pending_belts(),
  app_private.claim_belt_notification(uuid, date, public.belt_type)
from public;
grant execute on function
  app_private.award_team_belts(uuid, date),
  app_private.teams_for_belts(date),
  app_private.due_belt_month(timestamptz, boolean),
  app_private.pending_belts(),
  app_private.claim_belt_notification(uuid, date, public.belt_type)
to service_role;

create function public.svc_due_belt_month(p_force boolean default false) returns date
language sql stable security definer set search_path = ''
as $$ select app_private.due_belt_month(now(), p_force) $$;

create function public.svc_teams_for_belts(p_month date)
returns table (team_id uuid)
language sql stable security definer set search_path = ''
as $$ select * from app_private.teams_for_belts(p_month) $$;

create function public.svc_award_team_belts(p_team uuid, p_month date)
returns table (type public.belt_type, user_id uuid)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.award_team_belts(p_team, p_month) $$;

create function public.svc_pending_belts()
returns table (team_id uuid, team_name text, month date, type public.belt_type, user_id uuid, pseudo text)
language sql stable security definer set search_path = ''
as $$ select * from app_private.pending_belts() $$;

create function public.svc_claim_belt_notification(p_team uuid, p_month date, p_type public.belt_type)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select app_private.claim_belt_notification(p_team, p_month, p_type) $$;

revoke all on function
  public.svc_due_belt_month(boolean),
  public.svc_teams_for_belts(date),
  public.svc_award_team_belts(uuid, date),
  public.svc_pending_belts(),
  public.svc_claim_belt_notification(uuid, date, public.belt_type)
from public, anon, authenticated;
grant execute on function
  public.svc_due_belt_month(boolean),
  public.svc_teams_for_belts(date),
  public.svc_award_team_belts(uuid, date),
  public.svc_pending_belts(),
  public.svc_claim_belt_notification(uuid, date, public.belt_type)
to service_role;
