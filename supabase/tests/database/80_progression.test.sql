begin;

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
select tests.create_user('x@test.local') as x \gset
update public.profiles set pseudo = 'Karim', weekly_goal = 3, lifetime_sessions = 17 where id = :'a';
update public.profiles set pseudo = 'Maxime', weekly_goal = 4 where id = :'b';
update public.profiles set pseudo = 'Sofiane', weekly_goal = 2 where id = :'c';
insert into public.gyms (osm_id, name, lat, lng) values ('node/801', 'Salle', 48.8, 2.3) returning id as gym \gset

select tests.authenticate_as(:'a');
select id as team, invite_code as code from public.create_team('Les Déchaînés') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'b', :'code');
select public.svc_join_team(:'c', :'code');
select tests.reset_role();
update public.team_members set joined_at = '2026-08-01' where team_id = :'team';

-- ---------------------------------------------------------------------------
-- Joker blessure
-- ---------------------------------------------------------------------------
select app_private.game_week_start(now()) as wk \gset
select date_trunc('month', :'wk'::date)::date as wk_month \gset

select tests.authenticate_as(:'a');
select tests.eq((select week_start from public.declare_joker()), :'wk'::date, 'joker declared for the current week');
select tests.eq((select month from public.declare_joker()), :'wk_month'::date, 'declaring again is idempotent');
select tests.eq(tests.count_rows('select * from public.jokers where user_id = auth.uid()'), 1::bigint, 'one joker row');
-- Feeling better: the joker is withdrawn, the month's joker is free again, then re-declared.
select tests.eq(public.cancel_joker(), true, 'joker withdrawn');
select tests.eq(tests.count_rows('select * from public.jokers where user_id = auth.uid()'), 0::bigint, 'no joker left');
select tests.eq(public.cancel_joker(), false, 'nothing to withdraw twice');
select tests.eq((select week_start from public.declare_joker()), :'wk'::date, 'the month joker can be used again');
select tests.reset_role();
select tests.throws('select public.cancel_joker()', 'not_authenticated', 'nobody signed in: refused');

-- Maxime already used his joker of the month on another week.
insert into public.jokers (user_id, month, week_start) values (:'b', :'wk_month', :'wk'::date - 7);
select tests.authenticate_as(:'b');
select tests.throws('select * from public.declare_joker()', 'joker_already_used', 'one joker per month');
select tests.reset_role();

-- Sofiane already reached the goal this week: a joker makes no sense.
insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
select :'c', :'gym', 'geofence', ts - interval '1 hour', ts, 60, ts, app_private.paris_date(ts - interval '1 hour')
from (values (:'wk'::date::timestamp + interval '10 hours'), (:'wk'::date::timestamp + interval '1 day 10 hours')) v(t),
     lateral (select (t at time zone 'Europe/Paris') as ts) z;
select tests.authenticate_as(:'c');
select tests.throws('select * from public.declare_joker()', 'goal_already_reached', 'no joker once the goal is reached');
select tests.reset_role();

select tests.authenticate_anon();
select tests.throws('select * from public.declare_joker()', '42501', 'anon cannot declare a joker');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- September 2026, four closed weeks
--   Karim  : 4/4 goals, 12 sessions          → Ceinture
--   Maxime : 3/4 goals, 13 sessions, 1 skip
--   Sofiane: 1/2 goals (2 joker weeks), 4 sessions, 1 skip → Gros Canap' (fewer sessions)
-- An October week must not count.
-- ---------------------------------------------------------------------------
create function pg_temp.week(p_team uuid, p_start date) returns uuid
language sql as $$
  insert into public.weeks (team_id, week_start, closed_at) values (p_team, p_start, now()) returning id
$$;
create function pg_temp.res(p_week uuid, p_user uuid, p_goal int, p_done int, p_joker boolean default false)
returns void language sql as $$
  insert into public.week_results (week_id, user_id, goal, done, achieved, used_joker)
  values (p_week, p_user, p_goal, p_done, p_done >= p_goal, p_joker)
$$;

select pg_temp.week(:'team', '2026-09-07') as w1 \gset
select pg_temp.week(:'team', '2026-09-14') as w2 \gset
select pg_temp.week(:'team', '2026-09-21') as w3 \gset
select pg_temp.week(:'team', '2026-09-28') as w4 \gset
select pg_temp.week(:'team', '2026-10-05') as w5 \gset
select pg_temp.res(:'w1', :'a', 3, 3), pg_temp.res(:'w1', :'b', 4, 4), pg_temp.res(:'w1', :'c', 2, 0, true);
select pg_temp.res(:'w2', :'a', 3, 3), pg_temp.res(:'w2', :'b', 4, 3), pg_temp.res(:'w2', :'c', 2, 0, true);
select pg_temp.res(:'w3', :'a', 3, 3), pg_temp.res(:'w3', :'b', 4, 3), pg_temp.res(:'w3', :'c', 2, 1);
select pg_temp.res(:'w4', :'a', 3, 3), pg_temp.res(:'w4', :'b', 4, 3), pg_temp.res(:'w4', :'c', 2, 3);
select pg_temp.res(:'w5', :'a', 3, 0), pg_temp.res(:'w5', :'b', 4, 9), pg_temp.res(:'w5', :'c', 2, 0);
-- Maxime got 4/4 in w1 only… make w2 and w3 achieved for him too (3/4 goals overall).
update public.week_results set goal = 3, achieved = true where week_id in (:'w2', :'w3') and user_id = :'b';
insert into public.skip_cards (week_id, team_id, user_id, line_id) values
  (:'w4', :'team', :'b', 'leg-day'),
  (:'w3', :'team', :'c', 'plaid'),
  (:'w5', :'team', :'a', 'lundi'),
  (:'w5', :'team', :'c', 'meteo');
