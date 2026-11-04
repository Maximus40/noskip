begin;

-- Weeks used: w0 = last closed-able week, w1 = the one before, w2 = the one before that.
select app_private.game_week_start(now()) - 7 as w0 \gset
select (:'w0'::date - 7) as w1 \gset
select (:'w0'::date - 14) as w2 \gset

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
select tests.create_user('d@test.local') as d \gset
select tests.create_user('e@test.local') as e \gset
select tests.create_user('f@test.local') as f \gset
select tests.create_user('x@test.local') as x \gset
update public.profiles set pseudo = 'Karim', weekly_goal = 3 where id = :'a';
update public.profiles set pseudo = 'Maxime', weekly_goal = 3 where id = :'b';
update public.profiles set pseudo = 'Sofiane', weekly_goal = 2 where id = :'c';
update public.profiles set pseudo = 'Lina', weekly_goal = 3 where id = :'d';
update public.profiles set pseudo = 'Inès', weekly_goal = 2 where id = :'e';
update public.profiles set pseudo = 'Tom', weekly_goal = 2 where id = :'f';
insert into public.gyms (osm_id, name, lat, lng) values ('node/701', 'Salle', 48.8, 2.3) returning id as gym \gset

-- A validated session on day `k` (0 = Monday) of week `wk`, at 10:00 Paris.
create function pg_temp.train(p_user uuid, p_gym uuid, p_week date, p_day int) returns void
language sql as $$
  insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
  values (p_user, p_gym, 'geofence',
          ((p_week + p_day)::timestamp + interval '9 hours') at time zone 'Europe/Paris',
          ((p_week + p_day)::timestamp + interval '10 hours') at time zone 'Europe/Paris',
          60,
          ((p_week + p_day)::timestamp + interval '10 hours') at time zone 'Europe/Paris',
          (p_week + p_day))
$$;

select tests.authenticate_as(:'a');
select id as team, invite_code as code from public.create_team('Les Déchaînés') \gset
select tests.reset_role();
select tests.authenticate_as(:'e');
select id as duo, invite_code as duo_code from public.create_team('Binôme') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'b', :'code');
select public.svc_join_team(:'c', :'code');
select public.svc_join_team(:'d', :'code');
select public.svc_join_team(:'f', :'duo_code');
select tests.reset_role();

-- The teams exist since well before w2; Lina joined on Saturday of w0.
update public.teams set created_at = (:'w2'::date - 30)::timestamptz where id in (:'team', :'duo');
update public.team_members set joined_at = (:'w2'::date - 30)::timestamptz where team_id in (:'team', :'duo');
update public.team_members set joined_at = ((:'w0'::date + 5)::timestamp + interval '10 hours') at time zone 'Europe/Paris'
 where user_id = :'d';

-- w0, main team: Karim 3/3, Maxime 1/3, Sofiane 0/2 with an injury joker, Lina 0/3 (joined Saturday).
select pg_temp.train(:'a', :'gym', :'w0', 0), pg_temp.train(:'a', :'gym', :'w0', 2), pg_temp.train(:'a', :'gym', :'w0', 4);
select pg_temp.train(:'b', :'gym', :'w0', 1);
insert into public.jokers (user_id, month, week_start) values (:'c', date_trunc('month', :'w0'::date)::date, :'w0');
-- A session on Sunday after 20:00 belongs to the next week and must not count.
insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
values (:'b', :'gym', 'geofence',
        ((:'w0'::date + 6)::timestamp + interval '20 hours 10 minutes') at time zone 'Europe/Paris',
        ((:'w0'::date + 6)::timestamp + interval '21 hours 10 minutes') at time zone 'Europe/Paris', 60,
        ((:'w0'::date + 6)::timestamp + interval '21 hours 10 minutes') at time zone 'Europe/Paris', :'w0'::date + 6);

