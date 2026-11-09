begin;

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
select tests.create_user('d@test.local') as d \gset
select tests.create_user('x@test.local') as x \gset
update public.profiles set pseudo = 'Karim' where id = :'a';
update public.profiles set pseudo = 'Maxime' where id = :'b';
update public.profiles set pseudo = 'Sofiane' where id = :'c';

select tests.authenticate_as(:'a');
select id as team, invite_code as code from public.create_team('Les Déchaînés') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'b', :'code');
select tests.reset_role();

select (now() + interval '1 year') as next_year \gset
select (now() - interval '1 day') as yesterday \gset

-- Rights: players cannot write subscriptions nor fake webhook events.
select tests.authenticate_as(:'a');
select tests.throws(format('select public.svc_apply_rc_event(%L,%L,%L,%L,%L,%L,%L,%L,%L,null,null)',
                           'evt-x', 'INITIAL_PURCHASE', :'a', 'individual', 'active', 'noskip.pro.annual',
                           :'next_year', now(), 'rc'), '42501', 'players cannot apply RevenueCat events');
select tests.throws('select * from public.rc_events', '42501', 'webhook log is private');
select tests.eq((select active from public.my_entitlement()), false, 'no plan: no access');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- Individual plan, idempotence, out-of-order events
-- ---------------------------------------------------------------------------
select tests.as_service();
select tests.eq((public.svc_apply_rc_event('evt-1', 'INITIAL_PURCHASE', :'c', 'individual', 'trialing',
                 'noskip.pro.annual', :'next_year', now(), 'rc-c', null, null) ->> 'applied'), 'individual',
                'trial started');
select tests.eq((public.svc_apply_rc_event('evt-1', 'INITIAL_PURCHASE', :'c', 'individual', 'trialing',
                 'noskip.pro.annual', :'next_year', now(), 'rc-c', null, null) ->> 'duplicate'), 'true',
                'same event twice is ignored');
-- An older event arriving late never overwrites the newer state.
select public.svc_apply_rc_event('evt-0', 'EXPIRATION', :'c', 'individual', 'expired',
       'noskip.pro.annual', :'yesterday', now() - interval '1 hour', 'rc-c', null, null);
select tests.ok(app_private.has_pro(:'c'), 'late old event does not cut access');
select tests.eq((public.svc_apply_rc_event('evt-2', 'INITIAL_PURCHASE', gen_random_uuid(), 'individual', 'active',
                 'noskip.pro.annual', :'next_year', now(), 'rc', null, null) ->> 'ignored'), 'unknown_user',
                'unknown app user is ignored');
select tests.reset_role();

select tests.authenticate_as(:'c');
select tests.ok((select active and source = 'individual' and is_payer and offered_by is null from public.my_entitlement()),
                'trialing counts as Pro');
select tests.reset_role();

select tests.as_service();
select public.svc_apply_rc_event('evt-3', 'CANCELLATION', :'c', 'individual', 'cancelled',
       'noskip.pro.annual', :'next_year', now() + interval '1 second', 'rc-c', null, null);
select tests.ok(app_private.has_pro(:'c'), 'cancelled keeps access until expiration');
select public.svc_apply_rc_event('evt-4', 'EXPIRATION', :'c', 'individual', 'expired',
       'noskip.pro.annual', :'yesterday', now() + interval '2 seconds', 'rc-c', null, null);
select tests.ok(not app_private.has_pro(:'c'), 'expired: back to the paywall');
select tests.reset_role();

-- ---------------------------------------------------------------------------
-- Pack Duo: payer + one teammate ("Offert par Karim")
-- ---------------------------------------------------------------------------
select tests.as_service();
select tests.eq((public.svc_apply_rc_event('evt-10', 'INITIAL_PURCHASE', :'a', 'duo', 'active',
                 'noskip.duo.annual', :'next_year', now(), 'rc-a', :'x', null) ->> 'partner'), :'b',
                'invalid partner (not a teammate) falls back to the teammate');
