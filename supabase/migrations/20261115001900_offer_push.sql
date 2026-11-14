-- Offer pushes (« Nouveautés et offres »): opt-in only (Apple 4.5.4), off unless the player turns
-- it on in Settings → Notifications (profiles.notification_prefs.offers = true).
-- The publisher launches a campaign from the SQL editor:
--   select app_private.send_offer('Nouveau dans la boutique', '4 nouvelles cartes SKIP…');
-- Each campaign is sent once (claimed before sending), so a replay never spams.

create table app_private.offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 180),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_count integer
);
revoke all on app_private.offer_campaigns from public, anon, authenticated;

create function app_private.send_offer(p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into app_private.offer_campaigns (title, body) values (p_title, p_body) returning id into v_id;
  perform app_private.call_function('send-offer', jsonb_build_object('campaign_id', v_id));
  return v_id;
end $$;

-- The Edge Function claims the campaign: only the first call gets it.
create function public.svc_claim_offer(p_campaign uuid)
returns table (title text, body text)
language sql volatile security definer set search_path = ''
as $$
  update app_private.offer_campaigns c set sent_at = now()
   where c.id = p_campaign and c.sent_at is null
  returning c.title, c.body
$$;

-- Phones of players who opted in (off by default: a missing key means no).
create function public.svc_offer_push_targets()
returns table (token text)
language sql stable security definer set search_path = ''
as $$
  select pt.token from public.push_tokens pt
    join public.profiles p on p.id = pt.user_id
   where coalesce((p.notification_prefs ->> 'offers')::boolean, false)
$$;

create function public.svc_offer_sent(p_campaign uuid, p_count integer) returns void
language sql volatile security definer set search_path = ''
as $$ update app_private.offer_campaigns set sent_count = p_count where id = p_campaign $$;

revoke all on function app_private.send_offer(text, text) from public, anon, authenticated;
revoke all on function public.svc_claim_offer(uuid), public.svc_offer_push_targets(),
  public.svc_offer_sent(uuid, integer) from public, anon, authenticated;
grant execute on function public.svc_claim_offer(uuid), public.svc_offer_push_targets(),
  public.svc_offer_sent(uuid, integer) to service_role;
