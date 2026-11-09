-- Phase 8 (1/3): injury joker and the lifter card.

-- Joker blessure: 1 per month (month of the week's Monday), for the current game week, before
-- Sunday 20:00 (after that, the current game week is already the next one). Idempotent.
create function public.declare_joker()
returns table (week_start date, month date)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := app_private.require_uid();
  wk date := app_private.game_week_start(now());
  m date := date_trunc('month', wk)::date;
  done int;
begin
  if exists (select 1 from public.jokers j where j.user_id = uid and j.week_start = wk) then
    return query select wk, m;
    return;
  end if;
  if exists (select 1 from public.jokers j where j.user_id = uid and j.month = m) then
    raise exception 'joker_already_used' using errcode = 'P0001';
  end if;
  select count(*)::int into done from public.sessions s
   where s.user_id = uid and s.validated_at is not null and s.week_start = wk;
  if done >= app_private.effective_goal(uid, wk) then
    raise exception 'goal_already_reached' using errcode = 'P0001';
  end if;
  insert into public.jokers (user_id, month, week_start) values (uid, m, wk);
  return query select wk, m;
end $$;

-- Everything the lifter card shows, for me or a teammate. The weekly history (closed weeks
-- only, merged across teams) lets the app compute the streak with the tested domain logic.
create function public.lifter_card(p_user uuid default null)
returns table (
  user_id uuid, pseudo text, avatar_url text, title public.lifter_title, plate_color text,
  lifetime_sessions int, skips_total int, belts jsonb, history jsonb,
  joker_this_week boolean, joker_month_used boolean, is_me boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  target uuid := coalesce(p_user, uid);
  wk date := app_private.game_week_start(now());
begin
  if target <> uid and not app_private.shares_team_with(target) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query
  select
    p.id, p.pseudo, p.avatar_url, p.title, p.plate_color, p.lifetime_sessions,
    (select count(distinct w.week_start)::int
       from public.skip_cards c join public.weeks w on w.id = c.week_id
      where c.user_id = target),
    coalesce((
      select jsonb_agg(jsonb_build_object('type', b.type, 'month', b.month, 'team_name', t.name)
                       order by b.month desc, b.type)
        from public.belts b join public.teams t on t.id = b.team_id
       where b.user_id = target), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('week_start', h.week_start, 'achieved', h.achieved,
                                          'used_joker', h.used_joker, 'exempt', h.exempt)
                       order by h.week_start desc)
        from (
          select w.week_start,
                 bool_or(r.achieved) as achieved,
                 bool_or(r.used_joker) as used_joker,
                 bool_and(r.exempt) as exempt
            from public.week_results r join public.weeks w on w.id = r.week_id
           where r.user_id = target
           group by w.week_start
           order by w.week_start desc
           limit 104
        ) h), '[]'::jsonb),
    exists (select 1 from public.jokers j where j.user_id = target and j.week_start = wk),
    exists (select 1 from public.jokers j
             where j.user_id = target and j.month = date_trunc('month', wk)::date),
    target = uid
  from public.profiles p
  where p.id = target;
end $$;

revoke all on function public.declare_joker(), public.lifter_card(uuid) from public, anon;
grant execute on function public.declare_joker(), public.lifter_card(uuid) to authenticated, service_role;
