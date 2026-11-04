begin;

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
select tests.create_user('d@test.local') as d \gset
select tests.create_user('e@test.local') as e \gset
select tests.create_user('x@test.local') as x \gset
update public.profiles set pseudo = 'Karim' where id = :'a';
insert into public.gyms (osm_id, name, lat, lng) values ('node/601', 'Salle', 50.6, 3.0) returning id as gym \gset

select tests.authenticate_as(:'a');
select id as team, invite_code as code from public.create_team('Spotters') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'b', :'code');
select public.svc_join_team(:'c', :'code');
select public.svc_join_team(:'d', :'code');
select tests.reset_role();

select tests.authenticate_as(:'a');
select tests.throws(format('select * from public.svc_send_spot(%L, %L, %L)', :'a', :'b', :'team'), '42501',
                    'players cannot call the spot wrapper directly');
select tests.reset_role();

select tests.as_service();
select tests.eq((select from_pseudo from public.svc_send_spot(:'a', :'b', :'team')), 'Karim', 'first spot sent');
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'a', :'b', :'team'), 'already_spotted_today',
                    'one spot per day to the same person');
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'a', :'a', :'team'), 'cannot_spot_self', 'no self spot');
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'a', :'x', :'team'), 'not_a_member', 'only teammates');
select tests.eq((select sent_today from public.svc_send_spot(:'a', :'c', :'team')), 2, 'second spot');
select tests.eq((select sent_today from public.svc_send_spot(:'a', :'d', :'team')), 3, 'third spot');
select tests.reset_role();

-- Fourth teammate needed for the daily cap test.
select tests.as_service();
insert into public.team_subscriptions (team_id, status) values (:'team', 'active');
select public.svc_join_team(:'e', :'code');
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'a', :'e', :'team'), 'spot_daily_limit', '3 spots per day max');
-- b can still spot a (limits are per sender).
select tests.eq((select sent_today from public.svc_send_spot(:'b', :'a', :'team')), 1, 'limits are per sender');
select tests.reset_role();

-- No spot for someone who already trained today, or who has a joker.
insert into public.user_gyms (user_id, gym_id, is_primary) values (:'e', :'gym', true);
insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
values (:'e', :'gym', 'geofence', now() - interval '1 hour', now(), 60, now(), current_date);
insert into public.jokers (user_id, month, week_start)
values (:'d', date_trunc('month', now())::date, app_private.game_week_start(now()));
select tests.as_service();
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'b', :'e', :'team'), 'already_trained_today',
                    'no spot once the session is done');
select tests.throws(format('select public.svc_send_spot(%L, %L, %L)', :'b', :'d', :'team'), 'player_has_joker',
                    'no spot for an injured player');
select tests.reset_role();

select tests.authenticate_as(:'a');
select tests.eq((select count(*) from public.my_spots_today()), 3::bigint, 'I see my 3 spots of the day');
select tests.eq(tests.count_rows('select * from public.spots'), 4::bigint, 'spots I sent or received are readable');
select tests.reset_role();

rollback;
