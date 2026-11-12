-- "Un pote paie, toute la team joue": a player who pays for their own plan (annual or weekly,
-- trial included) also covers the other members of ONE team: their oldest team (the first one
-- they created or joined), as long as it has 4 players or fewer. Invitees play for free;
-- the Team plan (team_subscriptions) still covers teams of 5 to 8.
-- The Pack Duo is no longer sold. Existing Duo rows keep working until they expire.

-- The team a paying player covers: the first one they joined (ties: lowest team id).
create function app_private.crew_team(p_payer uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.team_id from public.team_members m
   where m.user_id = p_payer
   order by m.joined_at, m.team_id
   limit 1
$$;

-- Who covers p_user through the crew rule (the payer met first), null if nobody.
create function app_private.crew_sponsor(p_user uuid)
returns table (payer_id uuid, team_id uuid)
language sql stable security definer set search_path = ''
as $$
  select payer.user_id, me.team_id
    from public.team_members me
    join public.team_members payer on payer.team_id = me.team_id and payer.user_id <> me.user_id
   where me.user_id = p_user
     and app_private.crew_team(payer.user_id) = me.team_id
     and exists (
       select 1 from public.subscriptions s
        where s.user_id = payer.user_id and s.granted_by_user_id is null
          and s.source in ('individual', 'duo')
          and app_private.sub_is_active(s.status, s.expires_at))
     and (select count(*) from public.team_members c where c.team_id = me.team_id) <= 4
   order by payer.joined_at, payer.user_id
   limit 1
$$;

create or replace function app_private.has_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user and app_private.sub_is_active(s.status, s.expires_at))
    or exists (
      select 1 from public.team_subscriptions ts
      join public.team_members m on m.team_id = ts.team_id and m.user_id = p_user
       where app_private.sub_is_active(ts.status, ts.expires_at))
    or exists (select 1 from app_private.crew_sponsor(p_user))
$$;

-- What the app shows. Crew coverage comes back as source 'individual' with offered_by set
-- (the payer's pseudo) and the covered team's name. A payer sees the team they cover.
create or replace function public.my_entitlement()
returns table (
  active boolean, source public.subscription_source, expires_at timestamptz,
  offered_by text, team_name text, is_payer boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  return query
  with options as (
    select s.source, s.expires_at,
           case when s.granted_by_user_id is not null
                then (select p.pseudo from public.profiles p where p.id = s.granted_by_user_id) end as offered_by,
           case when s.granted_by_user_id is null and s.source in ('individual', 'duo')
                then (select t.name from public.teams t where t.id = app_private.crew_team(uid)) end as team_name,
           s.granted_by_user_id is null as is_payer,
           case when s.granted_by_user_id is null then 0 else 1 end as rank
      from public.subscriptions s
     where s.user_id = uid and app_private.sub_is_active(s.status, s.expires_at)
    union all
    select 'team'::public.subscription_source, ts.expires_at,
           case when ts.payer_user_id <> uid
                then (select p.pseudo from public.profiles p where p.id = ts.payer_user_id) end,
           t.name,
           ts.payer_user_id = uid,
           2
      from public.team_subscriptions ts
      join public.team_members m on m.team_id = ts.team_id and m.user_id = uid
      join public.teams t on t.id = ts.team_id
     where app_private.sub_is_active(ts.status, ts.expires_at)
    union all
    select 'individual'::public.subscription_source, s.expires_at,
           (select p.pseudo from public.profiles p where p.id = cs.payer_id),
           (select t.name from public.teams t where t.id = cs.team_id),
           false,
           3
      from app_private.crew_sponsor(uid) cs
      join public.subscriptions s on s.user_id = cs.payer_id and s.granted_by_user_id is null
                                 and s.source in ('individual', 'duo')
                                 and app_private.sub_is_active(s.status, s.expires_at)
  )
  select true, o.source, o.expires_at, o.offered_by, o.team_name, o.is_payer
    from options o order by o.rank, o.expires_at desc nulls first limit 1;
  if not found then
    return query select false, null::public.subscription_source, null::timestamptz, null::text,
                        null::text, false;
  end if;
end $$;

revoke all on function app_private.crew_team(uuid), app_private.crew_sponsor(uuid) from public;
grant execute on function app_private.crew_team(uuid), app_private.crew_sponsor(uuid)
  to authenticated, service_role;
