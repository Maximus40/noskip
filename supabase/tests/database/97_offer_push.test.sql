begin;

select tests.create_user('optin@offer.local') as optin \gset
select tests.create_user('optout@offer.local') as optout \gset
select tests.create_user('default@offer.local') as dflt \gset

update public.profiles set notification_prefs = notification_prefs || '{"offers": true}' where id = :'optin';
update public.profiles set notification_prefs = notification_prefs || '{"offers": false}' where id = :'optout';
insert into public.push_tokens (user_id, token, platform) values
  (:'optin', 'ExponentPushToken[in]', 'ios'),
  (:'optout', 'ExponentPushToken[out]', 'ios'),
  (:'dflt', 'ExponentPushToken[default]', 'ios');

-- Players can neither launch a campaign nor list targets.
select tests.authenticate_as(:'optin');
select tests.throws($$select * from public.svc_offer_push_targets()$$, '42501', 'players cannot list offer targets');
select tests.throws($$select * from public.svc_claim_offer(gen_random_uuid())$$, '42501', 'players cannot claim a campaign');
select tests.reset_role();

-- Only opted-in phones, never the default.
select tests.as_service();
select tests.eq((select array_agg(token) from public.svc_offer_push_targets()),
                array['ExponentPushToken[in]'], 'only players who opted in');
select tests.reset_role();

-- A campaign is claimed once.
insert into app_private.offer_campaigns (title, body) values ('Nouveau', 'Des cartes') returning id as camp \gset
select tests.as_service();
select tests.eq((select title from public.svc_claim_offer(:'camp')), 'Nouveau', 'first call claims the campaign');
select tests.eq((select count(*) from public.svc_claim_offer(:'camp'))::int, 0, 'a replay gets nothing');
select tests.reset_role();

rollback;
