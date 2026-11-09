-- Phase 10: paid plans synced from RevenueCat (webhook → Edge Function → here).
--   * individual (Pro annual / weekly): a row for the payer;
--   * duo (Pack Duo): a row for the payer + a row for ONE partner (granted_by = payer);
--   * team (Team plan): team_subscriptions for the team (Pro for every member, cap 8) + a row
--     for the payer so they keep Pro even if they leave the team.
-- Rows are written by the webhook only (service role). Replays and out-of-order events are
-- harmless: each event id is recorded once, and an older event never overwrites a newer one.

alter table public.subscriptions add column last_event_at timestamptz;
alter table public.team_subscriptions add column last_event_at timestamptz;

create table public.rc_events (
  id text primary key,
  type text not null,
  app_user_id text,
  received_at timestamptz not null default now()
);
alter table public.rc_events enable row level security;
revoke all on public.rc_events from anon, authenticated;
grant select, insert on public.rc_events to service_role;

-- A subscription grants access until it expires (cancelled = will not renew, still paid).
create function app_private.sub_is_active(p_status public.subscription_status, p_expires timestamptz)
returns boolean
language sql stable set search_path = ''
as $$ select p_status <> 'expired' and (p_expires is null or p_expires > now()) $$;

create function app_private.has_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user and app_private.sub_is_active(s.status, s.expires_at))
    or exists (
      select 1 from public.team_subscriptions ts
      join public.team_members m on m.team_id = ts.team_id and m.user_id = p_user
       where app_private.sub_is_active(ts.status, ts.expires_at))
$$;

-- Duo partner: the requested teammate if valid, otherwise the teammate met first.
create function app_private.pick_duo_partner(p_payer uuid, p_wanted uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p_wanted where p_wanted is not null and p_wanted <> p_payer and exists (
       select 1 from public.team_members a join public.team_members b on b.team_id = a.team_id
        where a.user_id = p_payer and b.user_id = p_wanted)),
    (select b.user_id from public.team_members a
       join public.team_members b on b.team_id = a.team_id and b.user_id <> a.user_id
      where a.user_id = p_payer
      order by greatest(a.joined_at, b.joined_at), b.joined_at
      limit 1))
$$;

-- Team plan: the requested team if the payer is in it, otherwise the payer's oldest team.
create function app_private.pick_paid_team(p_payer uuid, p_wanted uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p_wanted where exists (
       select 1 from public.team_members m where m.team_id = p_wanted and m.user_id = p_payer)),
    (select m.team_id from public.team_members m where m.user_id = p_payer order by m.joined_at limit 1))
$$;