-- Duo: w2 Tom fails, w1 both hold, w0 both hold (more kg than w1).
select pg_temp.train(:'e', :'gym', :'w2', 0), pg_temp.train(:'e', :'gym', :'w2', 1), pg_temp.train(:'f', :'gym', :'w2', 1);
select pg_temp.train(:'e', :'gym', :'w1', 0), pg_temp.train(:'e', :'gym', :'w1', 1);
select pg_temp.train(:'f', :'gym', :'w1', 2), pg_temp.train(:'f', :'gym', :'w1', 3);
select pg_temp.train(:'e', :'gym', :'w0', 0), pg_temp.train(:'e', :'gym', :'w0', 1), pg_temp.train(:'e', :'gym', :'w0', 2);
select pg_temp.train(:'f', :'gym', :'w0', 3), pg_temp.train(:'f', :'gym', :'w0', 4);

-- ---------------------------------------------------------------------------
-- Rights
-- ---------------------------------------------------------------------------
select tests.authenticate_as(:'a');
select tests.throws(format('select public.svc_close_team_week(%L, %L, %L)', :'team', :'w0', '{}'), '42501',
                    'players cannot close a week');
select tests.throws('select * from public.svc_claim_shaky_alerts(true)', '42501', 'players cannot trigger alerts');
select tests.throws('select public.svc_cron_secret_ok(''x'')', '42501', 'players cannot probe the cron secret');
select tests.throws('select * from public.shaky_alerts', '42501', 'shaky alerts are private');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- Closing
-- ---------------------------------------------------------------------------
select tests.as_service();
select tests.eq(public.svc_due_week(), :'w0'::date, 'the due week is the last finished one');
select tests.ok(:'team'::uuid in (select team_id from public.svc_teams_to_close(:'w0')), 'team is waiting to be closed');
select tests.throws(format('select public.svc_close_team_week(%L, %L, %L)', :'team', app_private.game_week_start(now()), '{}'),
                    'week_not_over', 'the current week cannot be closed early');
select tests.throws(format('select public.svc_close_team_week(%L, %L, %L)', :'team', :'w0'::date + 1, '{}'),
                    'invalid_week', 'a week starts on Monday');

select tests.eq(
  (public.svc_close_team_week(:'team', :'w0', jsonb_build_object(:'b', 'leg-day', :'a', 'unused')) ->> 'newly_closed')::boolean,
  true, 'closing the week');
select id as wk0 from public.weeks where team_id = :'team' and week_start = :'w0' \gset

select tests.eq((select total_kg from public.weeks where id = :'wk0'), 80, '4 sessions = 80 kg (Sunday 21:10 excluded)');
select tests.eq((select skips_count from public.weeks where id = :'wk0'), 1, 'one SKIP');
select tests.eq((select user_id from public.skip_cards where week_id = :'wk0'), :'b'::uuid, 'SKIP card for Maxime');
select tests.eq((select line_id from public.skip_cards where week_id = :'wk0'), 'leg-day', 'line drawn by the function');
select tests.eq((select machine_user_id from public.weeks where id = :'wk0'), :'a'::uuid, 'Karim is the machine of the week');
select tests.eq((select skipper_user_id from public.weeks where id = :'wk0'), :'b'::uuid, 'Maxime is the skipper of the week');
select tests.ok(not (select is_team_pr from public.weeks where id = :'wk0'), 'no team PR');
select tests.eq((select count(*) from public.week_results where week_id = :'wk0'), 4::bigint, 'one result per player');
select tests.ok((select used_joker and not achieved from public.week_results where week_id = :'wk0' and user_id = :'c'),
                'joker recorded, no card');
select tests.ok((select exempt from public.week_results where week_id = :'wk0' and user_id = :'d'),
                'late joiner exempt');
select tests.ok((select achieved and done = 3 from public.week_results where week_id = :'wk0' and user_id = :'a'),
                'Karim achieved');

-- Idempotent replay.
select tests.eq(
  (public.svc_close_team_week(:'team', :'w0', jsonb_build_object(:'b', 'other')) ->> 'newly_closed')::boolean,
  false, 'replaying close-week does nothing');
