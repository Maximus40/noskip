-- Phase 4: joining by invite code (service role, via the join-team Edge Function),
-- team preview for the invite screen, and owner management RPCs.

-- Max players: 4 for a standard team, 8 when the Team plan is active.
create function app_private.team_capacity(p_team uuid) returns int
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.team_subscriptions ts
      where ts.team_id = p_team
        and ts.status in ('trialing', 'active', 'grace_period')
        and (ts.expires_at is null or ts.expires_at > now())
    ) then 8
    else (select least(t.max_members, 4) from public.teams t where t.id = p_team)
  end
$$;

-- Normalises user input: "abcd-2345", " ABCD 2345 " → "ABCD2345".
create function app_private.normalize_invite_code(p_code text) returns text
language sql immutable set search_path = ''
as $$ select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Public facts shown on the invite screen before joining. No ids of members, no stats.
create function app_private.team_preview(p_code text)
returns table (team_id uuid, name text, member_count int, capacity int, member_pseudos text[])
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name,
         (select count(*)::int from public.team_members m where m.team_id = t.id),
         app_private.team_capacity(t.id),
         array(select coalesce(p.pseudo, 'Un pote') from public.team_members m
               join public.profiles p on p.id = m.user_id
               where m.team_id = t.id order by m.joined_at)
  from public.teams t
  where t.invite_code = app_private.normalize_invite_code(p_code)
$$;

-- Joins `p_user` to the team owning `p_code`. Idempotent. Locks the team row so two
-- simultaneous joins cannot exceed the capacity.
create function app_private.join_team_by_code(p_user uuid, p_code text)
returns table (team_id uuid, name text, already_member boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  t public.teams;
  members int;
begin
  select * into t from public.teams
   where invite_code = app_private.normalize_invite_code(p_code)
   for update;
  if not found then
    raise exception 'invalid_invite_code' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = p_user) then
    return query select t.id, t.name, true;
    return;
  end if;

  if (select count(*) from public.team_members m where m.user_id = p_user) >= 3 then
    raise exception 'max_teams_reached' using errcode = 'P0001';
  end if;

  select count(*) into members from public.team_members m where m.team_id = t.id;
  if members >= app_private.team_capacity(t.id) then
    raise exception 'team_full' using errcode = 'P0001';
  end if;

  insert into public.team_members (team_id, user_id, role, plate_color)
  values (t.id, p_user, 'member', app_private.next_plate_color(t.id));

  return query select t.id, t.name, false;
end $$;

revoke all on function app_private.team_capacity(uuid), app_private.normalize_invite_code(text),
  app_private.team_preview(text), app_private.join_team_by_code(uuid, text) from public;
grant execute on function app_private.team_capacity(uuid), app_private.normalize_invite_code(text),
  app_private.team_preview(text), app_private.join_team_by_code(uuid, text) to service_role;
grant execute on function app_private.team_capacity(uuid) to authenticated;

-- Thin public wrappers so the Edge Function (service role) can call them through PostgREST.
create function public.svc_team_preview(p_code text)
returns table (team_id uuid, name text, member_count int, capacity int, member_pseudos text[])
language sql stable security definer set search_path = ''
as $$ select * from app_private.team_preview(p_code) $$;

create function public.svc_join_team(p_user uuid, p_code text)
returns table (team_id uuid, name text, already_member boolean)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.join_team_by_code(p_user, p_code) $$;

revoke all on function public.svc_team_preview(text), public.svc_join_team(uuid, text)
  from public, anon, authenticated;
grant execute on function public.svc_team_preview(text), public.svc_join_team(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Owner management
-- ---------------------------------------------------------------------------
create function public.rename_team(p_team uuid, p_name text) returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  t public.teams;
begin
  perform app_private.require_uid();
  if not app_private.is_team_owner(p_team) then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 32 then
    raise exception 'invalid_team_name' using errcode = '22023';
  end if;
  update public.teams set name = btrim(p_name) where id = p_team returning * into t;
  return t;
end $$;

-- New code: old invite links stop working (e.g. after a link leaked).
create function public.regenerate_invite_code(p_team uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  code text;
  attempts int := 0;
begin
  perform app_private.require_uid();
  if not app_private.is_team_owner(p_team) then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  loop
    begin
      update public.teams set invite_code = app_private.new_invite_code()
       where id = p_team returning invite_code into code;
      return code;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Owner removes a member (also possible with a plain DELETE under RLS; the RPC gives a clear error).
create function public.remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  if not app_private.is_team_owner(p_team) then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  if p_user = uid then
    raise exception 'owner_cannot_remove_self' using errcode = 'P0001';
  end if;
  delete from public.team_members where team_id = p_team and user_id = p_user;
  if not found then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
end $$;

-- Accept the rules of every team I belong to (onboarding step 8).
create function public.accept_all_team_rules() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := app_private.require_uid();
begin
  update public.team_members set accepted_rules_at = now()
   where user_id = uid and accepted_rules_at is null;
  update public.profiles set rules_accepted_at = coalesce(rules_accepted_at, now()) where id = uid;
end $$;

revoke all on function public.rename_team(uuid, text), public.regenerate_invite_code(uuid),
  public.remove_member(uuid, uuid), public.accept_all_team_rules() from public, anon;
grant execute on function public.rename_team(uuid, text), public.regenerate_invite_code(uuid),
  public.remove_member(uuid, uuid), public.accept_all_team_rules() to authenticated, service_role;
