-- Four more premium SKIP poster styles: warrior, magazine, neon, zen
-- (noskip.shop.poster.<style>; noskip.shop.poster.all unlocks them too).

alter table public.profiles drop constraint profiles_poster_style_check;
alter table public.profiles add constraint profiles_poster_style_check
  check (poster_style in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news',
                          'warrior', 'magazine', 'neon', 'zen'));
alter table public.skip_cards drop constraint skip_cards_poster_style_check;
alter table public.skip_cards add constraint skip_cards_poster_style_check
  check (poster_style in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news',
                          'warrior', 'magazine', 'neon', 'zen'));

create or replace function public.equip_poster_style(p_style text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if p_style is null or p_style not in ('classic', 'gold', 'redcard', 'gameover', 'wanted', 'news',
                                        'warrior', 'magazine', 'neon', 'zen') then
    raise exception 'invalid_poster_style' using errcode = '22023';
  end if;
  if not app_private.owns_poster_style(uid, p_style) then
    raise exception 'poster_not_owned' using errcode = '42501';
  end if;
  update public.profiles set poster_style = p_style where id = uid;
  return p_style;
end $$;
