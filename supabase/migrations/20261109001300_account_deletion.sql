-- Phase 11: account deletion (App Store requirement). The delete-account Edge Function first
-- hands each team the player owns over to the oldest remaining member, deletes the teams where
-- the player is alone, removes their avatar files, then deletes the auth user: every table
-- references profiles / auth.users with ON DELETE CASCADE (or SET NULL for team history).

-- Hands owned teams over; returns the teams where the player is the only member.
create function app_private.handover_teams(p_user uuid)
returns table (solo_team_id uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  t record;
  heir uuid;
begin
  for t in
    select m.team_id from public.team_members m where m.user_id = p_user and m.role = 'owner'
  loop
    select o.user_id into heir from public.team_members o
     where o.team_id = t.team_id and o.user_id <> p_user
     order by o.joined_at, o.user_id
     limit 1;
    if heir is null then
      solo_team_id := t.team_id;
      return next;
    else
      update public.team_members set role = 'member' where team_id = t.team_id and user_id = p_user;
      update public.team_members set role = 'owner' where team_id = t.team_id and user_id = heir;
    end if;
  end loop;
  -- Teams where they were a plain member but alone (everyone else left).
  return query
  select m.team_id from public.team_members m
   where m.user_id = p_user and m.role = 'member'
     and not exists (select 1 from public.team_members o
                      where o.team_id = m.team_id and o.user_id <> p_user);
end $$;

create function public.svc_handover_teams(p_user uuid)
returns table (solo_team_id uuid)
language sql volatile security definer set search_path = ''
as $$ select * from app_private.handover_teams(p_user) $$;

revoke all on function app_private.handover_teams(uuid) from public;
grant execute on function app_private.handover_teams(uuid) to service_role;
revoke all on function public.svc_handover_teams(uuid) from public, anon, authenticated;
grant execute on function public.svc_handover_teams(uuid) to service_role;