select tests.eq((select count(*) from public.skip_cards where week_id = :'wk0'), 1::bigint, 'no duplicate card');
select tests.eq((select line_id from public.skip_cards where week_id = :'wk0'), 'leg-day', 'card unchanged');
select tests.ok(:'team'::uuid not in (select team_id from public.svc_teams_to_close(:'w0')), 'closed team no longer listed');

-- Notification claims are one-shot.
select tests.ok(:'wk0'::uuid in (select week_id from public.svc_weeks_pending_notification('skip')), 'skip push pending');
select tests.ok(public.svc_claim_week_notification(:'wk0', 'skip'), 'skip push claimed');
select tests.ok(:'wk0'::uuid not in (select week_id from public.svc_weeks_pending_notification('skip')), 'skip push no longer pending');
select tests.ok(not public.svc_claim_week_notification(:'wk0', 'skip'), 'skip push never sent twice');
select tests.ok(:'wk0'::uuid in (select week_id from public.svc_weeks_pending_notification('recap')), 'recap pending');
select tests.ok(public.svc_claim_week_notification(:'wk0', 'recap'), 'recap claimed');
select tests.ok(:'wk0'::uuid not in (select week_id from public.svc_weeks_pending_notification('recap')), 'recap no longer pending');
select tests.throws(format('select public.svc_claim_week_notification(%L, %L)', :'wk0', 'other'), 'invalid_step', 'unknown step');

-- Summary for the pushes.
select tests.eq((public.svc_week_summary(:'wk0') ->> 'machine_pseudo'), 'Karim', 'summary names the machine');
select tests.eq((public.svc_week_summary(:'wk0') -> 'skip_cards' -> 0 ->> 'pseudo'), 'Maxime', 'summary lists SKIP cards');
select tests.eq((select line_id from public.svc_recent_skip_lines(:'team', 5)), 'leg-day', 'recent lines for the draw');

-- Duo streak and record over three weeks.
select public.svc_close_team_week(:'duo', :'w2', jsonb_build_object(:'f', 'canap-pr-sieste'));
select tests.eq((select current_weeks from public.duo_streaks where team_id = :'duo'), 0, 'w2: Tom skipped, streak 0');
select public.svc_close_team_week(:'duo', :'w1', '{}');
select tests.eq((select current_weeks from public.duo_streaks where team_id = :'duo'), 1, 'w1: both held, streak 1');
select tests.ok((select is_team_pr and is_record from public.weeks where team_id = :'duo' and week_start = :'w1'),
                'w1: team PR and record (80 kg)');
select public.svc_close_team_week(:'duo', :'w0', '{}');
select tests.eq((select current_weeks from public.duo_streaks where team_id = :'duo'), 2, 'w0: streak 2');
select tests.eq((select best_weeks from public.duo_streaks where team_id = :'duo'), 2, 'best streak 2');
select tests.ok((select is_record and total_kg = 100 from public.weeks where team_id = :'duo' and week_start = :'w0'),
                'w0: 100 kg beats 80 kg');
select tests.ok((select not is_record from public.weeks where team_id = :'duo' and week_start = :'w2'),
                'w2: no PR when someone skips');
select tests.eq((select line_id from public.skip_cards c join public.weeks w on w.id = c.week_id
                  where w.team_id = :'duo' and w.week_start = :'w2'), 'canap-pr-sieste', 'duo skip card');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- App reads
-- ---------------------------------------------------------------------------
select tests.authenticate_as(:'b');
select tests.eq((select count(*) from public.week_recap(:'wk0')), 4::bigint, 'member reads the recap');
select tests.eq((select line_id from public.week_recap(:'wk0') where is_me), 'leg-day', 'my card in the recap');
select tests.eq((select skips_count from public.team_history(:'team') limit 1), 1, 'history lists the week');
select tests.eq((select week_id from public.latest_closed_week(:'team')), :'wk0'::uuid, 'latest closed week');
select tests.eq(public.skip_card_week((select id from public.skip_cards where week_id = :'wk0')), :'wk0'::uuid,
                'card → week');
select tests.eq(tests.count_rows('select * from public.skip_cards'), 1::bigint, 'I see my team''s cards only');
select tests.reset_role();

