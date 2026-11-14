-- The player feels better: the injury joker of the current game week can be withdrawn until
-- Sunday 20:00 (the week is still open). The month's joker is given back, and the week counts
-- normally again (SKIP card if the goal is missed). Closed weeks are never touched.
create function public.cancel_joker() returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
  wk date := app_private.game_week_start(now());
begin
  delete from public.jokers j where j.user_id = uid and j.week_start = wk;
  return found;
end $$;

revoke all on function public.cancel_joker() from public, anon;
grant execute on function public.cancel_joker() to authenticated, service_role;
