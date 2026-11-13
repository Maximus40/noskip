-- A player can never validate a session by himself; sensitive tables are service-role only.
begin;

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/1001', 'Salle Test', 50.63, 3.06) returning id as gym \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/1002', 'Autre Salle', 50.64, 3.07) returning id as gym2 \gset

select tests.authenticate_as(:'alice');
select id as team_a from public.create_team('Les Déchaînés') \gset
select count(*) from public.choose_gym(:'gym');
-- Opened earlier today (Paris): never before midnight, or the "today" status would not match.
select id as sess from public.start_session(:'gym',
  greatest(now() - interval '50 minutes',
           date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
  'geofence') \gset
select tests.ok(:'sess' is not null, 'player can open a session at her gym');

-- Direct writes on sessions are forbidden.
select tests.throws(format('update public.sessions set validated_at = now(), ended_at = now(), duration_min = 60 where id = %L', :'sess'),
                    '42501', 'player cannot set validated_at');
select tests.throws(format('insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date) values (%L, %L, %L, now() - interval ''1 hour'', now(), 60, now(), current_date)',
                           :'alice', :'gym', 'geofence'),
                    '42501', 'player cannot insert a validated session');
select tests.throws(format('delete from public.sessions where id = %L', :'sess'), '42501', 'player cannot delete sessions');
select tests.throws(format('select public.start_session(%L, now(), %L)', :'gym2', 'geofence'), 'gym_not_chosen',
                    'session only at a gym the player chose');
select tests.throws(format('select public.start_session(%L, now() + interval ''1 hour'', %L)', :'gym', 'geofence'),
                    'invalid_started_at', 'start time cannot be in the future');

-- Sensitive tables are read-only for players.
select tests.throws(format('insert into public.weeks (team_id, week_start) values (%L, %L)', :'team_a', '2026-11-02'),
                    '42501', 'player cannot write weeks');
select tests.throws(format('insert into public.skip_cards (week_id, team_id, user_id, line_id) values (gen_random_uuid(), %L, %L, %L)', :'team_a', :'alice', 'x'),
                    '42501', 'player cannot write skip_cards');
select tests.throws(format('insert into public.belts (team_id, month, type, user_id) values (%L, %L, %L, %L)', :'team_a', '2026-11-01', 'belt', :'alice'),
                    '42501', 'player cannot write belts');
select tests.throws(format('insert into public.team_subscriptions (team_id, status) values (%L, %L)', :'team_a', 'active'),
                    '42501', 'player cannot write team_subscriptions');
select tests.throws(format('insert into public.subscriptions (user_id, source, status) values (%L, %L, %L)', :'alice', 'individual', 'active'),
                    '42501', 'player cannot grant himself Pro');
select tests.throws('insert into public.week_results (week_id, user_id, goal, done, achieved) values (gen_random_uuid(), auth.uid(), 3, 3, true)',
                    '42501', 'player cannot write week_results');
select tests.throws('update public.profiles set lifetime_sessions = 999 where id = auth.uid()', '42501',
                    'player cannot inflate lifetime_sessions');
select tests.throws('update public.profiles set weekly_goal = 2 where id = auth.uid()', '42501',
                    'goal changes go through set_weekly_goal');
update public.profiles set pseudo = 'Alice' where id = auth.uid();
select tests.eq((select pseudo from public.profiles where id = auth.uid()), 'Alice', 'player can edit her pseudo');
select tests.reset_role();

-- Bob cannot see Alice's session, even as a teammate (only aggregates via team_board).
select tests.as_service();
insert into public.team_members (team_id, user_id, plate_color) values (:'team_a', :'bob', '#7C7E84');
select tests.reset_role();
select tests.authenticate_as(:'bob');
select tests.eq(tests.count_rows('select * from public.sessions'), 0::bigint, 'teammate cannot read raw sessions');
select tests.eq(tests.count_rows('select * from public.user_gyms'), 0::bigint, 'teammate cannot see where I train');
select tests.eq((select today_status from public.team_board(:'team_a') where user_id = :'alice'), 'at_gym',
                'board shows "at gym" without time or place');
select tests.reset_role();

-- The service role (validate-session) validates.
select tests.as_service();
update public.sessions set ended_at = now(), duration_min = 50, validated_at = now() where id = :'sess';
select tests.ok((select week_start is not null from public.sessions where id = :'sess'), 'validated session gets its game week');
select tests.throws(format('update public.sessions set duration_min = 30 where id = %L', :'sess'), 'validated_needs_duration',
                    'a validated session lasts at least 40 minutes');
select tests.reset_role();

select tests.authenticate_as(:'bob');
select tests.eq((select done from public.team_board(:'team_a') where user_id = :'alice'), 1, 'board counts the plate');
select tests.eq((select today_status from public.team_board(:'team_a') where user_id = :'alice'), 'done', 'board shows done');
select tests.reset_role();

select tests.authenticate_as(:'alice');
select tests.throws(format('select public.start_session(%L, now(), %L)', :'gym', 'geofence'), 'already_validated_today',
                    'one validated session per day');
select tests.reset_role();

-- Spots, push tokens.
select tests.authenticate_as(:'alice');
select tests.throws(format('insert into public.spots (from_user, to_user, team_id, local_date) values (%L, %L, %L, current_date)', :'alice', :'bob', :'team_a'),
                    '42501', 'spots go through send-spot');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[alice-1]', :'alice', 'ios');
select tests.throws(format('insert into public.push_tokens (token, user_id, platform) values (%L, %L, %L)', 'ExponentPushToken[fake-b]', :'bob', 'ios'),
                    'row-level security', 'cannot register a token for someone else');
select tests.reset_role();
select tests.authenticate_as(:'bob');
select tests.eq(tests.count_rows('select * from public.push_tokens'), 0::bigint, 'tokens are private');
select tests.reset_role();

rollback;