select tests.authenticate_as(:'x');
select tests.throws(format('select * from public.week_recap(%L)', :'wk0'), 'not_found', 'outsider cannot read the recap');
select tests.throws(format('select * from public.team_history(%L)', :'team'), 'not_a_member', 'outsider has no history');
select tests.throws(format('select public.skip_card_week(%L)', (select id from public.skip_cards where week_id = :'wk0')),
                    'not_found', 'outsider cannot resolve a card');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- "La barre tremble" (Thursday of w0 at 18:30 Paris: 4 days left including today)
-- ---------------------------------------------------------------------------
select tests.create_user('g@test.local') as g \gset
select tests.create_user('h@test.local') as h \gset
select tests.create_user('i@test.local') as i \gset
select tests.create_user('j@test.local') as j \gset
update public.profiles set pseudo = 'Gabin', weekly_goal = 5 where id = :'g';
update public.profiles set pseudo = 'Hugo', weekly_goal = 3 where id = :'h';
update public.profiles set pseudo = 'Iris', weekly_goal = 5 where id = :'i';
update public.profiles set pseudo = 'Jade', weekly_goal = 5 where id = :'j';
select tests.authenticate_as(:'g');
select invite_code as gcode from public.create_team('Tremble') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'h', :'gcode');
select public.svc_join_team(:'i', :'gcode');
select public.svc_join_team(:'j', :'gcode');
select tests.reset_role();
select pg_temp.train(:'g', :'gym', :'w0', 0);
select pg_temp.train(:'i', :'gym', :'w0', 0);
insert into public.jokers (user_id, month, week_start) values (:'i', date_trunc('month', :'w0'::date)::date, :'w0')
on conflict do nothing;
select pg_temp.train(:'j', :'gym', :'w0', 0), pg_temp.train(:'j', :'gym', :'w0', 3);

select ((:'w0'::date + 3)::timestamp + interval '18 hours 30 minutes') at time zone 'Europe/Paris' as thu \gset
select ((:'w0'::date + 3)::timestamp + interval '17 hours') at time zone 'Europe/Paris' as thu_early \gset

select tests.eq((select count(*) from app_private.claim_shaky_alerts(:'thu_early', false)
                  where user_id in (:'g', :'h', :'i', :'j')), 0::bigint, 'nothing before 18:00');
create temp table shaky as
  select * from app_private.claim_shaky_alerts(:'thu', false) where user_id in (:'g', :'h', :'i', :'j');
select tests.ok(:'g'::uuid in (select user_id from shaky), 'Gabin (1/5, 4 days left) is shaky');
select tests.eq((select missing from shaky where user_id = :'g'), 4, 'Gabin misses 4 sessions');
select tests.ok(:'h'::uuid not in (select user_id from shaky), 'Hugo (0/3, 4 days left) is safe');
select tests.ok(:'i'::uuid not in (select user_id from shaky), 'Iris has a joker');
select tests.ok(:'j'::uuid in (select user_id from shaky), 'Jade trained today: 3 missing, 3 days left');
select tests.eq((select days_left from shaky where user_id = :'j'), 3, 'today no longer counts for Jade');
select tests.eq((select count(*) from app_private.claim_shaky_alerts(:'thu', false)
                  where user_id in (:'g', :'h', :'i', :'j')), 0::bigint, 'one alert per day');

-- ---------------------------------------------------------------------------
-- Cron secret
-- ---------------------------------------------------------------------------
select tests.as_service();
select tests.ok(not public.svc_cron_secret_ok('nope'), 'no config: every secret is refused');
select tests.reset_role();
insert into app_private.cron_config (functions_url, secret)
values ('https://example.supabase.co/functions/v1', repeat('s', 40));
select tests.as_service();
select tests.ok(public.svc_cron_secret_ok(repeat('s', 40)), 'right secret accepted');
select tests.ok(not public.svc_cron_secret_ok(repeat('t', 40)), 'wrong secret refused');
select tests.reset_role();
select tests.eq(app_private.install_cron_jobs(), 'skipped: pg_cron / pg_net not installed', 'cron install is conditional');

rollback;
