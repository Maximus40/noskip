begin;

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset

select tests.authenticate_as(:'a');
select public.register_push_token('ExponentPushToken[abcdefghij1234]', 'ios');
select tests.eq(tests.count_rows('select * from public.push_tokens'), 1::bigint, 'token registered');
select public.register_push_token('ExponentPushToken[abcdefghij1234]', 'ios');
select tests.eq(tests.count_rows('select * from public.push_tokens'), 1::bigint, 'registering again keeps one row');
select tests.throws('select public.register_push_token(''not-a-token'', ''ios'')', 'invalid_push_token',
                    'only Expo push tokens');
select tests.reset_role();

-- Same phone, another account: the token moves to the new player.
select tests.authenticate_as(:'b');
select public.register_push_token('ExponentPushToken[abcdefghij1234]', 'android');
select tests.eq(tests.count_rows('select * from public.push_tokens'), 1::bigint, 'b now owns the device token');
select tests.reset_role();
select tests.eq((select user_id from public.push_tokens where token = 'ExponentPushToken[abcdefghij1234]'), :'b'::uuid,
                'token reassigned');
select tests.eq((select platform::text from public.push_tokens where token = 'ExponentPushToken[abcdefghij1234]'), 'android',
                'platform updated');

select tests.authenticate_as(:'a');
select tests.eq(tests.count_rows('select * from public.push_tokens'), 0::bigint, 'a no longer sees it');
select tests.reset_role();

-- Signing out deletes my own token (plain RLS delete).
select tests.authenticate_as(:'b');
delete from public.push_tokens where token = 'ExponentPushToken[abcdefghij1234]';
select tests.eq(tests.count_rows('select * from public.push_tokens'), 0::bigint, 'b removed the token on sign-out');
select tests.reset_role();

select tests.authenticate_anon();
select tests.throws('select public.register_push_token(''ExponentPushToken[abcdefghij1234]'', ''ios'')', '42501',
                    'anon cannot register');
select tests.reset_role();

-- Preferences: a player can edit their own notification_prefs.
select tests.authenticate_as(:'a');
update public.profiles set notification_prefs = notification_prefs || '{"skip": false}'::jsonb where id = auth.uid();
select tests.eq((select notification_prefs ->> 'skip' from public.profiles where id = auth.uid()), 'false',
                'notification preference saved');
select tests.reset_role();
select tests.eq((select count(*) from public.svc_team_push_targets('00000000-0000-0000-0000-000000000000', 'skip')),
                0::bigint, 'targets query works on an empty team');

-- Primary gym change: the trigger fires (no cron_config locally: the call is skipped with a warning).
insert into public.gyms (osm_id, name, lat, lng) values ('node/851', 'Salle A', 48.8, 2.3), ('node/852', 'Salle B', 48.9, 2.4);
select tests.authenticate_as(:'a');
select public.choose_gym((select id from public.gyms where osm_id = 'node/851'), true);
select public.choose_gym((select id from public.gyms where osm_id = 'node/852'), true);
select tests.reset_role();
select tests.ok((select primary_gym_changed_at is not null from public.profiles where id = :'a'), 'primary gym change recorded');
select tests.as_service();
select tests.ok((select changed_at is not null from public.svc_gym_change_info(:'a')), 'change info for the push');
select tests.reset_role();
select tests.authenticate_as(:'a');
select tests.throws(format('select * from public.svc_gym_change_info(%L)', :'a'), '42501', 'players cannot read it');
select tests.reset_role();

rollback;
