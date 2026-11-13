begin;

select tests.create_user('buyer@shop.local') as buyer \gset
select tests.create_user('mate@shop.local') as mate \gset
select tests.create_user('out@shop.local') as outsider \gset

select tests.authenticate_as(:'buyer');
select id as team, invite_code as code from public.create_team('Boutique') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'mate', :'code');
select tests.reset_role();

-- Players cannot grant themselves items nor wear what they do not own.
select tests.authenticate_as(:'buyer');
select tests.throws($$insert into public.shop_purchases (user_id, product_id) values (auth.uid(), 'noskip.shop.skin.gold')$$,
                    '42501', 'players cannot write purchases');
select tests.throws($$select public.svc_apply_shop_event('x', 'NON_RENEWING_PURCHASE', auth.uid(), 'noskip.shop.skin.gold', false, now())$$,
                    '42501', 'players cannot fake a store event');
select tests.throws($$select public.equip_plate_skin('gold')$$, 'skin_not_owned', 'cannot wear an unbought skin');
select tests.throws($$select public.equip_plate_skin('neon')$$, 'invalid_skin', 'unknown skin refused');
select tests.throws($$update public.profiles set plate_skin = 'gold' where id = auth.uid()$$,
                    '42501', 'plate_skin is not directly writable');
select tests.eq(public.equip_plate_skin('classic'), 'classic', 'classic is always free');
select tests.ok((select count(*) = 1 and bool_and(product_id is null) from public.my_shop()), 'nothing bought yet');
select tests.reset_role();

-- Purchases come from the webhook only: once per event.
select tests.as_service();
select tests.eq((public.svc_apply_shop_event('shop-1', 'NON_RENEWING_PURCHASE', :'buyer', 'noskip.shop.skin.gold', false, now()) ->> 'applied'),
                'shop', 'skin purchase recorded');
select tests.eq((public.svc_apply_shop_event('shop-1', 'NON_RENEWING_PURCHASE', :'buyer', 'noskip.shop.skin.gold', false, now()) ->> 'duplicate'),
                'true', 'same event twice is ignored');
select public.svc_apply_shop_event('shop-2', 'NON_RENEWING_PURCHASE', :'buyer', 'noskip.shop.pack.foot', false, now());
select tests.throws($$select public.svc_apply_shop_event('shop-3', 'NON_RENEWING_PURCHASE', gen_random_uuid(), 'noskip.pro.annual', false, now())$$,
                    'invalid_product', 'only shop products go through this path');
select tests.ok(not app_private.has_pro(:'buyer'), 'a shop item never grants the subscription');
select tests.reset_role();

-- The buyer wears the skin; the whole team sees it; outsiders do not.
select tests.authenticate_as(:'buyer');
select tests.eq(public.equip_plate_skin('gold'), 'gold', 'bought skin can be worn');
select tests.ok((select count(*) = 2 and bool_and(equipped_skin = 'gold') from public.my_shop()), 'my shop lists both items');
select tests.reset_role();
select tests.authenticate_as(:'mate');
select tests.eq((select plate_skin from public.team_cosmetics(:'team') where user_id = :'buyer'), 'gold', 'teammates see the skin');
select tests.eq((select count(*) from public.shop_purchases)::int, 0, 'other players purchases stay private');
select tests.reset_role();
select tests.authenticate_as(:'outsider');
select tests.throws(format('select * from public.team_cosmetics(%L)', :'team'), 'not_found', 'outsiders cannot read a team');
select tests.reset_role();

-- Joke packs: any member's pack feeds the team's SKIP draw.
select tests.as_service();
select tests.eq(public.svc_team_joke_packs(:'team'), array['foot'], 'team draws from the buyer pack');
select tests.reset_role();

-- Refund: the item is revoked and the skin comes off the bar.
select tests.as_service();
select public.svc_apply_shop_event('shop-4', 'CANCELLATION', :'buyer', 'noskip.shop.skin.gold', true, now() + interval '1 second');
select tests.reset_role();
select tests.eq((select plate_skin from public.profiles where id = :'buyer'), 'classic', 'refunded skin taken off');
select tests.authenticate_as(:'buyer');
select tests.throws($$select public.equip_plate_skin('gold')$$, 'skin_not_owned', 'refunded skin cannot be worn again');
select tests.reset_role();

rollback;
