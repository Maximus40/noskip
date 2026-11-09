-- Phase 9: registering a device for push notifications.
-- A device token belongs to whoever is signed in on that phone right now: if another account
-- used the phone before, the token moves to the current player (RLS alone would refuse to
-- update someone else's row, so this goes through a SECURITY DEFINER RPC).

create function public.register_push_token(p_token text, p_platform public.push_platform)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$' then
    raise exception 'invalid_push_token' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

revoke all on function public.register_push_token(text, public.push_platform) from public, anon;
grant execute on function public.register_push_token(text, public.push_platform) to authenticated;

-- Primary gym change (anti-cheat: max once every 30 days) is announced to the team. The
-- trigger only queues the call (pg_net runs it after commit); the message never names the gym.
create function app_private.gym_change_info(p_user uuid)
returns table (pseudo text, changed_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select p.pseudo, p.primary_gym_changed_at from public.profiles p where p.id = p_user $$;

create function app_private.on_primary_gym_changed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.primary_gym_changed_at is not null
     and new.primary_gym_changed_at is distinct from old.primary_gym_changed_at then
    perform app_private.call_function('notify-gym-change',
      jsonb_build_object('user_id', new.id, 'changed_at', new.primary_gym_changed_at));
  end if;
  return new;
end $$;

create trigger profiles_primary_gym_changed
after update of primary_gym_changed_at on public.profiles
for each row execute function app_private.on_primary_gym_changed();

create function public.svc_gym_change_info(p_user uuid)
returns table (pseudo text, changed_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select * from app_private.gym_change_info(p_user) $$;

revoke all on function app_private.gym_change_info(uuid), app_private.on_primary_gym_changed() from public;
grant execute on function app_private.gym_change_info(uuid) to service_role;
revoke all on function public.svc_gym_change_info(uuid) from public, anon, authenticated;
grant execute on function public.svc_gym_change_info(uuid) to service_role;
