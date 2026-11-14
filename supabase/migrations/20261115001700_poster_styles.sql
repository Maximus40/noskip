-- Premium SKIP poster styles (shop): a player who buys a style and equips it "imposes" it on the
-- SKIP cards of their teammates. The style is picked when the card is created (trigger on
-- skip_cards, so the week-close logic is untouched) among the styles worn by the skipper's
-- teammates, at random, and stored on the card: everyone sees the same poster, forever.
-- Products: noskip.shop.poster.<style>, or noskip.shop.poster.all (the five styles).

alter table public.shop_purchases drop constraint shop_purchases_product_id_check;
alter table public.shop_purchases add constraint shop_purchases_product_id_check
  check (product_id ~ '^noskip\.shop\.(skin|pack|poster)\.[a-z0-9_]+$');

alter table public.profiles
  add column poster_style text not null default 'classic'
  check (poster_style in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news'));

alter table public.skip_cards
  add column poster_style text not null default 'classic'
  check (poster_style in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news'));

create function app_private.owns_poster_style(p_user uuid, p_style text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_style = 'classic'
      or app_private.owns_shop_item(p_user, 'noskip.shop.poster.' || p_style)
      or app_private.owns_shop_item(p_user, 'noskip.shop.poster.all')
$$;

create function public.equip_poster_style(p_style text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if p_style is null or p_style not in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news') then
    raise exception 'invalid_poster_style' using errcode = '22023';
  end if;
  if not app_private.owns_poster_style(uid, p_style) then
    raise exception 'poster_not_owned' using errcode = '42501';
  end if;
  update public.profiles set poster_style = p_style where id = uid;
  return p_style;
end $$;

create function app_private.pick_poster_style() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  picked text;
begin
  select p.poster_style into picked
    from public.team_members m
    join public.profiles p on p.id = m.user_id
   where m.team_id = new.team_id
     and m.user_id <> new.user_id
     and p.poster_style <> 'classic'
     and app_private.owns_poster_style(m.user_id, p.poster_style)
   order by random()
   limit 1;
  new.poster_style := coalesce(picked, 'classic');
  return new;
end $$;

create trigger skip_cards_pick_poster_style
  before insert on public.skip_cards
  for each row execute function app_private.pick_poster_style();

-- Same as before, plus poster products, and a refunded poster style is taken off.
create or replace function app_private.apply_shop_event(
  p_event_id text, p_type text, p_user uuid, p_product text, p_revoke boolean, p_event_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_product !~ '^noskip\.shop\.(skin|pack|poster)\.[a-z0-9_]+$' then
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

  -- A refunded skin cannot stay on the bar, nor a refunded poster style on the next cards.
  if p_revoke and p_product like 'noskip.shop.skin.%' then
    update public.profiles set plate_skin = 'classic'
     where id = p_user and 'noskip.shop.skin.' || plate_skin = p_product;
  end if;
  if p_revoke and p_product like 'noskip.shop.poster.%' then
    update public.profiles set poster_style = 'classic'
     where id = p_user and not app_private.owns_poster_style(p_user, poster_style);
  end if;
  return jsonb_build_object('applied', 'shop', 'product', p_product, 'revoked', p_revoke);
end $$;

revoke all on function app_private.owns_poster_style(uuid, text), app_private.pick_poster_style()
  from public;
grant execute on function app_private.owns_poster_style(uuid, text) to authenticated, service_role;
revoke all on function public.equip_poster_style(text) from public, anon;
grant execute on function public.equip_poster_style(text) to authenticated, service_role;