select tests.reset_role();
select tests.authenticate_as(:'b');
select tests.ok((select active and source = 'duo' and offered_by = 'Karim' and not is_payer from public.my_entitlement()),
                'Maxime: Pro offered by Karim');
select tests.reset_role();
select tests.ok(not app_private.has_pro(:'x'), 'a stranger never gets the Duo');

-- Duo bought alone: the first teammate who joins gets it.
select tests.authenticate_as(:'d');
select id as dteam, invite_code as dcode from public.create_team('Solo') \gset
select tests.reset_role();
select tests.as_service();
select tests.ok((public.svc_apply_rc_event('evt-20', 'INITIAL_PURCHASE', :'d', 'duo', 'active',
                 'noskip.duo.annual', :'next_year', now(), 'rc-d', null, null) -> 'partner') = 'null'::jsonb,
                'no teammate yet: no partner');
select public.svc_join_team(:'x', :'dcode');
select tests.reset_role();
select tests.ok(app_private.has_pro(:'x'), 'the first teammate to join gets the Duo');

-- Duo expiring: both lose it.
select tests.as_service();
select public.svc_apply_rc_event('evt-11', 'EXPIRATION', :'a', 'duo', 'expired',
       'noskip.duo.annual', :'yesterday', now() + interval '5 seconds', 'rc-a', null, null);
select tests.reset_role();
select tests.ok(not app_private.has_pro(:'a') and not app_private.has_pro(:'b'), 'Duo expired for both');

-- ---------------------------------------------------------------------------
-- Team plan: every member covered, cap 8, payer keeps Pro
-- ---------------------------------------------------------------------------
select tests.as_service();
select tests.eq((public.svc_apply_rc_event('evt-30', 'INITIAL_PURCHASE', :'a', 'team', 'active',
                 'noskip.team.annual', :'next_year', now() + interval '6 seconds', 'rc-a', null, :'team') ->> 'team'),
                :'team', 'team plan on the chosen team');
select tests.reset_role();
select tests.ok(app_private.has_pro(:'b'), 'members covered by the Team plan');
select tests.eq(app_private.team_capacity(:'team'), 8, 'Team plan: up to 8 players');
select tests.authenticate_as(:'b');
select tests.ok((select source = 'team' and offered_by = 'Karim' and team_name = 'Les Déchaînés' from public.my_entitlement()),
                'Maxime: Team plan offered by Karim');
select tests.reset_role();
select tests.as_service();
select tests.eq((public.svc_apply_rc_event('evt-31', 'INITIAL_PURCHASE', :'a', 'team', 'active',
                 'noskip.team.annual', :'next_year', now() + interval '7 seconds', 'rc-a', null, :'dteam') ->> 'team'),
                :'team', 'a team the payer is not in falls back to their own team');
select tests.reset_role();

-- A joiner of a Team-plan team gets Pro immediately.
select tests.as_service();
select public.svc_join_team(:'c', :'code');
select tests.reset_role();
select tests.ok(app_private.has_pro(:'c'), 'joining a paid team gives Pro');

select tests.as_service();
select public.svc_apply_rc_event('evt-32', 'EXPIRATION', :'a', 'team', 'expired',
       'noskip.team.annual', :'yesterday', now() + interval '8 seconds', 'rc-a', null, :'team');
select tests.reset_role();
select tests.ok(not app_private.has_pro(:'b'), 'Team plan expired: members lose it');
select tests.eq(app_private.team_capacity(:'team'), 4, 'back to 4 players');

select tests.as_service();
select tests.throws(format('select public.svc_apply_rc_event(%L,%L,%L,%L,%L,null,null,now(),null,null,null)',
                           'evt-99', 'INITIAL_PURCHASE', :'a', 'gold', 'active'), 'invalid_plan', 'unknown plan');
select tests.reset_role();

rollback;
