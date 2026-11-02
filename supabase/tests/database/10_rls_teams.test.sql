-- A player can never read a team they are not a member of.
begin;

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.create_user('carol@test.local') as carol \gset

update public.profiles set pseudo = 'Alice' where id = :'alice';
update public.profiles set pseudo = 'Bob' where id = :'bob';
update public.profiles set pseudo = 'Carol' where id = :'carol';

-- Alice creates "Les Déchaînés", Carol creates her own team.
select tests.authenticate_as(:'alice');
select id as team_a, invite_code as code_a from public.create_team('Les Déchaînés') \gset
select tests.ok(:'code_a' ~ '^[A-HJ-NP-Z2-9]{8}$', 'invite code has 8 unambiguous chars');
select tests.eq((select role::text from public.team_members where team_id = :'team_a' and user_id = :'alice'),
                'owner', 'creator is owner');
select tests.reset_role();

select tests.authenticate_as(:'carol');
select id as team_c from public.create_team('Team Carol') \gset
select tests.reset_role();

-- Bob (no team) sees nothing about team A.
select tests.authenticate_as(:'bob');
select tests.eq(tests.count_rows('select * from public.teams'), 0::bigint, 'outsider sees no team');
select tests.eq(tests.count_rows(format('select * from public.team_members where team_id = %L', :'team_a')), 0::bigint,
                'outsider sees no members');
select tests.eq(tests.count_rows(format('select * from public.profiles where id = %L', :'alice')), 0::bigint,
                'outsider cannot read a stranger profile');
select tests.eq(tests.count_rows(format('select * from public.weeks where team_id = %L', :'team_a')), 0::bigint,
                'outsider sees no weeks');
select tests.throws(format('select * from public.team_board(%L)', :'team_a'), 'not_a_member',
                    'outsider cannot read the team board');
select tests.throws(format('insert into public.team_members (team_id, user_id, plate_color) values (%L, %L, %L)',
                           :'team_a', :'bob', '#B9BBC0'),
                    '42501', 'a player cannot add himself to a team');
select tests.reset_role();

-- Alice sees her team but not Carol's.
select tests.authenticate_as(:'alice');
select tests.eq(tests.count_rows('select * from public.teams'), 1::bigint, 'member sees exactly her team');
select tests.eq(tests.count_rows(format('select * from public.teams where id = %L', :'team_c')), 0::bigint,
                'member cannot read another team');
select tests.reset_role();

-- Bob joins team A (join-team Edge Function runs with the service role).
select tests.as_service();
insert into public.team_members (team_id, user_id, plate_color) values (:'team_a', :'bob', '#7C7E84');
select tests.reset_role();

select tests.authenticate_as(:'bob');
select tests.eq(tests.count_rows('select * from public.teams'), 1::bigint, 'new member now sees the team');
select tests.eq(tests.count_rows(format('select * from public.profiles where id = %L', :'alice')), 1::bigint,
                'teammate profile is visible');
select tests.eq(tests.count_rows(format('select * from public.profiles where id = %L', :'carol')), 0::bigint,
                'non-teammate profile stays hidden');
select tests.eq(tests.count_rows(format('select * from public.team_board(%L)', :'team_a')), 2::bigint,
                'board lists both members');
-- A member cannot kick the owner.
delete from public.team_members where team_id = :'team_a' and user_id = :'alice';
select tests.reset_role();
select tests.eq(tests.count_rows(format('select * from public.team_members where team_id = %L', :'team_a')), 2::bigint,
                'member cannot remove the owner');

-- A member cannot rename the team nor read invite codes of other teams.
select tests.authenticate_as(:'bob');
select tests.throws(format('update public.teams set name = %L where id = %L', 'Hacked', :'team_a'), '42501',
                    'member cannot update team row directly');
select tests.reset_role();

-- The owner can remove a member.
select tests.authenticate_as(:'alice');
delete from public.team_members where team_id = :'team_a' and user_id = :'bob';
select tests.reset_role();
select tests.eq(tests.count_rows(format('select * from public.team_members where team_id = %L', :'team_a')), 1::bigint,
                'owner can remove a member');

-- Anonymous users get nothing at all.
select tests.authenticate_anon();
select tests.throws('select * from public.teams', '42501', 'anon cannot select teams');
select tests.throws('select * from public.profiles', '42501', 'anon cannot select profiles');
select tests.reset_role();

-- 3 teams max per player.
select tests.authenticate_as(:'alice');
select public.create_team('Deux') is not null;
select public.create_team('Trois') is not null;
select tests.throws('select public.create_team(''Quatre'')', 'max_teams_reached', 'a player is in 3 teams max');
select tests.throws('select public.create_team(''X'')', 'invalid_team_name', 'team name is validated');

-- Owner leaving hands over ownership.
select tests.reset_role();
select tests.as_service();
insert into public.team_members (team_id, user_id, plate_color) values (:'team_a', :'bob', '#7C7E84');
select tests.reset_role();
select tests.authenticate_as(:'alice');
select public.leave_team(:'team_a');
select tests.reset_role();
select tests.eq((select role::text from public.team_members where team_id = :'team_a' and user_id = :'bob'),
                'owner', 'ownership passes to the remaining member');

rollback;
