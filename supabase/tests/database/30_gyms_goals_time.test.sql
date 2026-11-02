begin;

select tests.create_user('alice@test.local') as alice \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/1', 'G1', 50, 3) returning id as g1 \gset
insert into public.gyms (osm_id, name, lat, lng) values ('way/2', 'G2', 50, 3) returning id as g2 \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/3', 'G3', 50, 3) returning id as g3 \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/4', 'G4', 50, 3) returning id as g4 \gset

select tests.throws('insert into public.gyms (osm_id, name, lat, lng) values (''custom-pin'', ''Fake'', 1, 1)', 'gyms_osm_id_check',
                    'gyms must be OSM objects');

select tests.authenticate_as(:'alice');
select tests.throws(format('insert into public.gyms (osm_id, name, lat, lng) values (%L, %L, 1, 1)', 'node/99', 'Mine'),
                    '42501', 'players cannot create gyms');
select tests.throws(format('insert into public.user_gyms (user_id, gym_id) values (%L, %L)', :'alice', :'g1'),
                    '42501', 'gyms are chosen through choose_gym');
select tests.throws(format('select public.choose_gym(%L)', gen_random_uuid()), 'unknown_gym', 'only known OSM gyms');

select count(*) from public.choose_gym(:'g1');
select tests.eq((select gym_id from public.user_gyms where is_primary), :'g1'::uuid, 'first gym becomes primary');
select count(*) from public.choose_gym(:'g2', false);
select count(*) from public.choose_gym(:'g3', false);
select tests.throws(format('select public.choose_gym(%L, false)', :'g4'), 'max_gyms_reached', '3 gyms max');

-- First primary change is allowed, a second one within 30 days is not.
select count(*) from public.choose_gym(:'g2');
select tests.eq((select gym_id from public.user_gyms where is_primary), :'g2'::uuid, 'primary changed once');
select tests.throws(format('select public.choose_gym(%L)', :'g3'), 'primary_gym_change_too_soon',
                    'primary gym can change once every 30 days');
select tests.throws(format('select public.remove_gym(%L)', :'g2'), 'cannot_remove_primary_gym', 'primary cannot be removed');
select public.remove_gym(:'g3');
select tests.eq(tests.count_rows('select * from public.user_gyms'), 2::bigint, 'secondary gym removed');

-- Goal: immediate without history.
select tests.eq((select weekly_goal from public.set_weekly_goal(4)), 4::smallint, 'goal applies immediately for a new player');
select tests.throws('select public.set_weekly_goal(6)', 'invalid_goal', 'goal is 2..5');
select tests.reset_role();

-- With history, the change waits for next Monday.
insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
values (:'alice', :'g2', 'geofence', now() - interval '2 days 1 hour', now() - interval '2 days', 60, now() - interval '2 days', current_date);
select tests.authenticate_as(:'alice');
select tests.eq((select pending_weekly_goal from public.set_weekly_goal(2)), 2::smallint, 'goal change is pending');
select tests.eq((select weekly_goal from public.profiles where id = :'alice'), 4::smallint, 'current goal unchanged this week');
select tests.eq((select goal_effective_from from public.profiles where id = :'alice'),
                app_private.game_week_start(now()) + 7, 'pending goal starts next Monday');
select tests.eq(app_private.effective_goal(:'alice', app_private.game_week_start(now()) + 7), 2::smallint,
                'effective goal next week is the pending one');
select tests.reset_role();

-- Europe/Paris week boundaries (CET, winter).
select tests.eq(app_private.paris_date('2026-11-02 23:30:00+00'), '2026-11-03'::date, 'Paris date after UTC midnight shift');
select tests.eq(app_private.game_week_start('2026-11-08 18:59:00+00'), '2026-11-02'::date, 'Sunday 19:59 Paris is still this week');
select tests.eq(app_private.game_week_start('2026-11-08 19:00:00+00'), '2026-11-09'::date, 'Sunday 20:00 Paris is next week');
select tests.eq(app_private.game_week_start('2026-11-02 00:30:00+00'), '2026-11-02'::date, 'Monday 01:30 Paris');
-- Summer time (CEST).
select tests.eq(app_private.game_week_start('2026-06-14 17:59:00+00'), '2026-06-08'::date, 'Sunday 19:59 CEST');
select tests.eq(app_private.game_week_start('2026-06-14 18:00:00+00'), '2026-06-15'::date, 'Sunday 20:00 CEST');
select tests.eq(app_private.week_deadline('2026-11-02'), '2026-11-08 19:00:00+00'::timestamptz, 'deadline is Sunday 20:00 Paris');

-- Profile is created with the auth user and deleted with it.
select tests.ok(exists (select 1 from public.profiles where id = :'alice'), 'profile auto-created');
delete from auth.users where id = :'alice';
select tests.ok(not exists (select 1 from public.profiles where id = :'alice'), 'profile removed with the account');
select tests.ok(not exists (select 1 from public.sessions where user_id = :'alice'), 'sessions removed with the account');

rollback;
