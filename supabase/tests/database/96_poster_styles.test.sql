begin;

select tests.create_user('roaster@poster.local') as roaster \gset
select tests.create_user('skipper@poster.local') as skipper \gset
select tests.create_user('bundle@poster.local') as bundler \gset

select tests.authenticate_as(:'roaster');
select id as team, invite_code as code from public.create_team('Affiches') \gset
select tests.reset_role();
select tests.as_service();
select public.svc_join_team(:'skipper', :'code');
select tests.reset_role();

-- Cannot wear an unbought style, nor write the column or the card.
select tests.authenticate_as(:'roaster');
select tests.throws($$select public.equip_poster_style('gold')$$, 'poster_not_owned', 'unbought style refused');
select tests.throws($$select public.equip_poster_style('disco')$$, 'invalid_poster_style', 'unknown style refused');
select tests.throws($$update public.profiles set poster_style = 'gold' where id = auth.uid()$$,
                    '42501', 'poster_style is not directly writable');
select tests.eq(public.equip_poster_style('classic'), 'classic', 'classic is always free');
select tests.reset_role();

-- No style worn in the team: the classic poster.
select tests.as_service();
insert into public.weeks (team_id, week_start) values (:'team', date '2026-10-26') returning id as w1 \gset
insert into public.skip_cards (week_id, team_id, user_id, line_id) values (:'w1', :'team', :'skipper', 'l1')
  returning poster_style as s1 \gset
select tests.eq(:'s1'::text, 'classic', 'no style worn: classic card');

-- The roaster buys and wears Game Over: the teammate's next card uses it.
select public.svc_apply_shop_event('poster-1', 'NON_RENEWING_PURCHASE', :'roaster', 'noskip.shop.poster.gameover', false, now());
select tests.reset_role();
select tests.authenticate_as(:'roaster');
select tests.eq(public.equip_poster_style('gameover'), 'gameover', 'bought style can be worn');
select tests.throws($$select public.equip_poster_style('gold')$$, 'poster_not_owned', 'one style does not unlock the others');
select tests.reset_role();
select tests.as_service();
insert into public.weeks (team_id, week_start) values (:'team', date '2026-11-02') returning id as w2 \gset
insert into public.skip_cards (week_id, team_id, user_id, line_id) values (:'w2', :'team', :'skipper', 'l2')
  returning poster_style as s2 \gset
select tests.eq(:'s2'::text, 'gameover', 'teammate card imposed by the buyer');

-- The buyer's own skip is not styled by their own purchase.
insert into public.skip_cards (week_id, team_id, user_id, line_id) values (:'w2', :'team', :'roaster', 'l3')
  returning poster_style as s3 \gset
select tests.eq(:'s3'::text, 'classic', 'own style never lands on own card');
select tests.reset_role();

-- Teammates see the style on the card.
select tests.authenticate_as(:'skipper');
select tests.eq((select poster_style from public.skip_cards where week_id = :'w2' and user_id = :'skipper'),
                'gameover', 'members read the card style');
select tests.reset_role();

-- Refund: the style comes off, later cards are classic again; old cards keep theirs.
select tests.as_service();
select public.svc_apply_shop_event('poster-2', 'CANCELLATION', :'roaster', 'noskip.shop.poster.gameover', true, now() + interval '1 second');
select tests.eq((select poster_style from public.profiles where id = :'roaster'), 'classic', 'refunded style taken off');
select tests.eq((select poster_style from public.skip_cards where week_id = :'w2' and user_id = :'skipper'),
                'gameover', 'an existing card never changes');

-- The pack of five unlocks every style.
select public.svc_apply_shop_event('poster-3', 'NON_RENEWING_PURCHASE', :'bundler', 'noskip.shop.poster.all', false, now());
select tests.reset_role();
select tests.authenticate_as(:'bundler');
select tests.eq(public.equip_poster_style('wanted'), 'wanted', 'pack unlocks wanted');
select tests.eq(public.equip_poster_style('gold'), 'gold', 'pack unlocks gold');
select tests.eq(public.equip_poster_style('zen'), 'zen', 'pack unlocks the styles added later');
select tests.reset_role();

rollback;