update public.week_results set achieved = false where week_id = :'w4' and user_id = :'b';

select tests.authenticate_as(:'a');
select tests.throws(format('select * from public.svc_award_team_belts(%L, %L)', :'team', '2026-09-01'), '42501',
                    'players cannot award belts');
select tests.reset_role();

select tests.as_service();
select tests.ok(:'team'::uuid in (select team_id from public.svc_teams_for_belts('2026-09-01')), 'team has weeks in September');
create temp table awarded as select * from public.svc_award_team_belts(:'team', '2026-09-01');
select tests.eq((select user_id from awarded where type = 'belt'), :'a'::uuid, 'Karim takes the Ceinture (100 %)');
select tests.eq((select user_id from awarded where type = 'big_canap'), :'c'::uuid,
                'Gros Canap'': tie on skips, fewer sessions wins');
select tests.eq((select count(*) from public.svc_award_team_belts(:'team', '2026-09-01')), 0::bigint,
                'awarding again does nothing');
select tests.eq((select count(*) from public.belts where team_id = :'team'), 2::bigint, 'two trophies stored');
select tests.throws(format('select * from public.svc_award_team_belts(%L, %L)', :'team',
                           date_trunc('month', app_private.paris_date(now()))::date),
                    'month_not_over', 'the current month cannot be awarded');
select tests.throws(format('select * from public.svc_award_team_belts(%L, %L)', :'team', '2026-09-02'),
                    'invalid_month', 'a month starts on the 1st');

select tests.eq((select count(*) from public.svc_pending_belts() where team_id = :'team'), 2::bigint, 'two pushes pending');
select tests.ok(public.svc_claim_belt_notification(:'team', '2026-09-01', 'belt'), 'belt push claimed');
select tests.ok(not public.svc_claim_belt_notification(:'team', '2026-09-01', 'belt'), 'belt push never sent twice');
select tests.eq((select pseudo from public.svc_pending_belts() where team_id = :'team'), 'Sofiane', 'one push left');
select tests.reset_role();

-- Month boundaries (Paris): nothing before the 1st at 10:00.
select tests.ok(app_private.due_belt_month('2026-12-01 08:30+01', false) is null, 'too early on the 1st');
select tests.eq(app_private.due_belt_month('2026-12-01 10:30+01', false), '2026-11-01'::date, 'after 10:00 on the 1st');
select tests.eq(app_private.due_belt_month('2026-12-01 08:30+01', true), '2026-11-01'::date, 'forced');
select tests.eq(app_private.due_belt_month('2026-07-01 08:30+00', false), '2026-06-01'::date,
                'summer: 08:30 UTC is 10:30 Paris');
select tests.eq(app_private.due_belt_month('2027-01-15 12:00+01', false), '2026-12-01'::date, 'mid-month');

-- ---------------------------------------------------------------------------
-- Lifter card
-- ---------------------------------------------------------------------------
select tests.authenticate_as(:'a');
select tests.eq((select lifetime_sessions from public.lifter_card()), 17, 'my card');
select tests.ok((select is_me and joker_this_week and joker_month_used from public.lifter_card()), 'my joker on my card');
select tests.eq((select skips_total from public.lifter_card()), 1, 'my SKIP count');
select tests.eq((select jsonb_array_length(belts) from public.lifter_card()), 1, 'my Ceinture on my card');
select tests.eq((select belts -> 0 ->> 'team_name' from public.lifter_card()), 'Les Déchaînés', 'belt names the team');
select tests.eq((select jsonb_array_length(history) from public.lifter_card()), 5, 'five closed weeks in my history');
select tests.eq((select history -> 0 ->> 'week_start' from public.lifter_card()), '2026-10-05', 'newest week first');
select tests.eq((select pseudo from public.lifter_card(:'c')), 'Sofiane', 'a teammate''s card');
select tests.ok((select not is_me from public.lifter_card(:'c')), 'not mine');
select tests.throws(format('select * from public.lifter_card(%L)', :'x'), 'not_found', 'no card of a stranger');
select tests.reset_role();

rollback;
