-- Joining by invite code: limits, idempotence, capacity with the Team plan, owner tools.
begin;

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('p2@test.local') as p2 \gset
select tests.create_user('p3@test.local') as p3 \gset
select tests.create_user('p4@test.local') as p4 \gset
select tests.create_user('p5@test.local') as p5 \gset
update public.profiles set pseudo = 'Owner' where id = :'owner';

select tests.authenticate_as(:'owner');
select id as team, invite_code as code from public.create_team('Les Déchaînés') \gset
select tests.reset_role();

-- Players cannot call the service-only join/preview wrappers.
select tests.authenticate_as(:'p2');
select tests.throws(format('select * from public.svc_join_team(%L, %L)', :'p2', :'code'), '42501',
                    'players cannot join by calling the service wrapper');
select tests.throws(format('select * from public.svc_team_preview(%L)', :'code'), '42501',
                    'players cannot enumerate teams by code');
select tests.reset_role();

select tests.as_service();
select tests.eq((select name from public.svc_team_preview(lower(substr(:'code', 1, 4)) || '-' || substr(:'code', 5))),
                'Les Déchaînés', 'preview accepts lowercase and dashes');
select tests.eq((select member_pseudos from public.svc_team_preview(:'code')), array['Owner'], 'preview lists pseudos');
select tests.eq((select already_member from public.svc_join_team(:'p2', :'code')), false, 'p2 joins');
select tests.eq((select already_member from public.svc_join_team(:'p2', :'code')), true, 'joining twice is idempotent');
select public.svc_join_team(:'p3', :'code');
select public.svc_join_team(:'p4', :'code');
select tests.throws(format('select public.svc_join_team(%L, %L)', :'p5', :'code'), 'team_full', 'standard team is capped at 4');
select tests.throws(format('select public.svc_join_team(%L, %L)', :'p5', 'ZZZZZZZZ'), 'invalid_invite_code', 'unknown code');
select tests.eq((select count(distinct plate_color) from public.team_members where team_id = :'team'), 4::bigint,
                'each member gets a distinct plate colour');

-- Team plan raises the cap to 8.
insert into public.team_subscriptions (team_id, payer_user_id, status, expires_at)
values (:'team', :'owner', 'active', now() + interval '1 year');
select tests.eq((select capacity from public.svc_team_preview(:'code')), 8, 'Team plan capacity is 8');
select tests.eq((select already_member from public.svc_join_team(:'p5', :'code')), false, 'fifth player joins with the Team plan');
update public.team_subscriptions set status = 'expired' where team_id = :'team';
select tests.eq((select capacity from public.svc_team_preview(:'code')), 4, 'capacity falls back to 4 when the plan expires');
select tests.reset_role();

-- Owner tools.
select tests.authenticate_as(:'p2');
select tests.throws(format('select public.rename_team(%L, %L)', :'team', 'Hack'), 'not_team_owner', 'only the owner renames');
select tests.throws(format('select public.regenerate_invite_code(%L)', :'team'), 'not_team_owner', 'only the owner rotates the code');
select tests.throws(format('select public.remove_member(%L, %L)', :'team', :'p3'), 'not_team_owner', 'only the owner removes');
select public.accept_all_team_rules();
select tests.ok((select accepted_rules_at is not null from public.team_members where team_id = :'team' and user_id = :'p2'),
                'rules accepted for my teams');
select tests.reset_role();

select tests.authenticate_as(:'owner');
select tests.eq((select name from public.rename_team(:'team', '  Les Machines  ')), 'Les Machines', 'owner renames');
select public.regenerate_invite_code(:'team') as new_code \gset
select tests.ok(:'new_code' <> :'code', 'invite code rotated');
select public.remove_member(:'team', :'p5');
select tests.throws(format('select public.remove_member(%L, %L)', :'team', :'owner'), 'owner_cannot_remove_self',
                    'owner leaves through leave_team, not remove_member');
select tests.reset_role();

select tests.as_service();
select tests.throws(format('select public.svc_join_team(%L, %L)', :'p5', :'code'), 'invalid_invite_code', 'old code stops working');
select tests.reset_role();

rollback;
