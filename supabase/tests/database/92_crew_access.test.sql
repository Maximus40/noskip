begin;

-- "Un pote paie, toute la team joue": a paying player covers the other members of their
-- oldest team while it has 4 players or fewer.
select tests.create_user('p@crew.local') as p \gset
select tests.create_user('f1@crew.local') as f1 \gset
select tests.create_user('f2@crew.local') as f2 \gset
select tests.create_user('f3@crew.local') as f3 \gset
select tests.create_user('s@crew.local') as s \gset
select tests.create_user('o@crew.local') as o \gset
update public.profiles set pseudo = 'Paul' where id = :'p';

select (now() + interval '1 year') as next_year \gset
select (now() - interval '1 day') as yesterday \gset

select tests.authenticate_as(:'p');
select id as team, invite_code as code from public.create_team('Les Potes') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'f1', :'code');
select public.svc_join_team(:'f2', :'code');
select tests.reset_role();
-- One transaction = one now(): age the first team so "oldest" is meaningful.
update public.team_members set joined_at = now() - interval '1 day' where team_id = :'team';

select tests.ok(not app_private.has_pro(:'f1'), 'nobody pays: invitees hit the paywall');

-- Paul starts his trial: the whole team plays.
select tests.as_service();
select public.svc_apply_rc_event('crew-1', 'INITIAL_PURCHASE', :'p', 'individual', 'trialing',
       'noskip.pro.annual', :'next_year', now(), 'rc-p', null, null);
select public.svc_join_team(:'f3', :'code');
select tests.reset_role();
select tests.ok(app_private.has_pro(:'f1') and app_private.has_pro(:'f2'), 'teammates covered by the payer');
select tests.ok(app_private.has_pro(:'f3'), 'a friend who joins later is covered too');
select tests.ok(not app_private.has_pro(:'s'), 'a stranger is never covered');

select tests.authenticate_as(:'f1');
select tests.ok((select active and source = 'individual' and offered_by = 'Paul'
                        and team_name = 'Les Potes' and not is_payer from public.my_entitlement()),
                'invitee sees "Offert par Paul" and the team');
select tests.reset_role();
select tests.authenticate_as(:'p');
select tests.ok((select active and is_payer and offered_by is null and team_name = 'Les Potes'
                   from public.my_entitlement()),
                'the payer sees which team they cover');
select tests.reset_role();

-- A covered invitee's own new team is not covered: Paul is not in it.
select tests.authenticate_as(:'f1');
select id as fteam, invite_code as fcode from public.create_team('Autre team') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'s', :'fcode');
select tests.reset_role();
select tests.ok(not app_private.has_pro(:'s'), 'coverage does not spread through invitees');
select tests.ok(app_private.has_pro(:'f1'), 'the invitee stays covered in the first team');

-- Paul covers one team only: his oldest one.
select tests.authenticate_as(:'o');
select id as oteam, invite_code as ocode from public.create_team('Team de O') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'p', :'ocode');
select tests.reset_role();
select tests.eq(app_private.crew_team(:'p'), :'team'::uuid, 'covered team = the oldest one');
select tests.ok(not app_private.has_pro(:'o'), 'his other teams are not covered');

-- More than 4 players (e.g. an expired Team plan): the crew rule stops, the Team plan is needed.
insert into public.team_members (team_id, user_id, role, joined_at, plate_color)
values (:'team', :'s', 'member', now(), '#9A9CA1');
select tests.ok(not app_private.has_pro(:'f1'), 'teams of 5+ need the Team plan');
delete from public.team_members where team_id = :'team' and user_id = :'s';
select tests.ok(app_private.has_pro(:'f1'), 'back to 4 players: covered again');

-- Paul's plan expires: everyone goes back to the paywall.
select tests.as_service();
select public.svc_apply_rc_event('crew-3', 'EXPIRATION', :'p', 'individual', 'expired',
       'noskip.pro.annual', :'yesterday', now() + interval '1 second', 'rc-p', null, null);
select tests.reset_role();
select tests.ok(not app_private.has_pro(:'f1') and not app_private.has_pro(:'p'), 'expired: crew loses access');

-- Another teammate pays: she sees her own plan and the team (Paul included) plays again.
select tests.as_service();
select public.svc_apply_rc_event('crew-2', 'INITIAL_PURCHASE', :'f2', 'individual', 'active',
       'noskip.pro.weekly', :'next_year', now(), 'rc-f2', null, null);
select tests.reset_role();
select tests.authenticate_as(:'f2');
select tests.ok((select is_payer and offered_by is null from public.my_entitlement()), 'own plan first');
select tests.reset_role();
select tests.ok(app_private.has_pro(:'f3') and app_private.has_pro(:'p'), 'another payer takes over');

rollback;
