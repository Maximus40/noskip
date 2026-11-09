begin;

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/951', 'Salle', 48.8, 2.3) returning id as gym \gset

select tests.authenticate_as(:'a');
select id as shared, invite_code as code from public.create_team('Les Déchaînés') \gset
select id as solo from public.create_team('Solo') \gset
select public.choose_gym(:'gym', true);
select public.register_push_token('ExponentPushToken[deleteme12345]', 'ios');
select public.start_session(:'gym', now() - interval '10 minutes', 'geofence');
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'b', :'code');
select public.svc_join_team(:'c', :'code');
select tests.reset_role();
update public.team_members set joined_at = joined_at + interval '1 minute' where user_id = :'c';
insert into public.subscriptions (user_id, source, status, expires_at) values (:'a', 'individual', 'active', now() + interval '1 year');

select tests.authenticate_as(:'a');
select tests.throws(format('select * from public.svc_handover_teams(%L)', :'a'), '42501', 'players cannot call it');
select tests.reset_role();

select tests.as_service();
select tests.eq((select array_agg(solo_team_id) from public.svc_handover_teams(:'a')), array[:'solo'::uuid],
                'the team where the player is alone is returned');
select tests.reset_role();
select tests.eq((select user_id from public.team_members where team_id = :'shared' and role = 'owner'), :'b'::uuid,
                'the oldest member becomes owner');
select tests.eq((select count(*) from public.team_members where team_id = :'shared' and role = 'owner'), 1::bigint,
                'still exactly one owner');

-- What the Edge Function does next: delete the solo team, then the auth user (cascade).
delete from public.teams where id = :'solo';
delete from auth.users where id = :'a';
select tests.eq((select count(*) from public.profiles where id = :'a'), 0::bigint, 'profile gone');
select tests.eq((select count(*) from public.team_members where user_id = :'a'), 0::bigint, 'memberships gone');
select tests.eq((select count(*) from public.sessions where user_id = :'a'), 0::bigint, 'sessions gone');
select tests.eq((select count(*) from public.user_gyms where user_id = :'a'), 0::bigint, 'gyms choice gone');
select tests.eq((select count(*) from public.push_tokens where user_id = :'a'), 0::bigint, 'push tokens gone');
select tests.eq((select count(*) from public.subscriptions where user_id = :'a'), 0::bigint, 'subscriptions gone');
select tests.eq((select count(*) from public.team_members where team_id = :'shared'), 2::bigint,
                'the team lives on with the others');
select tests.ok((select created_by is null from public.teams where id = :'shared'), 'team creator link cleared');

rollback;
