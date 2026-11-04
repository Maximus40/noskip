-- validate_session: the server clock decides, not the phone.
-- now() is frozen inside a transaction, so "time passing" is simulated by moving
-- server_opened_at back with the protecting trigger temporarily disabled (superuser only).
begin;

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.create_user('eve@test.local') as eve \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/501', 'Salle', 50.63, 3.06) returning id as gym \gset
insert into public.gyms (osm_id, name, lat, lng) values ('node/502', 'Autre', 50.64, 3.07) returning id as gym2 \gset

select tests.authenticate_as(:'alice');
select id as team from public.create_team('Duo') \gset
select count(*) from public.choose_gym(:'gym');
select count(*) from public.choose_gym(:'gym2', false);
-- Phone claims it arrived 2 hours ago (backdated).
select id as sess from public.start_session(:'gym', now() - interval '2 hours', 'geofence') \gset
select tests.eq((select id from public.my_open_session()), :'sess'::uuid, 'open session is visible to its owner');
select tests.reset_role();

select tests.ok((select server_opened_at = now() from public.sessions where id = :'sess'), 'server clock starts at open time');

-- Players cannot call the service wrapper.
select tests.authenticate_as(:'alice');
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'alice', :'gym'), '42501',
                    'players cannot validate through the wrapper');
select tests.throws('select * from public.svc_teammate_push_targets(auth.uid(), ''plate_loaded'')', '42501',
                    'players cannot list push tokens');
select tests.reset_role();

select tests.as_service();
-- Backdating does not help: the server has only seen the session for a few seconds.
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'alice', :'gym'),
                    'session_too_short', 'backdated start is ignored, server clock rules');
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'alice', :'gym2'),
                    'gym_mismatch', 'validation must be at the gym the session was opened at');
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'bob', :'gym'),
                    'no_open_session', 'nothing to validate without an open session');
select tests.reset_role();

-- 30 minutes really passed: still too short.
alter table public.sessions disable trigger sessions_server_clock;
update public.sessions set server_opened_at = now() - interval '30 minutes' where id = :'sess';
alter table public.sessions enable trigger sessions_server_clock;
select tests.as_service();
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'alice', :'gym'),
                    'session_too_short', '30 minutes is not a session');
select tests.reset_role();

-- 47 minutes really passed: validated. A future end is clamped to now().
alter table public.sessions disable trigger sessions_server_clock;
update public.sessions set server_opened_at = now() - interval '47 minutes' where id = :'sess';
alter table public.sessions enable trigger sessions_server_clock;
select tests.as_service();
select * from public.svc_validate_session(:'alice', :'gym', now() + interval '3 hours') \gset v_
select tests.eq(:v_duration_min, 52, 'duration counts from the server clock minus 5 min grace (47+5)');
select tests.eq(:v_done_this_week, 1, 'first plate of the week');
select tests.eq(:v_lifetime_sessions, 1, 'lifetime counter incremented');
select tests.ok((select ended_at = now() from public.sessions where id = :'sess'), 'end clamped to server time');
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'alice', :'gym'),
                    'already_validated_today', 'one validated session per day');
select tests.reset_role();

-- Re-opening a cancelled session restarts the server clock.
select tests.authenticate_as(:'bob');
select count(*) from public.choose_gym(:'gym');
select id as bsess from public.start_session(:'gym', now() - interval '10 minutes', 'manual_check') \gset
select public.cancel_session();
select tests.reset_role();
alter table public.sessions disable trigger sessions_server_clock;
update public.sessions set server_opened_at = now() - interval '2 hours' where id = :'bsess';
alter table public.sessions enable trigger sessions_server_clock;
select tests.authenticate_as(:'bob');
select public.start_session(:'gym', now(), 'manual_check') is not null;
select tests.reset_role();
select tests.ok((select server_opened_at = now() from public.sessions where id = :'bsess'), 're-open resets the server clock');
-- The player cannot move the clock back himself.
select tests.authenticate_as(:'bob');
select tests.throws(format('update public.sessions set server_opened_at = now() - interval ''1 day'' where id = %L', :'bsess'),
                    '42501', 'players cannot touch the server clock');
select tests.reset_role();

-- Demo mode (dev projects only) skips the server-clock check, nothing else.
select tests.authenticate_as(:'eve');
select count(*) from public.choose_gym(:'gym');
select public.start_session(:'gym', now() - interval '50 minutes', 'geofence') is not null;
select tests.reset_role();
select tests.as_service();
select tests.throws(format('select * from public.svc_validate_session(%L, %L, now())', :'eve', :'gym'),
                    'session_too_short', 'without demo the same session is refused');
select tests.eq((select duration_min from public.svc_validate_session(:'eve', :'gym', now(), true)), 50,
                'demo session validates on phone timestamps');
select tests.reset_role();

rollback;