create function app_private.upsert_subscription(
  p_user uuid, p_source public.subscription_source, p_granted_by uuid,
  p_status public.subscription_status, p_product text, p_expires timestamptz,
  p_event_at timestamptz, p_rc_customer text
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.subscriptions
    (user_id, source, granted_by_user_id, status, product_id, expires_at, rc_customer_id,
     last_event_at, updated_at)
  values (p_user, p_source, p_granted_by, p_status, p_product, p_expires, p_rc_customer, p_event_at, now())
  on conflict (user_id, source, granted_by_user_id) do update
    set status = excluded.status,
        product_id = excluded.product_id,
        expires_at = excluded.expires_at,
        rc_customer_id = excluded.rc_customer_id,
        last_event_at = excluded.last_event_at,
        updated_at = now()
    where public.subscriptions.last_event_at is null
       or public.subscriptions.last_event_at <= excluded.last_event_at
$$;

create function app_private.apply_rc_event(
  p_event_id text, p_type text, p_user uuid, p_plan text,
  p_status public.subscription_status, p_product text, p_expires timestamptz,
  p_event_at timestamptz, p_rc_customer text, p_partner uuid, p_team uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_partner uuid;
  v_team uuid;
begin
  insert into public.rc_events (id, type, app_user_id) values (p_event_id, p_type, p_user::text)
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ignored', 'unknown_user');
  end if;

  if p_plan = 'individual' then
    perform app_private.upsert_subscription(p_user, 'individual', null, p_status, p_product,
                                            p_expires, p_event_at, p_rc_customer);
    return jsonb_build_object('applied', 'individual');

  elsif p_plan = 'duo' then
    perform app_private.upsert_subscription(p_user, 'duo', null, p_status, p_product,
                                            p_expires, p_event_at, p_rc_customer);
    -- Keep the partner already granted unless another one is asked for explicitly.
    select s.user_id into v_partner from public.subscriptions s
     where s.granted_by_user_id = p_user and s.source = 'duo'
       and app_private.sub_is_active(s.status, s.expires_at)
     limit 1;
    if p_partner is not null or v_partner is null then
      v_partner := coalesce(app_private.pick_duo_partner(p_user, p_partner), v_partner);
    end if;
    if v_partner is not null then
      update public.subscriptions set status = 'expired', updated_at = now()
       where granted_by_user_id = p_user and source = 'duo' and user_id <> v_partner;
      perform app_private.upsert_subscription(v_partner, 'duo', p_user, p_status, p_product,
                                              p_expires, p_event_at, p_rc_customer);
    end if;
    return jsonb_build_object('applied', 'duo', 'partner', v_partner);

  elsif p_plan = 'team' then
    perform app_private.upsert_subscription(p_user, 'team', null, p_status, p_product,
                                            p_expires, p_event_at, p_rc_customer);
    v_team := app_private.pick_paid_team(p_user, p_team);
    if v_team is not null then
      insert into public.team_subscriptions
        (team_id, payer_user_id, status, expires_at, rc_customer_id, last_event_at, updated_at)
      values (v_team, p_user, p_status, p_expires, p_rc_customer, p_event_at, now())
      on conflict (team_id) do update
        set payer_user_id = excluded.payer_user_id,
            status = excluded.status,
            expires_at = excluded.expires_at,
            rc_customer_id = excluded.rc_customer_id,
            last_event_at = excluded.last_event_at,
            updated_at = now()
        where public.team_subscriptions.last_event_at is null
           or public.team_subscriptions.last_event_at <= excluded.last_event_at;
    end if;
    return jsonb_build_object('applied', 'team', 'team', v_team);
  end if;

  raise exception 'invalid_plan' using errcode = '22023';
end $$;

-- A Pack Duo bought before the partner had an account: the first teammate who joins gets it.
create function app_private.grant_pending_duo() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  payer record;
begin
  for payer in
    select s.user_id, s.status, s.product_id, s.expires_at, s.last_event_at, s.rc_customer_id
      from public.team_members m
      join public.subscriptions s on s.user_id = m.user_id and s.source = 'duo'
                                 and s.granted_by_user_id is null
     where m.team_id = new.team_id and m.user_id <> new.user_id
       and app_private.sub_is_active(s.status, s.expires_at)
       and not exists (select 1 from public.subscriptions g
                        where g.granted_by_user_id = s.user_id and g.source = 'duo'
                          and app_private.sub_is_active(g.status, g.expires_at))
  loop
    perform app_private.upsert_subscription(new.user_id, 'duo', payer.user_id, payer.status,
      payer.product_id, payer.expires_at, payer.last_event_at, payer.rc_customer_id);
  end loop;
  return new;
end $$;

create trigger team_members_grant_pending_duo
after insert on public.team_members
for each row execute function app_private.grant_pending_duo();

-- What the app shows: am I covered, by what, and who offers it.
create function public.my_entitlement()
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
           null::text as team_name,
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
  )
  select true, o.source, o.expires_at, o.offered_by, o.team_name, o.is_payer
    from options o order by o.rank, o.expires_at desc nulls first limit 1;
  if not found then
    return query select false, null::public.subscription_source, null::timestamptz, null::text,
                        null::text, false;
  end if;
end $$;

-- The 8-player cap and the Pro grant use the same activity rule.
create or replace function app_private.team_capacity(p_team uuid) returns int
language sql stable security definer set search_path = ''
as $$
  select case when exists (
      select 1 from public.team_subscriptions ts
       where ts.team_id = p_team and app_private.sub_is_active(ts.status, ts.expires_at))
    then 8
    else (select least(t.max_members, 4) from public.teams t where t.id = p_team)
  end
$$;

revoke all on function
  app_private.sub_is_active(public.subscription_status, timestamptz),
  app_private.has_pro(uuid),
  app_private.pick_duo_partner(uuid, uuid),
  app_private.pick_paid_team(uuid, uuid),
  app_private.upsert_subscription(uuid, public.subscription_source, uuid, public.subscription_status,
                                  text, timestamptz, timestamptz, text),
  app_private.apply_rc_event(text, text, uuid, text, public.subscription_status, text, timestamptz,
                             timestamptz, text, uuid, uuid),
  app_private.grant_pending_duo()
from public;
grant execute on function
  app_private.sub_is_active(public.subscription_status, timestamptz),
  app_private.has_pro(uuid)
to authenticated, service_role;
grant execute on function
  app_private.apply_rc_event(text, text, uuid, text, public.subscription_status, text, timestamptz,
                             timestamptz, text, uuid, uuid)
to service_role;

create function public.svc_apply_rc_event(
  p_event_id text, p_type text, p_user uuid, p_plan text,
  p_status public.subscription_status, p_product text, p_expires timestamptz,
  p_event_at timestamptz, p_rc_customer text, p_partner uuid, p_team uuid
) returns jsonb
language sql volatile security definer set search_path = ''
as $$ select app_private.apply_rc_event(p_event_id, p_type, p_user, p_plan, p_status, p_product,
                                       p_expires, p_event_at, p_rc_customer, p_partner, p_team) $$;

revoke all on function public.svc_apply_rc_event(text, text, uuid, text, public.subscription_status,
  text, timestamptz, timestamptz, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_apply_rc_event(text, text, uuid, text, public.subscription_status,
  text, timestamptz, timestamptz, text, uuid, uuid) to service_role;

revoke all on function public.my_entitlement() from public, anon;
grant execute on function public.my_entitlement() to authenticated, service_role;
