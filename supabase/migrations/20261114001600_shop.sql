-- Shop (one-time in-app purchases, App Store "non-consumable"): cosmetic plate skins and packs of
-- SKIP lines. Nothing sold changes the game: no session, no plate, no joker, no SKIP dodge.
-- Product ids: noskip.shop.skin.<skin>, noskip.shop.pack.<pack>. Purchases are written only by
-- the RevenueCat webhook (service role); a refund revokes the item.

create table public.shop_purchases (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null check (product_id ~ '^noskip\.shop\.(skin|pack)\.[a-z0-9_]+$'),
  purchased_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_event_at timestamptz,
  primary key (user_id, product_id)
);
alter table public.shop_purchases enable row level security;
revoke all on public.shop_purchases from anon, authenticated;
grant select on public.shop_purchases to authenticated;
grant select, insert, update on public.shop_purchases to service_role;
create policy "shop_purchases: owner reads own" on public.shop_purchases
  for select to authenticated using (user_id = auth.uid());

-- The skin the player shows on the team bar (only through equip_plate_skin).
alter table public.profiles
  add column plate_skin text not null default 'classic'
  check (plate_skin in ('classic', 'gold', 'carbon', 'chrome'));

create function app_private.owns_shop_item(p_user uuid, p_product text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_purchases sp
     where sp.user_id = p_user and sp.product_id = p_product and sp.revoked_at is null)
$$;

-- What the player owns and wears.
create function public.my_shop()
returns table (product_id text, equipped_skin text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  skin text := (select p.plate_skin from public.profiles p where p.id = uid);
begin
  return query
    select sp.product_id, skin from public.shop_purchases sp
     where sp.user_id = uid and sp.revoked_at is null
    union all
    select null::text, skin
     where not exists (select 1 from public.shop_purchases sp
                        where sp.user_id = uid and sp.revoked_at is null);
end $$;

create function public.equip_plate_skin(p_skin text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if p_skin is null or p_skin not in ('classic', 'gold', 'carbon', 'chrome') then
    raise exception 'invalid_skin' using errcode = '22023';
  end if;
  if p_skin <> 'classic' and not app_private.owns_shop_item(uid, 'noskip.shop.skin.' || p_skin) then
    raise exception 'skin_not_owned' using errcode = '42501';
  end if;
  update public.profiles set plate_skin = p_skin where id = uid;
  return p_skin;
end $$;

-- Skins worn by the members of a team I belong to (the bar draws them for everyone).
create function public.team_cosmetics(p_team uuid)
returns table (user_id uuid, plate_skin text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if not exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query
    select m.user_id, p.plate_skin from public.team_members m
      join public.profiles p on p.id = m.user_id
     where m.team_id = p_team;
end $$;

-- Packs of SKIP lines a team draws from: any pack owned by one of its members.
create function app_private.team_joke_packs(p_team uuid) returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct substring(sp.product_id from '^noskip\.shop\.pack\.(.+)$')), '{}')
    from public.team_members m
    join public.shop_purchases sp on sp.user_id = m.user_id
   where m.team_id = p_team and sp.revoked_at is null and sp.product_id like 'noskip.shop.pack.%'
$$;

-- RevenueCat event for a shop product: once per event id; an older event never overrides a newer.
create function app_private.apply_shop_event(
  p_event_id text, p_type text, p_user uuid, p_product text, p_revoke boolean, p_event_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_product !~ '^noskip\.shop\.(skin|pack)\.[a-z0-9_]+$' then
    raise exception 'invalid_product' using errcode = '22023';
  end if;
  insert into public.rc_events (id, type, app_user_id) values (p_event_id, p_type, p_user::text)
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ignored', 'unknown_user');
  end if;

  insert into public.shop_purchases (user_id, product_id, purchased_at, revoked_at, last_event_at)
  values (p_user, p_product, p_event_at, case when p_revoke then p_event_at end, p_event_at)
  on conflict (user_id, product_id) do update
    set revoked_at = case when p_revoke then excluded.last_event_at end,
        last_event_at = excluded.last_event_at
    where public.shop_purchases.last_event_at is null
       or public.shop_purchases.last_event_at <= excluded.last_event_at;

  -- A refunded skin cannot stay on the bar.
  if p_revoke and p_product like 'noskip.shop.skin.%' then
    update public.profiles set plate_skin = 'classic'
     where id = p_user and 'noskip.shop.skin.' || plate_skin = p_product;
  end if;
  return jsonb_build_object('applied', 'shop', 'product', p_product, 'revoked', p_revoke);
end $$;

create function public.svc_apply_shop_event(
  p_event_id text, p_type text, p_user uuid, p_product text, p_revoke boolean, p_event_at timestamptz
) returns jsonb
language sql volatile security definer set search_path = ''
as $$ select app_private.apply_shop_event(p_event_id, p_type, p_user, p_product, p_revoke, p_event_at) $$;

create function public.svc_team_joke_packs(p_team uuid) returns text[]
language sql stable security definer set search_path = ''
as $$ select app_private.team_joke_packs(p_team) $$;

revoke all on function
  app_private.owns_shop_item(uuid, text),
  app_private.team_joke_packs(uuid),
  app_private.apply_shop_event(text, text, uuid, text, boolean, timestamptz)
from public;
grant execute on function app_private.owns_shop_item(uuid, text) to authenticated, service_role;
grant execute on function
  app_private.team_joke_packs(uuid),
  app_private.apply_shop_event(text, text, uuid, text, boolean, timestamptz)
to service_role;

revoke all on function
  public.svc_apply_shop_event(text, text, uuid, text, boolean, timestamptz),
  public.svc_team_joke_packs(uuid)
from public, anon, authenticated;
grant execute on function
  public.svc_apply_shop_event(text, text, uuid, text, boolean, timestamptz),
  public.svc_team_joke_packs(uuid)
to service_role;

revoke all on function public.my_shop(), public.equip_plate_skin(text), public.team_cosmetics(uuid)
  from public, anon;
grant execute on function public.my_shop(), public.equip_plate_skin(text), public.team_cosmetics(uuid)
  to authenticated, service_role;
